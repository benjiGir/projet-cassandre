"""
Audit des commentaires d'une base TypeScript / JavaScript.

    python3 tools/docs/audit_comments.py src/
    python3 tools/docs/audit_comments.py src/ --json audit.json
    python3 tools/docs/audit_comments.py src/ --max-ratio 0.15

Classe chaque commentaire, signale les candidats à la migration vers /docs
et sort un code retour exploitable en CI.

Ne supprime rien. C'est un rapport, pas un outil de réécriture.
"""

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict

EXTS = (".ts", ".tsx", ".js", ".jsx", ".mts", ".cts")
SKIP_DIRS = {"node_modules", "dist", "build", ".git", "coverage", ".next"}

# Un commentaire qui contient du code : très probablement du code commenté
CODE_TOKENS = re.compile(
    r"(;\s*$|=>|\bconst\s+\w|\blet\s+\w|\bvar\s+\w|\bfunction\s|\breturn\b"
    r"|\bimport\s|\bexport\s|\bif\s*\(|\bfor\s*\(|\bwhile\s*\(|\)\s*\{|\}\s*$"
    r"|console\.(log|warn|error))"
)
BANNER = re.compile(r"^[\s/*#=~_-]*$|^[/*\s]*[-=*~_#]{6,}")
SHOUT = re.compile(r"^[/*\s]*[A-ZÀ-Ÿ0-9 _\-]{10,}[/*\s]*$")
TODO = re.compile(r"\b(TODO|FIXME|HACK|XXX|WIP)\b")
ANCHOR = re.compile(r"\b(?:see|voir|cf)\s*:?\s*(docs/[\w./#-]+)", re.I)
TYPE_ONLY_JSDOC = re.compile(r"^\s*\*\s*@(param|returns?|type)\b")


def strip_strings(line: str) -> str:
    """Neutralise les littéraux pour éviter les faux // dans les URLs."""
    out, i, n = [], 0, len(line)
    quote = None
    while i < n:
        c = line[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = None
            out.append(" ")
        else:
            if c in "\"'`":
                quote = c
                out.append(" ")
            else:
                out.append(c)
        i += 1
    return "".join(out)


def scan_file(path: str, long_block: int) -> dict:
    with open(path, encoding="utf-8", errors="replace") as f:
        lines = f.read().splitlines()

    kinds: Counter = Counter()
    findings: list[dict] = []
    anchors: list[str] = []
    code_lines = 0
    comment_lines = 0

    in_block = False
    block_start = 0
    block_buf: list[str] = []
    block_is_jsdoc = False

    for idx, raw in enumerate(lines, 1):
        stripped = raw.strip()
        safe = strip_strings(raw)

        if in_block:
            comment_lines += 1
            block_buf.append(stripped)
            if "*/" in safe:
                in_block = False
                length = idx - block_start + 1
                body = " ".join(block_buf)
                if block_is_jsdoc:
                    kinds["jsdoc"] += 1
                    prose = [
                        l for l in block_buf
                        if l.strip("*/ ") and not TYPE_ONLY_JSDOC.match(l)
                        and not l.startswith(("/**", "*/"))
                    ]
                    if not prose:
                        findings.append({
                            "line": block_start, "kind": "jsdoc_types_only",
                            "len": length,
                            "hint": "ne dit rien que TypeScript ne porte deja",
                        })
                else:
                    kinds["block"] += 1
                if length >= long_block:
                    findings.append({
                        "line": block_start, "kind": "block_long", "len": length,
                        "hint": f"{length} lignes — candidat migration vers /docs",
                    })
                for m in ANCHOR.finditer(body):
                    anchors.append(m.group(1))
                block_buf = []
            continue

        if not stripped:
            continue

        if "/*" in safe and "*/" not in safe:
            in_block = True
            block_start = idx
            block_is_jsdoc = stripped.startswith("/**")
            block_buf = [stripped]
            comment_lines += 1
            continue

        pos = safe.find("//")
        if pos == -1:
            if not (stripped.startswith("/*") and stripped.endswith("*/")):
                code_lines += 1
            else:
                comment_lines += 1
                kinds["block"] += 1
            continue

        before = raw[:pos].strip()
        body = raw[pos + 2:].strip()

        if before:
            kinds["inline"] += 1
            code_lines += 1
        else:
            kinds["line"] += 1
            comment_lines += 1

        for m in ANCHOR.finditer(body):
            anchors.append(m.group(1))

        if TODO.search(body):
            kinds["todo"] += 1
            if not re.search(r"[(#@]", body):
                findings.append({
                    "line": idx, "kind": "todo_orphelin", "len": 1,
                    "hint": "TODO sans issue ni proprietaire",
                })
        elif BANNER.match(raw) or SHOUT.match(raw):
            kinds["banner"] += 1
            findings.append({
                "line": idx, "kind": "banner", "len": 1,
                "hint": "banniere de section — le fichier veut peut-etre etre coupe",
            })
        elif CODE_TOKENS.search(body):
            kinds["commented_code"] += 1
            findings.append({
                "line": idx, "kind": "code_commente", "len": 1,
                "hint": "git conserve l'historique — supprimer",
            })

    total = code_lines + comment_lines
    return {
        "path": path,
        "code_lines": code_lines,
        "comment_lines": comment_lines,
        "ratio": round(comment_lines / total, 3) if total else 0.0,
        "kinds": dict(kinds),
        "findings": findings,
        "anchors": anchors,
    }


def walk(root: str) -> list[str]:
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.endswith(EXTS):
                out.append(os.path.join(dirpath, fn))
    return sorted(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("--max-ratio", type=float, default=0.20,
                    help="ratio commentaires/total au-dela duquel un fichier est signale")
    ap.add_argument("--long-block", type=int, default=8,
                    help="taille de bloc a partir de laquelle migrer vers /docs")
    ap.add_argument("--json", default=None)
    args = ap.parse_args()

    files = walk(args.root)
    if not files:
        print(f"Aucun fichier {'/'.join(EXTS)} sous {args.root}")
        sys.exit(1)

    reports = [scan_file(p, args.long_block) for p in files]

    totals: Counter = Counter()
    all_findings: dict[str, list] = defaultdict(list)
    all_anchors: list[tuple[str, str]] = []
    code = comment = 0

    for r in reports:
        totals.update(r["kinds"])
        code += r["code_lines"]
        comment += r["comment_lines"]
        for f in r["findings"]:
            all_findings[f["kind"]].append((r["path"], f))
        for a in r["anchors"]:
            all_anchors.append((r["path"], a))

    grand = code + comment
    ratio = comment / grand if grand else 0.0
    heavy = sorted(
        [r for r in reports if r["ratio"] > args.max_ratio],
        key=lambda r: -r["ratio"],
    )

    W = 66
    print("\n" + "=" * W)
    print("AUDIT DES COMMENTAIRES")
    print("=" * W)
    print(f"  Fichiers            {len(files)}")
    print(f"  Lignes de code      {code}")
    print(f"  Lignes de comm.     {comment}   ({ratio:.1%})")
    print("-" * W)
    print("  Repartition")
    for k in ("line", "inline", "block", "jsdoc", "todo", "banner", "commented_code"):
        if totals.get(k):
            print(f"    {k:<18} {totals[k]}")

    if heavy:
        print("-" * W)
        print(f"  Fichiers au-dessus de {args.max_ratio:.0%}")
        for r in heavy[:12]:
            print(f"    {r['ratio']:>6.1%}  {r['path']}  ({r['comment_lines']}c / {r['code_lines']}L)")

    labels = {
        "block_long": "Blocs longs — a migrer vers /docs",
        "code_commente": "Code commente — a supprimer",
        "banner": "Bannieres de section",
        "jsdoc_types_only": "JSDoc qui ne fait que repeter les types",
        "todo_orphelin": "TODO sans proprietaire ni issue",
    }
    for kind, label in labels.items():
        items = all_findings.get(kind, [])
        if not items:
            continue
        print("-" * W)
        print(f"  {label}  ({len(items)})")
        for path, f in items[:10]:
            print(f"    {path}:{f['line']}  {f['hint']}")
        if len(items) > 10:
            print(f"    ... et {len(items) - 10} autres")

    if all_anchors:
        print("-" * W)
        print(f"  Ancres vers /docs  ({len(all_anchors)})")
        for path, a in all_anchors[:10]:
            print(f"    {path} -> {a}")
        print("    (valider avec check_docs_links.py --src)")

    print("=" * W + "\n")

    if args.json:
        with open(args.json, "w") as f:
            json.dump({"totals": dict(totals), "ratio": ratio,
                       "files": reports}, f, indent=2)
        print(f"[audit] rapport JSON -> {args.json}\n")

    blocking = len(all_findings.get("code_commente", [])) + len(heavy)
    sys.exit(1 if blocking else 0)


if __name__ == "__main__":
    main()
