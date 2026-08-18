from .generator import TRUNCATION_RETRY_MAX_TOKENS, generate_a2ui_stream
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
