from io import BytesIO
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

from . import storage


class CropResourceTests(unittest.TestCase):
    def test_crop_resource_writes_selected_png_with_source_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(storage, "SESSIONS_DIR", root / "sessions"), patch.object(storage, "SESSION_RESOURCES_DIR", root / "resources"):
                session = storage.create_session("crop test")
                original_bytes = BytesIO()
                Image.new("RGB", (100, 80), "red").save(original_bytes, format="PNG")
                original = storage._save_resource(session["id"], original_bytes.getvalue(), "image/png", "reference.png")

                cropped = storage.crop_resource(session["id"], original["id"], {"x": 0.1, "y": 0.2, "width": 0.5, "height": 0.5})

                path, resource = storage.get_resource_path(session["id"], cropped["id"]) or (None, None)
                self.assertIsNotNone(path)
                self.assertTrue(resource["selected"])
                self.assertEqual(resource["source_resource_id"], original["id"])
                with Image.open(path) as image:
                    self.assertEqual(image.size, (50, 40))

    def test_crop_resource_rejects_out_of_range_coordinates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(storage, "SESSIONS_DIR", root / "sessions"), patch.object(storage, "SESSION_RESOURCES_DIR", root / "resources"):
                session = storage.create_session("crop test")
                original_bytes = BytesIO()
                Image.new("RGB", (2, 2), "red").save(original_bytes, format="PNG")
                original = storage._save_resource(session["id"], original_bytes.getvalue(), "image/png", "reference.png")
                with self.assertRaisesRegex(ValueError, "out of range"):
                    storage.crop_resource(session["id"], original["id"], {"x": 0.9, "y": 0, "width": 0.2, "height": 0.5})
