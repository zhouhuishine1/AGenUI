from unittest.mock import patch

from .generator import (
    TRUNCATION_RETRY_MAX_TOKENS,
    _crop_instructions,
    _resolve_datamodel_crops,
    _resolve_image_crops,
    generate_a2ui_stream,
)
from .providers import StreamToken


class TruncatedProvider:
    model = "test-model"

    def __init__(self):
        self.max_tokens = []

    def chat_stream(self, _system, _prompt, **kwargs):
        self.max_tokens.append(kwargs.get("max_tokens"))
        yield StreamToken(kind="content", text='```json {"version":"v0.9"')
        yield StreamToken(kind="finish", text="length")


def test_retries_truncated_output_and_preserves_each_response():
    provider = TruncatedProvider()

    events = list(generate_a2ui_stream(provider, "Generate a card"))

    error = events[-1]
    assert error.type == "error"
    assert error.data["code"] == "extraction_failed"
    assert provider.max_tokens[:2] == [None, TRUNCATION_RETRY_MAX_TOKENS]
    assert [item["label"] for item in error.data["raw_responses"]] == [
        "Initial response",
        f"Retry with {TRUNCATION_RETRY_MAX_TOKENS} max tokens",
        "Automatic repair",
    ]


def test_crop_skill_is_injected_only_for_available_references():
    with patch("playground.studio.server.generator.storage.list_resources", return_value=[{
        "id": "0123456789ab", "url": "/api/sessions/abcdef/resources/0123456789ab/content",
    }]):
        prompt = _crop_instructions("abcdef", ["0123456789ab"])

    assert "agenui-crop://reference/<resource-id>" in prompt
    assert "reference-1" in prompt
    assert _crop_instructions(None, ["0123456789ab"]) == ""


def test_invalid_crop_falls_back_to_full_reference_image():
    components = {
        "updateComponents": {"components": [{
            "component": "Image",
            "url": "agenui-crop://reference/0123456789ab#x=0.8&y=0.2&width=0.5&height=0.5",
        }]},
    }
    result = _resolve_image_crops(components, "abcdef", ["0123456789ab"])
    assert result["updateComponents"]["components"][0]["url"] == "/api/sessions/abcdef/resources/0123456789ab/content"


def test_datamodel_crop_placeholders_are_replaced_for_bound_images():
    datamodel = {
        "updateDataModel": {
            "coverUrl": "agenui-crop://reference/0123456789ab#x=0.0&y=0.0&width=0.5&height=1.0",
            "brandLogoUrl": {"literalString": "agenui-crop://reference/0123456789ab#x=0.5&y=0.5&width=0.1&height=0.1"},
            "title": "Keep this value",
        },
    }
    with patch("playground.studio.server.generator.storage.crop_resource", side_effect=lambda _session, resource_id, _crop: {"url": f"/api/sessions/abcdef/resources/{resource_id}c/content"}):
        result = _resolve_datamodel_crops(datamodel, "abcdef", {"0123456789ab"})

    values = result["updateDataModel"]
    assert values["coverUrl"] == "/api/sessions/abcdef/resources/0123456789abc/content"
    assert values["brandLogoUrl"] == {"literalString": "/api/sessions/abcdef/resources/0123456789abc/content"}
    assert values["title"] == "Keep this value"


def test_datamodel_invalid_crop_falls_back_to_full_reference_image():
    datamodel = {
        "updateDataModel": {
            "coverUrl": "agenui-crop://reference/0123456789ab#x=0.9&y=0.0&width=0.2&height=0.5",
        },
    }
    with patch("playground.studio.server.generator.storage.crop_resource", side_effect=ValueError("out of range")):
        result = _resolve_datamodel_crops(datamodel, "abcdef", {"0123456789ab"})

    assert result["updateDataModel"]["coverUrl"] == "/api/sessions/abcdef/resources/0123456789ab/content"
