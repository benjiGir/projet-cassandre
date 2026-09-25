"""Régressions du vérificateur de liens documentaires."""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


CHECKER = Path(__file__).with_name("check_docs_links.py")


class LinkCheckerTests(unittest.TestCase):
    def run_checker(self, files: dict[str, str]) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as root:
            for name, body in files.items():
                path = Path(root, name)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(body, encoding="utf-8")
            return subprocess.run(
                [sys.executable, str(CHECKER), "docs", "--src", "src", "--strict"],
                capture_output=True, text=True, check=False, cwd=root,
            )

    def test_link_outside_docs_is_validated(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[guide](../GUIDE.md#usage)\n",
            "GUIDE.md": "# Usage\n",
        })
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_missing_link_outside_docs_fails(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[guide](../MISSING.md)\n",
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("lien casse", result.stdout)

    def test_sentence_period_is_not_part_of_code_anchor(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[guide](guide.md)\n",
            "docs/guide.md": "# Usage\n",
            "src/example.ts": "// voir docs/guide.md.\n",
        })
        self.assertEqual(result.returncode, 0, result.stdout)


if __name__ == "__main__":
    unittest.main()
