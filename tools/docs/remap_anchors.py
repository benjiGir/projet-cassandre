"""
Reecriture des renvois `docs/...` depuis le code et la documentation, d'apres
la table de correspondance ancien -> nouveau de la phase I.

    python3 tools/docs/remap_anchors.py --dry-run
    python3 tools/docs/remap_anchors.py --dry-run --diff out.patch
    python3 tools/docs/remap_anchors.py --archive-plan
    python3 tools/docs/remap_anchors.py --apply     # ecriture reelle, apres revue du diff

Le mode par defaut est une simulation : aucun fichier ne change sans
`--apply`. La migration D65 a ete appliquee une fois les cibles de
`tools/docs/correspondance.tsv` verifiees et l'ancienne documentation
archivee. Le script ignore les pages d'archive et les exemples de test.

Deux formes de renvoi sont reconnues :
  - absolue depuis la racine du depot : `docs/systems/rendu.md#eclairage`
  - relative dans un fichier `.md` de `docs/` : `../systems/rendu.md#eclairage`,
    resolue par rapport au fichier qui la contient.

Table `tools/docs/correspondance.tsv` (TSV, en-tete) :
  ancien        chemin de l'ancien fichier, racine du depot, ancre facultative
  nouveau       chemin cible REEL utilise par le script quand statut=repris,
                TOUJOURS complet depuis la racine (`docs/4-technique/...md`,
                pas `4-technique/...md`), avec ancre facultative. Pour
                `archive`, vide par défaut ; peut nommer une cible d'archive
                explicite pour une ancre historique absente de la page courante.
  statut        `repris` ou `archive`
  cible_future  page de la nouvelle doc qui doit un jour reprendre ce contenu,
                purement informatif : jamais lu par le script. Colonne
                separee de `nouveau` pour ne pas confondre « la cible reelle
                que le script applique » et « la cible prevue au plan » —
                les deux ne coincident pas tant qu'une ligne est en `archive`.

Une entree avec ancre (`ancien` = `chemin.md#ancre`) est prioritaire sur une
entree sans ancre pour le meme fichier. Un ancien fichier absent de la table
recoit le renvoi par defaut de D64 : son chemin d'archive, ancre conservee.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import os
import re
from dataclasses import dataclass
from typing import Optional

# Repertoires ignores partout (arg --root compris) : ce qui n'est pas du vrai
# contenu du depot, ou ce que ce chantier ne touche jamais.
SKIP_DIR_NAMES = {"node_modules", "dist", ".git", "__pycache__"}
# Chemins relatifs a la racine, ignores meme s'ils portent un nom banal :
# l'ancienne doc figee et le chantier documentaire lui-meme ne sont jamais
# une SOURCE de renvoi a reecrire depuis (ils redirigent, on ne redirige pas
# depuis eux). `.claude/worktrees` est un artefact d'agents en parallele (des
# copies completes du depot dans un worktree git non suivi) : le compter
# doublerait chaque renvoi trouve pour de mauvaises raisons.
SKIP_REL_DIRS = {"docs/archive", ".claude/worktrees"}
# These pages are dated source material for the journal, not archive targets.
JOURNAL_SOURCE_PATHS = {
    "docs/assets/board-hypermarche.md",
    "docs/assets/board-pistolet.md",
    "docs/reference/etat-des-lieux-code-architecture.md",
}
# Added after the legacy-doc inventory; keep this active level-design reference.
PROTECTED_CURRENT_DOCS = {"docs/assets/board-coulisses.md"}
# Examples and fixtures intentionally contain fictional legacy paths.
SKIP_SOURCE_FILES = {
    "tools/docs/remap_anchors.py",
    "tools/docs/test_remap_anchors.py",
    "tools/docs/test_check_docs_links.py",
}

# Dossiers de l'ancienne doc, sujets a la regle d'archivage par defaut (D64).
OLD_DOC_DIRS = {"game", "systems", "pipeline", "reference", "assets"}
# Dossiers de la NOUVELLE arborescence (plus `decisions`) : un renvoi qui y
# pointe deja est laisse tel quel, jamais reecrit.
NEW_DOC_DIRS = {
    "1-introduction", "2-fonctionnel", "3-architecture", "4-technique",
    "5-guides", "6-reference", "decisions", "journal", "archive",
}

SCAN_EXTS = (".md", ".py", ".ts", ".tsx", ".js", ".mjs", ".cjs")

ABS_RE = re.compile(r"(docs/[A-Za-z0-9_./-]+\.md)(#[\w-]+)?")
REL_RE = re.compile(r"((?:\.\./)+[A-Za-z0-9_./-]+\.md)(#[\w-]+)?")


@dataclass
class Entry:
    nouveau: str
    statut: str


@dataclass
class Occurrence:
    file: str
    start: int
    end: int
    raw_path: str          # tel qu'ecrit dans le fichier (absolu ou relatif)
    resolved: str          # chemin docs/... resolu depuis la racine
    anchor: Optional[str]
    form: str               # "absolue" ou "relative"


@dataclass
class Resolution:
    category: str
    new_resolved: Optional[str] = None   # chemin docs/... cible, ou None
    new_anchor: Optional[str] = None


def load_table(table_path: str) -> dict[str, Entry]:
    """Charge `correspondance.tsv`. Cle = colonne `ancien` telle quelle
    (chemin, eventuellement suivi de `#ancre`)."""
    table: dict[str, Entry] = {}
    if not os.path.isfile(table_path):
        return table
    with open(table_path, encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh, delimiter="\t")
        required = {"ancien", "nouveau", "statut"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(
                f"{table_path}: colonnes manquantes {sorted(missing)} "
                f"(trouve {reader.fieldnames})"
            )
        for row in reader:
            ancien = (row.get("ancien") or "").strip()
            if not ancien or ancien.startswith("#"):
                continue
            nouveau = (row.get("nouveau") or "").strip()
            statut = (row.get("statut") or "").strip()
            if statut not in ("repris", "archive"):
                raise ValueError(
                    f"{table_path}: statut invalide {statut!r} pour {ancien!r} "
                    "(attendu 'repris' ou 'archive')"
                )
            table[ancien] = Entry(nouveau=nouveau, statut=statut)
    return table


def should_skip_dir(rel_dir: str, dirname: str) -> bool:
    if dirname in SKIP_DIR_NAMES:
        return True
    norm = rel_dir.replace(os.sep, "/")
    for skip in SKIP_REL_DIRS:
        if norm == skip or norm.startswith(skip + "/"):
            return True
    return False


def iter_source_files(root: str) -> list[str]:
    """Fichiers de src/, tools/, .agents/, .claude/, docs/ et .md racine."""
    out: list[str] = []
    scan_roots = ["src", "tools", ".agents", ".claude", "docs"]
    for scan_root in scan_roots:
        base = os.path.join(root, scan_root)
        if not os.path.isdir(base):
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            rel_dir = os.path.relpath(dirpath, root)
            dirnames[:] = [
                d for d in dirnames
                if not should_skip_dir(os.path.normpath(os.path.join(rel_dir, d)), d)
            ]
            if should_skip_dir(rel_dir, os.path.basename(dirpath)):
                continue
            for fn in filenames:
                if fn.endswith(SCAN_EXTS):
                    full = os.path.normpath(os.path.join(dirpath, fn))
                    rel = os.path.relpath(full, root).replace(os.sep, "/")
                    if rel not in SKIP_SOURCE_FILES:
                        out.append(full)
    # fichiers .md a la racine du depot (CLAUDE.md, AGENTS.md, README.md, PLAN_*.md...)
    for fn in sorted(os.listdir(root)):
        full = os.path.join(root, fn)
        if os.path.isfile(full) and fn.endswith(".md"):
            out.append(os.path.normpath(full))
    return sorted(set(out))


def find_occurrences(root: str, path: str) -> list[Occurrence]:
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError:
        return []
    rel_path = os.path.relpath(path, root).replace(os.sep, "/")
    out: list[Occurrence] = []

    for m in ABS_RE.finditer(text):
        raw = m.group(1)
        anchor = m.group(2)
        out.append(Occurrence(
            file=rel_path, start=m.start(), end=m.end(),
            raw_path=raw, resolved=os.path.normpath(raw).replace(os.sep, "/"),
            anchor=anchor, form="absolue",
        ))

    if rel_path.endswith(".md") and rel_path.startswith("docs/"):
        for m in REL_RE.finditer(text):
            raw = m.group(1)
            anchor = m.group(2)
            base_dir = os.path.dirname(path)
            resolved_full = os.path.normpath(os.path.join(base_dir, raw))
            resolved = os.path.relpath(resolved_full, root).replace(os.sep, "/")
            if not resolved.startswith("docs/"):
                continue
            out.append(Occurrence(
                file=rel_path, start=m.start(), end=m.end(),
                raw_path=raw, resolved=resolved,
                anchor=anchor, form="relative",
            ))

    out.sort(key=lambda o: o.start)
    return out


def archive_target(resolved: str) -> str:
    """`docs/systems/rendu.md` -> `docs/archive/systems-rendu.md`.
    `docs/foo.md` -> `docs/archive/foo.md` (pas de sous-dossier a aplatir)."""
    parts = resolved.split("/")
    assert parts[0] == "docs"
    name = parts[-1]
    if len(parts) > 2:
        sub = parts[1]
        return f"docs/archive/{sub}-{name}"
    return f"docs/archive/{name}"


def resolve(resolved: str, anchor: Optional[str], table: dict[str, Entry],
            root: str) -> Resolution:
    if resolved in PROTECTED_CURRENT_DOCS:
        return Resolution(category="inchange (document courant)")
    parts = resolved.split("/")
    if parts[0] != "docs":
        return Resolution(category="hors-docs")

    key_with_anchor = f"{resolved}{anchor}" if anchor else None
    entry = table.get(key_with_anchor) if key_with_anchor else None
    matched_key_had_anchor = entry is not None
    if entry is None:
        entry = table.get(resolved)

    if entry is not None:
        if entry.statut == "repris":
            target = entry.nouveau
            if not target:
                return Resolution(category="table-invalide (repris sans nouveau)")
            if "#" in target:
                new_resolved, new_anchor = target.split("#", 1)
                new_anchor = "#" + new_anchor
            else:
                new_resolved, new_anchor = target, (None if matched_key_had_anchor else anchor)
            return Resolution(category="repris (table)", new_resolved=new_resolved,
                               new_anchor=new_anchor)
        # statut == "archive"
        if entry.nouveau:
            target = entry.nouveau
            if "#" in target:
                new_resolved, new_anchor = target.split("#", 1)
                new_anchor = "#" + new_anchor
            else:
                new_resolved = target
                new_anchor = None if matched_key_had_anchor else anchor
            return Resolution(category="archive (table, cible explicite)",
                               new_resolved=new_resolved, new_anchor=new_anchor)
        new_resolved = archive_target(resolved)
        return Resolution(category="archive (table)", new_resolved=new_resolved,
                           new_anchor=anchor)

    if len(parts) >= 2 and parts[1] in NEW_DOC_DIRS:
        return Resolution(category="inchange (deja dans la nouvelle structure)")
    if resolved == "docs/README.md":
        return Resolution(category="inchange (racine)")

    if len(parts) >= 2 and parts[1] in OLD_DOC_DIRS:
        full = os.path.join(root, resolved)
        if os.path.isfile(full):
            new_resolved = archive_target(resolved)
            return Resolution(category="archive (defaut D64)", new_resolved=new_resolved,
                               new_anchor=anchor)
        return Resolution(category="non resolu (fichier introuvable)")

    return Resolution(category="non resolu (hors ancienne doc connue)")


def rewrite_text(text: str, occurrences: list[Occurrence],
                  resolutions: dict[int, Resolution], file_path: str,
                  root: str) -> tuple[str, int]:
    """Applique les remplacements de droite a gauche pour ne pas decaler les
    offsets. Renvoie (nouveau_texte, nombre_de_changements)."""
    changes = 0
    out = text
    for idx in sorted(range(len(occurrences)), key=lambda i: -occurrences[i].start):
        occ = occurrences[idx]
        res = resolutions[idx]
        if res.new_resolved is None:
            continue
        if occ.form == "absolue":
            new_raw = res.new_resolved
        else:
            base_dir = os.path.dirname(file_path)
            new_full = os.path.join(root, res.new_resolved)
            new_raw = os.path.relpath(new_full, base_dir).replace(os.sep, "/")
            if not new_raw.startswith("."):
                new_raw = "./" + new_raw
        if res.new_anchor:
            new_raw += res.new_anchor
        old_full = occ.raw_path + (occ.anchor or "")
        if new_raw == old_full:
            continue
        out = out[:occ.start] + new_raw + out[occ.end:]
        changes += 1
    return out, changes


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                  formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=".", help="racine du depot (defaut: .)")
    ap.add_argument("--table", default="tools/docs/correspondance.tsv")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", default=True,
                       help="mode par defaut : rapport seul, aucune ecriture")
    mode.add_argument("--apply", action="store_true",
                       help="reecrit les fichiers d'apres la table (apres revue du diff)")
    mode.add_argument("--archive-plan", action="store_true",
                       help="affiche les deplacements ancien -> archive de D64, sans rien deplacer")
    ap.add_argument("--diff", metavar="FICHIER",
                     help="ecrit un diff unifie des changements (mode --dry-run)")
    args = ap.parse_args()

    root = os.path.abspath(args.root)
    table = load_table(os.path.join(root, args.table))

    if args.archive_plan:
        print_archive_plan(root, table)
        return

    files = iter_source_files(root)

    per_file_occ: dict[str, list[Occurrence]] = {}
    per_file_res: dict[str, dict[int, Resolution]] = {}

    total_occurrences = 0
    files_with_occurrences = 0
    by_old_file: dict[str, int] = {}
    by_category: dict[str, int] = {}
    unresolved: list[Occurrence] = []

    for path in files:
        occs = find_occurrences(root, path)
        if not occs:
            continue
        rel_path = os.path.relpath(path, root).replace(os.sep, "/")
        resolutions: dict[int, Resolution] = {}
        file_had_occ = False
        for i, occ in enumerate(occs):
            res = resolve(occ.resolved, occ.anchor, table, root)
            resolutions[i] = res
            total_occurrences += 1
            file_had_occ = True
            by_old_file[occ.resolved] = by_old_file.get(occ.resolved, 0) + 1
            by_category[res.category] = by_category.get(res.category, 0) + 1
            if res.category.startswith("non resolu"):
                unresolved.append(occ)
        if file_had_occ:
            files_with_occurrences += 1
        per_file_occ[rel_path] = occs
        per_file_res[rel_path] = resolutions

    diffs: list[str] = []
    changed_files = 0
    changed_occurrences = 0
    for rel_path, occs in per_file_occ.items():
        full_path = os.path.join(root, rel_path)
        with open(full_path, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        new_text, n_changes = rewrite_text(text, occs, per_file_res[rel_path], full_path, root)
        if n_changes == 0:
            continue
        changed_files += 1
        changed_occurrences += n_changes
        if args.apply:
            with open(full_path, "w", encoding="utf-8") as fh:
                fh.write(new_text)
        elif args.diff:
            diffs.extend(difflib.unified_diff(
                text.splitlines(keepends=True),
                new_text.splitlines(keepends=True),
                fromfile=f"a/{rel_path}", tofile=f"b/{rel_path}",
            ))

    if args.diff and not args.apply:
        with open(args.diff, "w", encoding="utf-8") as fh:
            fh.writelines(diffs)

    print_report(total_occurrences, files_with_occurrences, by_old_file,
                 by_category, unresolved, changed_files, changed_occurrences,
                 mode="APPLIQUE" if args.apply else "SIMULATION",
                 diff_path=args.diff if (args.diff and not args.apply) else None)


def print_archive_plan(root: str, table: dict[str, Entry]) -> None:
    moves: list[tuple[str, str]] = []
    seen: set[str] = set()
    for sub in sorted(OLD_DOC_DIRS):
        base = os.path.join(root, "docs", sub)
        if not os.path.isdir(base):
            continue
        for fn in sorted(os.listdir(base)):
            if not fn.endswith(".md"):
                continue
            resolved = f"docs/{sub}/{fn}"
            if resolved in JOURNAL_SOURCE_PATHS or resolved in PROTECTED_CURRENT_DOCS:
                continue
            if resolved in seen:
                continue
            seen.add(resolved)
            moves.append((resolved, archive_target(resolved)))

    W = 72
    print("\n" + "=" * W)
    print("PLAN D'ARCHIVAGE (D64) — aucun fichier deplace")
    print("=" * W)
    for old, new in moves:
        print(f"  {old}  ->  {new}")
    print("-" * W)
    print(f"  {len(moves)} fichiers de l'ancienne doc")
    print("=" * W + "\n")


def print_report(total_occurrences: int, files_with_occurrences: int,
                  by_old_file: dict[str, int], by_category: dict[str, int],
                  unresolved: list[Occurrence], changed_files: int,
                  changed_occurrences: int, mode: str,
                  diff_path: Optional[str]) -> None:
    W = 72
    print("\n" + "=" * W)
    print(f"RENVOIS docs/... — MODE {mode}")
    print("=" * W)
    print(f"  Renvois trouves        {total_occurrences}")
    print(f"  Fichiers concernes     {files_with_occurrences}")
    print(f"  Renvois a reecrire     {changed_occurrences}")
    print(f"  Fichiers a reecrire    {changed_files}")
    if diff_path:
        print(f"  Diff ecrit dans        {diff_path}")
    print("-" * W)
    print("  Par ancien fichier cible :")
    for old_file, n in sorted(by_old_file.items(), key=lambda kv: -kv[1]):
        print(f"    {n:4d}  {old_file}")
    print("-" * W)
    print("  Par resolution :")
    for cat, n in sorted(by_category.items(), key=lambda kv: -kv[1]):
        print(f"    {n:4d}  {cat}")
    print("-" * W)
    print(f"  Non resolus : {len(unresolved)}")
    for occ in unresolved[:5]:
        print(f"    {occ.file}: {occ.raw_path}{occ.anchor or ''} ({occ.form})")
    if len(unresolved) > 5:
        print(f"    ... et {len(unresolved) - 5} de plus")
    print("=" * W + "\n")


if __name__ == "__main__":
    main()
