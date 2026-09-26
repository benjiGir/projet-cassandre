"""
Validation du graphe de documentation.

    python3 tools/docs/check_docs_links.py docs/
    python3 tools/docs/check_docs_links.py docs/ --src src/
    python3 tools/docs/check_docs_links.py docs/ --src src/ --strict
    python3 tools/docs/check_docs_links.py docs/ --src src/ --strict --allow-empty-drafts

Verifie : liens relatifs casses, ancres de titre inexistantes, fichiers
orphelins (hors `archive/`),
wikilinks non portables vers Notion, ancres `see: docs/...` laissees dans le
code qui pointent vers du vide, chemins `src/`/`tools/`/`public/`/
`assets_src/` cites entre backticks dans une page de doc qui n'existent pas
dans le depot, et pages `brouillon` reduites a leur squelette (warning
"page vide", desactivable avec --allow-empty-drafts).
"""

import argparse
import glob
import os
import re
import sys
from collections import defaultdict

MD_LINK = re.compile(r"\[[^\]]*\]\(\s*([^)\s#]+)?(#[^)\s]+)?\s*\)")
WIKILINK = re.compile(r"\[\[([^\]]+)\]\]")
HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.M)
CODE_FENCE = re.compile(r"```.*?```", re.S)
INLINE_CODE = re.compile(r"`[^`\n]*`")
CODE_ANCHOR = re.compile(r"\b(?:see|voir|cf)\s*:?\s*(docs/[\w./-]+?\.md)(#[\w-]+)?(?=[\s,;)\"'.]|$)", re.I)
FRONTMATTER = re.compile(r"^---\n(.*?)\n---\n", re.S)
SRC_EXTS = (".ts", ".tsx", ".js", ".jsx", ".mts", ".cts")
SKIP_DIRS = {"node_modules", "dist", "build", ".git", ".obsidian"}

# Chemins cites entre backticks dans docs/ : prefixes reconnus comme des
# chemins reels du depot (par opposition a un nom de fonction ou un fragment
# de prose qui commence par la meme lettre).
REPO_PATH_PREFIXES = ("src/", "tools/", "public/", "assets_src/")
# Dossiers de docs/ ou la verification de chemins ne s'applique pas :
# ancienne doc figee, chantier de travail, journal date, ADR.
PATH_CHECK_EXEMPT_DIRS = {"archive", "journal", "decisions"}
# Dossiers exclus de la detection d'orphelins (chantier de refonte D2 : la
# nouvelle arborescence reste jointe par les README de dossier, l'ancienne
# doc part en archive).
ORPHAN_EXEMPT_DIRS = {"archive"}


def slugify(title: str) -> str:
    """Slug GitHub/Obsidian : minuscules, ponctuation retiree, espaces -> tirets."""
    s = title.strip().lower()
    s = re.sub(r"`([^`]*)`", r"\1", s)
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    return re.sub(r"\s+", "-", s).strip("-")


def walk(root: str, exts: tuple) -> list[str]:
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.endswith(exts):
                out.append(os.path.join(dirpath, fn))
    return sorted(out)


def strip_code(text: str) -> str:
    return INLINE_CODE.sub(" ", CODE_FENCE.sub(" ", text))


def top_dir(path: str, root: str) -> str:
    """Premier segment de `path` relatif a `root` ('' si a la racine de root)."""
    rel = os.path.relpath(path, root)
    parts = rel.split(os.sep)
    return parts[0] if len(parts) > 1 else ""


def repo_path_candidates(text: str) -> list[str]:
    """Chemins `src/...`/`tools/...`/`public/...`/`assets_src/...` cites entre
    backticks (hors blocs de code), symbole `::Foo` et ancre/ligne retires."""
    out = []
    for m in INLINE_CODE.finditer(CODE_FENCE.sub(" ", text)):
        content = m.group(0)[1:-1].strip()
        if not content:
            continue
        token = content.split()[0]
        if not token.startswith(REPO_PATH_PREFIXES):
            continue
        if "::" in token:
            token = token.split("::", 1)[0]
        if "#" in token:
            token = token.split("#", 1)[0]
        line_match = re.match(r"^(.+):\d+$", token)
        if line_match:
            token = line_match.group(1)
        token = token.rstrip(".,;:")
        if token:
            out.append(token)
    return out


def repo_path_exists(token: str, repo_root: str) -> bool:
    # `<nom>`/`<name>` : gabarit de chemin, pas un chemin reel.
    if "<" in token or ">" in token:
        return True
    # `**` decrit un motif (souvent un motif .gitignore cite tel quel dans le
    # texte), jamais un fichier precis : rien a resoudre.
    if "**" in token:
        return True
    # Un chemin qui se termine par `/` designe un dossier evoque en prose
    # (parfois propose, pas encore cree) : seul un vrai fichier ou un dossier
    # cite sans slash final est verifie strictement.
    if token.endswith("/"):
        return True
    if "*" in token:
        return bool(glob.glob(os.path.join(repo_root, token)))
    full = os.path.join(repo_root, token)
    return os.path.isfile(full) or os.path.isdir(full)


def is_empty_draft(text: str) -> bool:
    """Vrai si le frontmatter dit `status: brouillon` et que le corps ne
    contient rien d'autre que des titres et la note de squelette (`> ...`)."""
    fm = FRONTMATTER.match(text)
    if not fm:
        return False
    status_match = re.search(r"^status:\s*(\S+)\s*$", fm.group(1), re.M)
    if not status_match or status_match.group(1) != "brouillon":
        return False
    body = CODE_FENCE.sub(" ", text[fm.end():])
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("#") or line.startswith(">"):
            continue
        return False
    return True


def heading_slugs(path: str) -> set[str]:
    with open(path, encoding="utf-8", errors="replace") as source:
        return {slugify(m.group(2)) for m in HEADING.finditer(strip_code(source.read()))}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("docs")
    ap.add_argument("--src", default=None)
    ap.add_argument("--strict", action="store_true")
    ap.add_argument(
        "--allow-empty-drafts",
        action="store_true",
        help="n'echoue pas sur les pages brouillon reduites a leur squelette "
        "(les squelettes gardés comme brouillons restent tolérés)",
    )
    args = ap.parse_args()

    docs_root = args.docs.rstrip("/")
    md_files = walk(docs_root, (".md",))
    if not md_files:
        print(f"Aucun .md sous {docs_root}")
        sys.exit(1)

    headings: dict[str, set] = {}
    bodies: dict[str, str] = {}
    for p in md_files:
        text = open(p, encoding="utf-8", errors="replace").read()
        bodies[p] = text
        headings[os.path.normpath(p)] = heading_slugs(p)

    errors: list[str] = []
    warnings: list[str] = []
    inbound: dict[str, int] = defaultdict(int)

    for p in md_files:
        body = strip_code(bodies[p])
        base = os.path.dirname(p)

        for m in MD_LINK.finditer(body):
            target, anchor = m.group(1), m.group(2)
            if target and re.match(r"^(https?:|mailto:|#)", target):
                continue
            if target:
                if not target.endswith(".md"):
                    continue
                dest = os.path.normpath(os.path.join(base, target))
                if dest not in headings:
                    if not os.path.isfile(dest):
                        errors.append(f"{p}: lien casse -> {target}")
                        continue
                    headings[dest] = heading_slugs(dest)
                if dest in md_files:
                    inbound[dest] += 1
            else:
                dest = os.path.normpath(p)
            if anchor:
                slug = anchor[1:].lower()
                if slug not in headings[dest]:
                    warnings.append(f"{p}: ancre inconnue -> {target or ''}{anchor}")

        for m in WIKILINK.finditer(body):
            warnings.append(
                f"{p}: wikilink [[{m.group(1)}]] — non portable vers Notion, "
                "preferer un lien relatif"
            )

    entry = os.path.normpath(os.path.join(docs_root, "README.md"))
    for p in md_files:
        n = os.path.normpath(p)
        if n == entry or inbound[n] != 0:
            continue
        if top_dir(n, docs_root) in ORPHAN_EXEMPT_DIRS:
            continue
        warnings.append(f"{p}: orphelin — reference par aucun autre document")

    for p in md_files:
        if top_dir(os.path.normpath(p), docs_root) in PATH_CHECK_EXEMPT_DIRS:
            continue
        for token in repo_path_candidates(bodies[p]):
            if not repo_path_exists(token, "."):
                errors.append(f"{p}: chemin cite introuvable -> {token}")

    empty_draft_warnings: list[str] = []
    for p in md_files:
        if is_empty_draft(bodies[p]):
            empty_draft_warnings.append(f"{p}: page vide — brouillon reduit a son squelette")

    code_anchors: list[tuple[str, str, str]] = []
    if args.src:
        for p in walk(args.src, SRC_EXTS):
            text = open(p, encoding="utf-8", errors="replace").read()
            for m in CODE_ANCHOR.finditer(text):
                code_anchors.append((p, m.group(1), (m.group(2) or "")))

        for path, target, anchor in code_anchors:
            dest = os.path.normpath(target)
            if dest not in headings:
                errors.append(f"{path}: ancre code -> {target} (document absent)")
            elif anchor and anchor[1:].lower() not in headings[dest]:
                warnings.append(f"{path}: ancre code -> {target}{anchor} (titre absent)")

    W = 66
    print("\n" + "=" * W)
    print("GRAPHE DE DOCUMENTATION")
    print("=" * W)
    print(f"  Documents           {len(md_files)}")
    print(f"  Titres indexes      {sum(len(v) for v in headings.values())}")
    print(f"  Ancres depuis code  {len(code_anchors)}")
    print("-" * W)
    for w in warnings:
        print(f"  WARN   {w}")
    for w in empty_draft_warnings:
        suffix = " (ignore par --allow-empty-drafts)" if args.allow_empty_drafts else ""
        print(f"  WARN   {w}{suffix}")
    for e in errors:
        print(f"  ERROR  {e}")
    total_warnings = len(warnings) + len(empty_draft_warnings)
    if not errors and not total_warnings:
        print("  Aucun probleme.")
    print("-" * W)
    blocking_warnings = bool(warnings) or (bool(empty_draft_warnings) and not args.allow_empty_drafts)
    failed = bool(errors) or (args.strict and blocking_warnings)
    print(f"  VERDICT : {'ECHEC' if failed else 'CONFORME'}"
          f"   ({len(errors)} erreurs, {total_warnings} warnings)")
    print("=" * W + "\n")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
