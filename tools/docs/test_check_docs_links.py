"""Régressions du vérificateur de liens documentaires."""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


CHECKER = Path(__file__).with_name("check_docs_links.py")


DRAFT_FRONTMATTER = (
    "---\n"
    "title: Titre\n"
    "tags: [technique]\n"
    "status: brouillon\n"
    "updated: 2026-09-25\n"
    "---\n"
)


class LinkCheckerTests(unittest.TestCase):
    def run_checker(
        self, files: dict[str, str], extra_args: list[str] | None = None
    ) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as root:
            for name, body in files.items():
                path = Path(root, name)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(body, encoding="utf-8")
            args = [sys.executable, str(CHECKER), "docs", "--src", "src", "--strict"]
            args.extend(extra_args or [])
            return subprocess.run(
                args, capture_output=True, text=True, check=False, cwd=root,
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

    # -- archive/ : exclue de la detection d'orphelins ----------------------

    def test_archive_page_is_not_flagged_orphan(self) -> None:
        result = self.run_checker({
            "docs/README.md": "racine\n",
            "docs/archive/vieille-page.md": "# Vieille page\n",
        })
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertNotIn("orphelin", result.stdout)

    def test_archive_broken_link_is_still_checked(self) -> None:
        result = self.run_checker({
            "docs/README.md": "racine\n",
            "docs/archive/vieille-page.md": "[cible](introuvable.md)\n",
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("lien casse", result.stdout)

    def test_non_archive_orphan_still_fails(self) -> None:
        result = self.run_checker({
            "docs/README.md": "racine\n",
            "docs/1-introduction/isolee.md": "# Isolee\n",
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("orphelin", result.stdout)

    # -- chemins src/tools/public/assets_src cites entre backticks ---------

    def test_existing_repo_path_passes(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": "Voir `src/example.ts`.\n",
            "src/example.ts": "export {};\n",
        })
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_missing_repo_path_fails(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": "Voir `src/absent.ts`.\n",
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("chemin cite introuvable", result.stdout)
        self.assertIn("src/absent.ts", result.stdout)

    def test_repo_path_with_symbol_suffix_checks_file_only(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": "Voir `src/example.ts::MaFonction`.\n",
            "src/example.ts": "export {};\n",
        })
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_repo_path_with_line_suffix_checks_file_only(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": "Voir `src/example.ts:42`.\n",
            "src/example.ts": "export {};\n",
        })
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_repo_path_with_simple_wildcard(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": "Voir `src/game/*.ts`.\n",
            "src/game/foo.ts": "export {};\n",
        })
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_repo_path_with_unmatched_simple_wildcard_fails(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": "Voir `src/game/*.ts`.\n",
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("chemin cite introuvable", result.stdout)

    def test_function_name_is_not_treated_as_path(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": "Appelez `maFonctionAbsente()` depuis le code.\n",
        })
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_placeholder_path_is_not_flagged(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": "Fichier : `public/assets/levels/<name>.glb`.\n",
        })
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_globstar_pattern_is_not_flagged(self) -> None:
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": "Le motif vise `public/audio/**/*.wav`.\n",
        })
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_missing_path_in_exempt_dir_is_not_checked(self) -> None:
        result = self.run_checker({
            "docs/README.md": "racine\n",
            "docs/archive/vieille-page.md": "Voir `src/nexistepas.ts`.\n",
        })
        self.assertEqual(result.returncode, 0, result.stdout)

    # -- pages "brouillon" reduites a leur squelette -------------------------

    def test_empty_draft_page_warns(self) -> None:
        body = DRAFT_FRONTMATTER + (
            "\n# Titre\n\n> **Note** — Page à écrire au jalon D99.\n\n## Section\n\n"
        )
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": body,
        })
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("page vide", result.stdout)

    def test_empty_draft_page_allowed_with_flag(self) -> None:
        body = DRAFT_FRONTMATTER + (
            "\n# Titre\n\n> **Note** — Page à écrire au jalon D99.\n\n## Section\n\n"
        )
        result = self.run_checker(
            {
                "docs/README.md": "[page](page.md)\n",
                "docs/page.md": body,
            },
            extra_args=["--allow-empty-drafts"],
        )
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("page vide", result.stdout)

    def test_draft_page_with_real_content_does_not_warn(self) -> None:
        body = DRAFT_FRONTMATTER + "\n# Titre\n\nUn vrai paragraphe de contenu.\n"
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": body,
        })
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertNotIn("page vide", result.stdout)

    def test_stable_page_without_content_does_not_warn_as_draft(self) -> None:
        body = (
            "---\ntitle: Titre\ntags: [technique]\nstatus: stable\n"
            "updated: 2026-09-25\n---\n\n# Titre\n\n## Section\n\n"
        )
        result = self.run_checker({
            "docs/README.md": "[page](page.md)\n",
            "docs/page.md": body,
        })
        self.assertNotIn("page vide", result.stdout)


if __name__ == "__main__":
    unittest.main()
