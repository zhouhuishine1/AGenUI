# AGenUI Image Crop Contract

For a supplied reference resource ID, request a crop with this exact URL value:

`agenui-crop://reference/<resource-id>#x=<x>&y=<y>&width=<width>&height=<height>`

- `x`, `y`, `width`, and `height` are decimal fractions from `0` to `1`.
- `(x, y)` is the top-left corner; `x + width` and `y + height` must not exceed `1`.
- Choose the smallest useful region. The server keeps the selected region's own aspect ratio and does not force a card ratio.
- Use the complete local resource URL supplied in the reference manifest when no crop is needed.
- The server validates every request. Invalid crop requests fall back to the complete reference image.

Example:

```json
{
  "id": "product_photo",
  "component": "Image",
  "url": "agenui-crop://reference/0123456789ab#x=0.18&y=0.12&width=0.56&height=0.64",
  "fit": "contain"
}
```
