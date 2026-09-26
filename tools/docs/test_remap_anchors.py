import os
import shutil
import tempfile
import unittest

import remap_anchors as ra


def write(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)


def read(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


class FakeRepo:
    """Un faux depot minimal sous un repertoire temporaire, avec assez de
    fichiers pour exercer chaque forme de renvoi et chaque categorie de
    resolution du script."""

    def __init__(self, root: str):
        self.root = root

        # Ancienne doc : deux fichiers, un avec plusieurs titres (pour les
        # ancres), un autre plus court et jamais liste dans la table.
        write(os.path.join(root, "docs/systems/rendu.md"), (
            "# Rendu\n\n"
            "## Eclairage\n\nTexte.\n\n"
            "## Sprites\n\nTexte.\n"
        ))
        write(os.path.join(root, "docs/systems/physique.md"), (
            "# Physique\n\nTexte.\n"
        ))

        # Nouvelle doc : une page qui a deja recupere le contenu de rendu.md.
        write(os.path.join(root, "docs/4-technique/rendu.md"), (
            "# Rendu\n\n## Eclairage\n\nRepris.\n"
        ))
        write(os.path.join(root, "docs/4-technique/joueur.md"), "# Joueur\n")

        # Un renvoi ABSOLU depuis du code TypeScript.
        write(os.path.join(root, "src/render/renderer.ts"), (
            "// see: docs/systems/rendu.md#eclairage\n"
            "// see: docs/systems/rendu.md#découplage-entre-render-et-game\n"
            "// see: docs/systems/physique.md\n"
            "export {}\n"
        ))

        # Un renvoi RELATIF depuis un ADR (docs/decisions/), profondeur 1.
        write(os.path.join(root, "docs/decisions/0005-eclairage.md"), (
            "# ADR\n\nVoir [rendu](../systems/rendu.md#eclairage).\n"
        ))
        write(os.path.join(root, ".agents/skills/example/SKILL.md"), (
            "# Exemple de skill\n\n`docs/systems/rendu.md#eclairage`\n"
        ))
        # Un renvoi RELATIF depuis un fichier plus profond, pour verifier la
        # resolution a des niveaux differents.
        write(os.path.join(root, "docs/systems/hud.md"), (
            "# HUD\n\nVoir [physique](../systems/physique.md).\n"
        ))

        # Fichiers/dossiers ignores : ne doivent jamais etre scannes.
        write(os.path.join(root, "docs/archive/systems-rendu.md"),
              "# archive\n\ndocs/systems/rendu.md ne doit pas etre vu ici.\n")
        write(os.path.join(root, "node_modules/pkg/readme.md"),
              "docs/systems/rendu.md\n")
        write(os.path.join(root, ".claude/worktrees/copie/src/x.ts"),
              "// see: docs/systems/rendu.md\n")
        write(os.path.join(root, "__pycache__/x.md"), "docs/systems/rendu.md\n")

        # Table de correspondance : entree ANCRE-SPECIFIQUE prioritaire sur
        # l'entree fichier pour le meme ancien fichier.
        write(os.path.join(root, "tools/docs/correspondance.tsv"), (
            "ancien\tnouveau\tstatut\tcible_future\n"
            "docs/systems/rendu.md#eclairage\tdocs/4-technique/rendu.md#eclairage\trepris\t4-technique/rendu.md\n"
            "docs/systems/rendu.md#sprites\tdocs/archive/systems-rendu.md#sprites\tarchive\t4-technique/rendu.md\n"
            "docs/systems/rendu.md\t\tarchive\t4-technique/rendu.md\n"
        ))
        # docs/systems/physique.md n'a AUCUNE entree : doit tomber sur la
        # regle d'archivage par defaut (D64).


class TestRemapAnchors(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.repo = FakeRepo(self.tmp)
        self.table = ra.load_table(
            os.path.join(self.tmp, "tools/docs/correspondance.tsv")
        )

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    # -- decouverte des occurrences -----------------------------------

    def test_absolute_reference_found(self):
        path = os.path.join(self.tmp, "src/render/renderer.ts")
        occs = ra.find_occurrences(self.tmp, path)
        resolved = [(o.resolved, o.anchor, o.form) for o in occs]
        self.assertIn(("docs/systems/rendu.md", "#eclairage", "absolue"), resolved)
        self.assertIn(("docs/systems/rendu.md", "#découplage-entre-render-et-game", "absolue"), resolved)
        self.assertIn(("docs/systems/physique.md", None, "absolue"), resolved)

    def test_relative_reference_resolved_from_different_depths(self):
        adr = os.path.join(self.tmp, "docs/decisions/0005-eclairage.md")
        occs = ra.find_occurrences(self.tmp, adr)
        self.assertEqual(len(occs), 1)
        self.assertEqual(occs[0].resolved, "docs/systems/rendu.md")
        self.assertEqual(occs[0].anchor, "#eclairage")
        self.assertEqual(occs[0].form, "relative")

        hud = os.path.join(self.tmp, "docs/systems/hud.md")
        occs2 = ra.find_occurrences(self.tmp, hud)
        self.assertEqual(len(occs2), 1)
        self.assertEqual(occs2[0].resolved, "docs/systems/physique.md")

    def test_ignored_dirs_never_scanned(self):
        files = ra.iter_source_files(self.tmp)
        rels = {os.path.relpath(f, self.tmp).replace(os.sep, "/") for f in files}
        for bad in (
            "docs/archive/systems-rendu.md",
            "node_modules/pkg/readme.md",
            ".claude/worktrees/copie/src/x.ts",
            "__pycache__/x.md",
        ):
            self.assertNotIn(bad, rels, f"{bad} n'aurait pas du etre scanne")
        self.assertIn(".agents/skills/example/SKILL.md", rels)

    # -- resolution -----------------------------------------------------

    def test_anchor_specific_entry_takes_priority(self):
        res = ra.resolve("docs/systems/rendu.md", "#eclairage", self.table, self.tmp)
        self.assertEqual(res.category, "repris (table)")
        self.assertEqual(res.new_resolved, "docs/4-technique/rendu.md")
        self.assertEqual(res.new_anchor, "#eclairage")

    def test_file_level_entry_used_without_anchor(self):
        res = ra.resolve("docs/systems/rendu.md", None, self.table, self.tmp)
        self.assertEqual(res.category, "archive (table)")
        self.assertEqual(res.new_resolved, "docs/archive/systems-rendu.md")

    def test_file_level_entry_used_for_other_anchor(self):
        # Une ancre presente dans le texte mais absente de la table (seule
        # #eclairage y figure) retombe sur l'entree fichier.
        res = ra.resolve("docs/systems/rendu.md", "#vignettes", self.table, self.tmp)
        self.assertEqual(res.category, "archive (table)")
        self.assertEqual(res.new_resolved, "docs/archive/systems-rendu.md")
        self.assertEqual(res.new_anchor, "#vignettes")

    def test_explicit_archive_target_takes_priority_for_legacy_anchor(self):
        res = ra.resolve("docs/systems/rendu.md", "#sprites", self.table, self.tmp)
        self.assertEqual(res.category, "archive (table, cible explicite)")
        self.assertEqual(res.new_resolved, "docs/archive/systems-rendu.md")
        self.assertEqual(res.new_anchor, "#sprites")

    def test_unlisted_old_file_defaults_to_archive_anchor_preserved(self):
        res = ra.resolve("docs/systems/physique.md", "#un-titre", self.table, self.tmp)
        self.assertEqual(res.category, "archive (defaut D64)")
        self.assertEqual(res.new_resolved, "docs/archive/systems-physique.md")
        self.assertEqual(res.new_anchor, "#un-titre")

    def test_reference_already_in_new_structure_is_untouched(self):
        res = ra.resolve("docs/4-technique/joueur.md", None, self.table, self.tmp)
        self.assertEqual(res.category, "inchange (deja dans la nouvelle structure)")
        self.assertIsNone(res.new_resolved)

    def test_unresolved_when_neither_table_nor_old_dir(self):
        res = ra.resolve("docs/inexistant/fantome.md", None, self.table, self.tmp)
        self.assertTrue(res.category.startswith("non resolu"))

    # -- archive_target ---------------------------------------------------

    def test_archive_target_flattens_one_subdir(self):
        self.assertEqual(
            ra.archive_target("docs/systems/rendu.md"),
            "docs/archive/systems-rendu.md",
        )

    def test_archive_target_root_file_no_subdir(self):
        self.assertEqual(ra.archive_target("docs/README.md"), "docs/archive/README.md")

    # -- bout en bout : --dry-run n'ecrit rien -----------------------------

    def test_dry_run_writes_nothing(self):
        before = {
            p: read(p) for p in (
                os.path.join(self.tmp, "src/render/renderer.ts"),
                os.path.join(self.tmp, "docs/decisions/0005-eclairage.md"),
                os.path.join(self.tmp, "docs/systems/hud.md"),
                os.path.join(self.tmp, ".agents/skills/example/SKILL.md"),
            )
        }
        argv_backup = None
        import sys
        old_argv = sys.argv
        try:
            sys.argv = ["remap_anchors.py", "--root", self.tmp, "--dry-run"]
            ra.main()
        finally:
            sys.argv = old_argv
        for path, content in before.items():
            self.assertEqual(read(path), content, f"{path} a ete modifie en dry-run")

    # -- bout en bout : --apply reecrit, puis idempotence ------------------

    def test_apply_rewrites_and_is_idempotent(self):
        import sys
        old_argv = sys.argv
        renderer = os.path.join(self.tmp, "src/render/renderer.ts")
        adr = os.path.join(self.tmp, "docs/decisions/0005-eclairage.md")
        hud = os.path.join(self.tmp, "docs/systems/hud.md")
        skill = os.path.join(self.tmp, ".agents/skills/example/SKILL.md")

        try:
            sys.argv = ["remap_anchors.py", "--root", self.tmp, "--apply"]
            ra.main()
        finally:
            sys.argv = old_argv

        renderer_text = read(renderer)
        self.assertIn("docs/4-technique/rendu.md#eclairage", renderer_text)
        self.assertIn("docs/archive/systems-physique.md", renderer_text)

        adr_text = read(adr)
        self.assertIn("../4-technique/rendu.md#eclairage", adr_text)

        hud_text = read(hud)
        self.assertIn("../archive/systems-physique.md", hud_text)

        self.assertIn("docs/4-technique/rendu.md#eclairage", read(skill))

        after_first_apply = {
            renderer: renderer_text,
            adr: adr_text,
            hud: hud_text,
        }

        try:
            sys.argv = ["remap_anchors.py", "--root", self.tmp, "--apply"]
            ra.main()
        finally:
            sys.argv = old_argv

        for path, content in after_first_apply.items():
            self.assertEqual(read(path), content, f"{path} a change au second --apply")


if __name__ == "__main__":
    unittest.main()
