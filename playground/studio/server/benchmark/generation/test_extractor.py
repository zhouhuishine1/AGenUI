from .extractor import extract_json_blocks, parse_json_pair


def test_extracts_fenced_json_when_opening_brace_is_on_marker_line():
    response = (
        '```json {"version":"v0.9","updateComponents":{"surfaceId":"surface","components":[]}}\n```\n'
        '```json {"version":"v0.9","updateDataModel":{"surfaceId":"surface","path":"/","value":{}}}\n```'
    )

    components_json, datamodel_json = extract_json_blocks(response)
    components, datamodel, error = parse_json_pair(components_json, datamodel_json)

    assert error is None
    assert components["updateComponents"]["surfaceId"] == "surface"
    assert datamodel["updateDataModel"]["surfaceId"] == "surface"
