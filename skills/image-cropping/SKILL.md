---
name: image-cropping
description: Express crop requests for current-chat reference images in A2UI card generation. Use only when a supplied image needs a focused local region.
---

# Image Cropping

Use this Skill only when the current chat includes reference images and the card needs a local region rather than the full image.

- Use only the reference resource IDs listed in the generation prompt.
- Express a crop through the `Image.url` or `Image.src` value using the contract in [reference/crop-contract.md](reference/crop-contract.md).
- Keep the regular A2UI output contract: exactly `updateComponents` followed by `updateDataModel`; never emit a separate crop payload.
- If the complete reference image suits the card, use its supplied local URL instead of a crop request.
- Do not crop images from previous rounds, resource-library images, external URLs, or invented resource IDs.
