"""GMI Cloud chat client for Breakpoint (OpenAI-compatible API, urllib only).

Key: env GMI_API_KEY, else the line GMI_API_KEY=... in ~/hack/.gmi.env (re-read when
the file changes, so adding it needs no restart). The key is never printed, logged or
put into an exception message.

Public: have_key(), list_models(), pick_model(), chat(), health(), GMIError.
"""
import http.client
import json as _json
import os
import re
import socket
import threading
import time
import urllib.error
import urllib.request

API_BASE = os.environ.get("GMI_API_BASE", "https://api.gmi-serving.com/v1").rstrip("/")
KEY_FILE = os.path.expanduser("~/hack/.gmi.env")

# Fast, reliable JSON first (measured live 2026-11-11, see selftest). BREAKPOINT_MODEL overrides.
# The first is the default; the second is the fallback a timed-out call retries on.
PREFERRED_MODELS = [
    "deepseek-ai/DeepSeek-V4.1-Flash",
    "deepseek-ai/DeepSeek-V4-Pro",
    "Qwen/Qwen3.8-Flash",
    "Qwen/Qwen3.8-Max",
    "google/gemini-3.5-flash",
    "openai/gpt-5.5",
]
# Per-model extras: switch hidden reasoning off (it cost 2-4x latency and once ate the whole
# token budget, leaving an empty answer). A model that rejects one gets it dropped automatically.
MODEL_EXTRAS = {
    "deepseek-ai/DeepSeek-V4.1-Flash": {"thinking": {"type": "disabled"}},
    "deepseek-ai/DeepSeek-V4-Pro": {"thinking": {"type": "disabled"}},
    "Qwen/Qwen3.8-Flash": {"chat_template_kwargs": {"enable_thinking": False}},
    "Qwen/Qwen3.8-Max": {"chat_template_kwargs": {"enable_thinking": False}},
}
_DROPPABLE = ("response_format", "temperature", "thinking", "chat_template_kwargs", "reasoning_effort")
_CHAT_FAMILIES = ("qwen", "deepseek", "kimi", "glm", "gpt", "claude", "llama", "mistral", "gemini")
_NOT_CHAT = ("embed", "tts", "image", "video", "whisper", "rerank", "audio", "speech", "flux", "sdxl")

MODELS_TTL_S = 600          # model list cache
MODELS_FAIL_TTL_S = 60      # retry a failed listing after a minute
DEFAULT_MAX_TOKENS = int(os.environ.get("BREAKPOINT_MAX_TOKENS", "4096"))   # room even if a model reasons


class GMIError(Exception):
    """A GMI failure whose message is safe to show (never contains the key)."""

    def __init__(self, message, status=None, retryable=False):
        super().__init__(message)
        self.status = status
        self.retryable = retryable


_lock = threading.Lock()
_key_cache = {"mtime": None, "key": None}
_models_cache = {"at": 0.0, "ids": None, "ok": False}
_dropped_params = {}        # model id -> params it rejected (response_format, temperature)
_bad_models = {}            # model id -> time it answered "model not found"
_last = {"ok_at": 0.0, "model": None}


# ---------------------------------------------------------------- key
def _read_key():
    k = (os.environ.get("GMI_API_KEY") or "").strip()
    if k:
        return k
    try:
        mtime = os.stat(KEY_FILE).st_mtime
    except OSError:
        return None
    with _lock:
        if _key_cache["mtime"] == mtime:
            return _key_cache["key"]
    key = None
    try:
        with open(KEY_FILE, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("export "):
                    line = line[7:].strip()
                name, sep, val = line.partition("=")
                if sep and name.strip() == "GMI_API_KEY":
                    key = val.strip().strip('"').strip("'") or None
                    break
    except OSError:
        key = None
    with _lock:
        _key_cache["mtime"], _key_cache["key"] = mtime, key
    return key


def have_key():
    return bool(_read_key())


def _scrub(text):
    text = str(text)
    k = _read_key()
    if k and k in text:
        text = text.replace(k, "***")
    text = re.sub(r"(?i)bearer\s+\S+", "Bearer ***", text)
    return text[:300]


# ---------------------------------------------------------------- http
def _request(method, path, payload=None, timeout=40.0):
    key = _read_key()
    if not key:
        raise GMIError("no GMI key")
    data = None if payload is None else _json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(API_BASE + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + key)
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "breakpoint/0.1 (+hackathon)")   # GMI's Cloudflare blocks urllib's default UA (1010)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        try:
            detail = e.read(400).decode("utf-8", "replace")
        except Exception:
            detail = ""
        raise GMIError("GMI HTTP %d: %s" % (e.code, _scrub(detail)), status=e.code,
                       retryable=(e.code >= 500 or e.code == 429)) from None
    except (socket.timeout, TimeoutError):
        raise GMIError("GMI timed out after %.0f s" % timeout, retryable=True) from None
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        if isinstance(reason, (socket.timeout, TimeoutError)):
            raise GMIError("GMI timed out after %.0f s" % timeout, retryable=True) from None
        raise GMIError("GMI unreachable: %s" % _scrub(reason), retryable=True) from None
    except (http.client.HTTPException, OSError) as e:
        raise GMIError("GMI connection error: %s" % type(e).__name__, retryable=True) from None
    try:
        return _json.loads(raw.decode("utf-8"))
    except ValueError:
        raise GMIError("GMI returned something that is not JSON", retryable=True) from None


# ---------------------------------------------------------------- models
def list_models(force=False):
    """Model ids from GET /v1/models, cached 10 minutes. [] when unavailable."""
    now = time.time()
    with _lock:
        ids, at, ok = _models_cache["ids"], _models_cache["at"], _models_cache["ok"]
        ttl = MODELS_TTL_S if ok else MODELS_FAIL_TTL_S
        if not force and ids is not None and now - at < ttl:
            return list(ids)
    if not have_key():
        return []
    try:
        data = _request("GET", "/models", timeout=8)
        ids = [m.get("id") for m in (data.get("data") or []) if isinstance(m, dict) and m.get("id")]
        ok = bool(ids)
    except GMIError:
        ids, ok = [], False
    with _lock:
        _models_cache.update(at=now, ids=ids, ok=ok)
    return list(ids)


def pick_model(exclude=()):
    """First available model from the preference list (env BREAKPOINT_MODEL wins)."""
    env = (os.environ.get("BREAKPOINT_MODEL") or "").strip()
    if env and env not in exclude:
        return env
    now = time.time()
    bad = set(exclude) | {m for m, t in list(_bad_models.items()) if now - t < 600}
    ids = list_models()
    if ids:
        lower = {i.lower(): i for i in ids}
        for p in PREFERRED_MODELS:
            m = lower.get(p.lower())
            if m and m not in bad:
                return m
        for fam in _CHAT_FAMILIES:
            for i in ids:
                il = i.lower()
                if fam in il and i not in bad and not any(x in il for x in _NOT_CHAT):
                    return i
    for p in PREFERRED_MODELS:   # listing failed or had nothing usable: try the list blind
        if p not in bad:
            return p
    return None


# ---------------------------------------------------------------- chat
def _extract_text(data):
    try:
        msg = data["choices"][0].get("message") or {}
    except (KeyError, IndexError, TypeError, AttributeError):
        raise GMIError("GMI answer had no choices", retryable=True) from None
    content = msg.get("content")
    if isinstance(content, list):
        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return content or ""


def chat(messages, json=True, timeout=40, model=None, max_tokens=None, temperature=0.2, deadline=None):
    """One chat completion. Returns {text, model, tokens:{in,out}, ms}.

    json=True asks for response_format json_object (dropped automatically for models
    that reject it). One retry on timeout, 5xx or 429. A "model not found" answer moves
    to the next preferred model. deadline (epoch seconds) caps the total wait.
    Raises GMIError with a key-free message.
    """
    t0 = time.time()
    mdl = model or pick_model()
    if not mdl:
        raise GMIError("no GMI model available")
    tried = {mdl}
    retries_left = 1
    param_drops_left = 3

    def build(m):
        p = {"model": m, "messages": messages, "max_tokens": max_tokens or DEFAULT_MAX_TOKENS,
             "temperature": temperature, "stream": False}
        if json:
            p["response_format"] = {"type": "json_object"}
        extras = MODEL_EXTRAS.get(m) or next((v for k, v in MODEL_EXTRAS.items() if k.lower() == m.lower()), {})
        p.update(extras)
        for k in _dropped_params.get(m, ()):
            p.pop(k, None)
        return p

    payload = build(mdl)
    while True:
        remaining = (deadline - time.time()) if deadline else timeout
        if remaining < 2:
            raise GMIError("GMI ran out of time")
        try:
            data = _request("POST", "/chat/completions", payload, timeout=max(2.0, min(timeout, remaining)))
            text = _extract_text(data)
            if not text.strip():
                raise GMIError("GMI returned an empty answer", retryable=True)
            usage = data.get("usage") or {}
            used = data.get("model") or payload["model"]
            _last.update(ok_at=time.time(), model=payload["model"])
            return {"text": text, "model": used,
                    "tokens": {"in": int(usage.get("prompt_tokens") or 0),
                               "out": int(usage.get("completion_tokens") or 0)},
                    "ms": int((time.time() - t0) * 1000)}
        except GMIError as e:
            msg = str(e).lower()
            model_missing = e.status == 404 or (e.status == 400 and ("not found" in msg or "does not exist" in msg))
            if e.status == 400 and param_drops_left > 0 and not model_missing:
                # a parameter this model does not take: drop it and ask again
                drop = None
                for k in _DROPPABLE:
                    if k in payload and (k in msg or (k == "response_format" and "json" in msg)):
                        drop = k
                        break
                if drop is None:
                    drop = next((k for k in _DROPPABLE if k in payload), None)
                if drop:
                    param_drops_left -= 1
                    _dropped_params.setdefault(payload["model"], set()).add(drop)
                    payload.pop(drop, None)
                    continue
            if model_missing:
                _bad_models[payload["model"]] = time.time()
                nxt = None if model else pick_model(exclude=tried)
                if nxt and nxt not in tried:
                    tried.add(nxt)
                    payload = build(nxt)
                    continue
                raise
            if e.retryable and retries_left > 0 and (not deadline or deadline - time.time() > 6):
                retries_left -= 1
                # the one retry goes to the fallback model, unless a model was forced
                forced = model or (os.environ.get("BREAKPOINT_MODEL") or "").strip()
                nxt = None if forced else pick_model(exclude=tried)
                if nxt and nxt not in tried:
                    tried.add(nxt)
                    payload = build(nxt)
                else:
                    time.sleep(1.5 if e.status == 429 else 0.5)
                continue
            raise


# ---------------------------------------------------------------- health
def health():
    """{"gmi": bool, "model": str|None, "mode": "live"|"replay"}; never raises."""
    try:
        if not have_key():
            return {"gmi": False, "model": None, "mode": "replay"}
        ids = list_models()
        recent_ok = time.time() - _last["ok_at"] < 600
        if not ids and not recent_ok:
            return {"gmi": False, "model": None, "mode": "replay"}
        return {"gmi": True, "model": pick_model() or _last["model"], "mode": "live"}
    except Exception:
        return {"gmi": False, "model": None, "mode": "replay"}
