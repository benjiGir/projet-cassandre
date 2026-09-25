"""
Validation du graphe de documentation.

    python3 tools/docs/check_docs_links.py docs/
    python3 tools/docs/check_docs_links.py docs/ --src src/
    python3 tools/docs/check_docs_links.py docs/ --src src/ --strict

Verifie : liens relatifs casses, ancres de titre inexistantes, fichiers
orphelins, wikilinks non portables vers Notion, et ancres `see: docs/...`
laissees dans le code qui pointent vers du vide.
"""

import argparse
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
SRC_EXTS = (".ts", ".tsx", ".js", ".jsx", ".mts", ".cts")
SKIP_DIRS = {"node_modules", "dist", "build", ".git", ".obsidian"}


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


def heading_slugs(path: str) -> set[str]:
    with open(path, encoding="utf-8", errors="replace") as source:
        return {slugify(m.group(2)) for m in HEADING.finditer(strip_code(source.read()))}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("docs")
    ap.add_argument("--src", default=None)
    ap.add_argument("--strict", action="store_true")
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
        if n != entry and inbound[n] == 0:
            warnings.append(f"{p}: orphelin — reference par aucun autre document")

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
    for e in errors:
        print(f"  ERROR  {e}")
    if not errors and not warnings:
        print("  Aucun probleme.")
    print("-" * W)
    failed = bool(errors) or (args.strict and bool(warnings))
    print(f"  VERDICT : {'ECHEC' if failed else 'CONFORME'}"
          f"   ({len(errors)} erreurs, {len(warnings)} warnings)")
    print("=" * W + "\n")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
