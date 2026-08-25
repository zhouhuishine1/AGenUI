"""Protocol persistence for AGenUI Studio.

Generated (custom) A2UI protocols are stored under ``~/.agenui/protocols/custom/``
as JSON files named ``{timestamp}_{short_id}.json`` (e.g. ``20260722_143052_a1b2c3.json``).

Each file contains full metadata (id, created_at, prompt, mode, provider, model)
plus the two A2UI payloads (components, datamodel). The QR-scan render sequence
served to the Playground is assembled from these payloads by ``render_sequence.py``.
"""

from __future__ import annotations

import json
import re
import base64
from io import BytesIO
import mimetypes
import shutil
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError

from .config import CUSTOM_DIR, SESSIONS_DIR, SESSION_RESOURCES_DIR


# short_id is 6 hex chars; timestamp is YYYYmmdd_HHMMSS.
_ID_RE = re.compile(r"^[0-9a-f]{6}$")
_RESOURCE_ID_RE = re.compile(r"^[0-9a-f]{12}$")


def ensure_dirs() -> None:
    """Create ~/.agenui/protocols/custom/ if missing."""
    CUSTOM_DIR.mkdir(parents=True, exist_ok=True)
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    SESSION_RESOURCES_DIR.mkdir(parents=True, exist_ok=True)


def _is_valid_id(protocol_id: str) -> bool:
    """Guard against path traversal / malformed ids."""
    return bool(_ID_RE.match(protocol_id or ""))


def _find_file(protocol_id: str) -> Path | None:
    """Locate the protocol file by short_id (glob ``*_{id}.json``)."""
    if not _is_valid_id(protocol_id):
        return None
    matches = sorted(CUSTOM_DIR.glob(f"*_{protocol_id}.json"))
    return matches[0] if matches else None


def save_protocol(
    prompt: str,
    mode: str,
    provider: str,
    model: str,
    components_dict: dict[str, Any],
    datamodel_dict: dict[str, Any],
) -> dict[str, Any]:
    """Persist a generated protocol and return its metadata record."""
    ensure_dirs()

    short_id = uuid.uuid4().hex[:6]
    now = datetime.now()
    timestamp = now.strftime("%Y%m%d_%H%M%S")
    created_at = now.isoformat(timespec="seconds")

    record: dict[str, Any] = {
        "id": short_id,
        "created_at": created_at,
        "prompt": prompt,
        "mode": mode,
        "provider": provider,
        "model": model,
        "components": components_dict,
        "datamodel": datamodel_dict,
    }

    file_path = CUSTOM_DIR / f"{timestamp}_{short_id}.json"
    file_path.write_text(
        json.dumps(record, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return record


def update_protocol(
    protocol_id: str,
    components_dict: dict[str, Any],
    datamodel_dict: dict[str, Any],
) -> dict[str, Any] | None:
    """Update the payloads of an existing protocol in place (same id/URL).

    Returns the updated record, or None if the protocol does not exist.
    """
    file_path = _find_file(protocol_id)
    if file_path is None:
        return None
    try:
        record = json.loads(file_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None

    record["components"] = components_dict
    record["datamodel"] = datamodel_dict
    file_path.write_text(
        json.dumps(record, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return record


def update_conversation(protocol_id: str, conversation: list[dict[str, Any]]) -> bool:
    """Store the complete local chat transcript for a generated session."""
    file_path = _find_file(protocol_id)
    if file_path is None:
        return False
    try:
        record = json.loads(file_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return False
    record["conversation"] = conversation
    file_path.write_text(
        json.dumps(record, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return True


def load_protocol(protocol_id: str) -> dict[str, Any] | None:
    """Load the full protocol record (metadata + payloads), or None if absent."""
    file_path = _find_file(protocol_id)
    if file_path is None:
        return None
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def list_protocols() -> list[dict[str, Any]]:
    """List all saved protocols (newest first) with a truncated prompt summary."""
    ensure_dirs()
    items: list[dict[str, Any]] = []
    for file_path in CUSTOM_DIR.glob("*.json"):
        try:
            record = json.loads(file_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        prompt = record.get("prompt", "") or ""
        items.append({
            "id": record.get("id"),
            "created_at": record.get("created_at"),
            "mode": record.get("mode"),
            "provider": record.get("provider"),
            "model": record.get("model"),
            "prompt_summary": prompt[:80] + ("..." if len(prompt) > 80 else ""),
        })
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return items


def delete_protocol(protocol_id: str) -> bool:
    """Delete a protocol by id. Returns True if a file was removed."""
    file_path = _find_file(protocol_id)
    if file_path is None:
        return False
    try:
        file_path.unlink()
        return True
    except OSError:
        return False


def _session_path(session_id: str) -> Path | None:
    return SESSIONS_DIR / f"{session_id}.json" if _is_valid_id(session_id) else None


def _resource_dir(session_id: str) -> Path | None:
    return SESSION_RESOURCES_DIR / session_id if _is_valid_id(session_id) else None


def resource_url(session_id: str, resource_id: str) -> str:
    return f"/api/sessions/{session_id}/resources/{resource_id}/content"


def _resource_extension(content_type: str, fallback_name: str = "") -> str:
    extension = mimetypes.guess_extension(content_type.split(";", 1)[0].strip())
    if extension in {".jpe", ".jfif"}:
        extension = ".jpg"
    return extension or Path(fallback_name).suffix or ".img"


def list_resources(session_id: str) -> list[dict[str, Any]] | None:
    record = load_session(session_id)
    if record is None:
        return None
    return record.get("resources", [])


def _save_resource(
    session_id: str,
    content: bytes,
    content_type: str,
    name: str,
    selected: bool = True,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not content or not content_type.startswith("image/"):
        raise ValueError("resource must be a non-empty image")
    if len(content) > 10 * 1024 * 1024:
        raise ValueError("image must not exceed 10 MB")
    record = load_session(session_id)
    directory = _resource_dir(session_id)
    if record is None or directory is None:
        raise ValueError("session not found")
    directory.mkdir(parents=True, exist_ok=True)
    resource_id = uuid.uuid4().hex[:12]
    filename = f"{resource_id}{_resource_extension(content_type, name)}"
    (directory / filename).write_bytes(content)
    resource = {
        "id": resource_id,
        "name": (name.strip() or filename)[:128],
        "content_type": content_type.split(";", 1)[0],
        "selected": selected,
        "url": resource_url(session_id, resource_id),
    }
    if metadata:
        resource.update(metadata)
    resources = [*record.get("resources", []), resource]
    update_session(session_id, resources=resources)
    return resource


def add_data_resource(session_id: str, data_url: str, name: str = "") -> dict[str, Any]:
    match = re.match(r"^data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$", data_url or "")
    if not match:
        raise ValueError("invalid image data URL")
    try:
        content = base64.b64decode(match.group(2), validate=True)
    except ValueError as exc:
        raise ValueError("invalid image data URL") from exc
    return _save_resource(session_id, content, match.group(1), name)


def download_resource(session_id: str, source_url: str, name: str = "") -> dict[str, Any]:
    if not re.match(r"^https?://", source_url or "", re.IGNORECASE):
        raise ValueError("image URL must use http or https")
    request = urllib.request.Request(source_url, headers={"User-Agent": "AGenUI-Studio/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            content_type = response.headers.get_content_type()
            if not content_type.startswith("image/"):
                raise ValueError("downloaded resource is not an image")
            content = response.read(10 * 1024 * 1024 + 1)
    except ValueError:
        raise
    except Exception as exc:  # noqa: BLE001 - returned to the Studio user.
        raise ValueError(f"could not download image: {exc}") from exc
    return _save_resource(session_id, content, content_type, name or Path(source_url).name)


def crop_resource(
    session_id: str,
    source_resource_id: str,
    crop: dict[str, float],
) -> dict[str, Any]:
    """Create a PNG crop from an existing session image resource."""
    if not _RESOURCE_ID_RE.fullmatch(source_resource_id or ""):
        raise ValueError("invalid source resource")
    source = get_resource_path(session_id, source_resource_id)
    if source is None:
        raise ValueError("source resource not found")
    try:
        x, y, width, height = (float(crop[key]) for key in ("x", "y", "width", "height"))
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("invalid crop coordinates") from exc
    if not all(0 <= value <= 1 for value in (x, y, width, height)) or width == 0 or height == 0 or x + width > 1 or y + height > 1:
        raise ValueError("crop coordinates are out of range")
    source_path, source_resource = source
    try:
        with Image.open(source_path) as image:
            image.load()
            left = int(x * image.width)
            top = int(y * image.height)
            right = min(image.width, max(left + 1, int((x + width) * image.width + 0.999999)))
            bottom = min(image.height, max(top + 1, int((y + height) * image.height + 0.999999)))
            if right <= left or bottom <= top:
                raise ValueError("crop region is smaller than one pixel")
            cropped = image.crop((left, top, right, bottom))
            output = BytesIO()
            cropped.save(output, format="PNG")
    except (OSError, UnidentifiedImageError) as exc:
        raise ValueError("source resource cannot be cropped") from exc
    return _save_resource(
        session_id,
        output.getvalue(),
        "image/png",
        f"{source_resource['name']} crop",
        metadata={"source_resource_id": source_resource_id, "crop": {"x": x, "y": y, "width": width, "height": height}},
    )


def update_resource(session_id: str, resource_id: str, **changes: Any) -> dict[str, Any] | None:
    if not _RESOURCE_ID_RE.fullmatch(resource_id or ""):
        return None
    record = load_session(session_id)
    if record is None:
        return None
    resources = record.get("resources", [])
    for resource in resources:
        if resource.get("id") == resource_id:
            if "name" in changes:
                resource["name"] = str(changes["name"]).strip()[:128]
            if "selected" in changes:
                resource["selected"] = bool(changes["selected"])
            update_session(session_id, resources=resources)
            return resource
    return None


def get_resource_path(session_id: str, resource_id: str) -> tuple[Path, dict[str, Any]] | None:
    if not _RESOURCE_ID_RE.fullmatch(resource_id or ""):
        return None
    record = load_session(session_id)
    directory = _resource_dir(session_id)
    if record is None or directory is None:
        return None
    resource = next((item for item in record.get("resources", []) if item.get("id") == resource_id), None)
    if resource is None:
        return None
    matches = list(directory.glob(f"{resource_id}.*"))
    return (matches[0], resource) if matches else None


def delete_resource(session_id: str, resource_id: str) -> bool:
    if not _RESOURCE_ID_RE.fullmatch(resource_id or ""):
        return False
    record = load_session(session_id)
    directory = _resource_dir(session_id)
    if record is None or directory is None:
        return False
    resources = record.get("resources", [])
    retained = [item for item in resources if item.get("id") != resource_id]
    if len(retained) == len(resources):
        return False
    for path in directory.glob(f"{resource_id}.*"):
        path.unlink(missing_ok=True)
    update_session(session_id, resources=retained)
    return True


def _write_session(record: dict[str, Any]) -> dict[str, Any]:
    path = _session_path(record["id"])
    if path is None:
        raise ValueError("invalid session id")
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return record


def create_session(title: str) -> dict[str, Any]:
    ensure_dirs()
    now = datetime.now().isoformat(timespec="seconds")
    record = {"id": uuid.uuid4().hex[:6], "title": title, "created_at": now,
              "updated_at": now, "conversation": [], "draft": "", "protocol_id": None,
              "status": "idle", "title_generated": False, "title_manual": False,
              "provider": None, "reasoning": False, "resources": []}
    return _write_session(record)


def load_session(session_id: str) -> dict[str, Any] | None:
    path = _session_path(session_id)
    if path is None:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def list_sessions() -> list[dict[str, Any]]:
    ensure_dirs()
    sessions = []
    for path in SESSIONS_DIR.glob("*.json"):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        sessions.append({key: record.get(key) for key in ("id", "title", "created_at", "updated_at", "protocol_id")})
    return sorted(sessions, key=lambda item: item.get("updated_at") or "", reverse=True)


def find_session_title_by_protocol(protocol_id: str) -> str | None:
    """Return the title of the session linked to ``protocol_id``, if any.

    A generated protocol is linked to a Session via ``session.protocol_id``.
    The Session's ``title`` is what the native Playground should show as the
    Session name; None when no session references the protocol.
    """
    for session in list_sessions():
        if session.get("protocol_id") == protocol_id and session.get("title"):
            return session["title"]
    return None


def update_session(session_id: str, **changes: Any) -> dict[str, Any] | None:
    record = load_session(session_id)
    if record is None:
        return None
    record.update(changes)
    record["updated_at"] = datetime.now().isoformat(timespec="seconds")
    return _write_session(record)


def delete_session(session_id: str) -> bool:
    """Delete a session by id. Returns True if a file was removed."""
    path = _session_path(session_id)
    if path is None or not path.exists():
        return False
    try:
        path.unlink()
        directory = _resource_dir(session_id)
        if directory is not None:
            shutil.rmtree(directory, ignore_errors=True)
        return True
    except OSError:
        return False
