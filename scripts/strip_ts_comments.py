"""Deterministic TS/TSX/JS comment stripper.

Walks each file character-by-character with a small state machine so string
literals, template literals (including ``${...}`` interpolations), and JSDoc
blocks are all respected. Strips body comments while keeping function-level
documentation and tool directives intact.

Rules
-----
* Strip every ``//`` line comment EXCEPT the following tool directives that
  toolchains read literally and must survive: ``// @ts-ignore``,
  ``// @ts-expect-error``, ``// @ts-nocheck``, ``// eslint-disable*``,
  ``// eslint-enable*``, ``// prettier-ignore``, ``// biome-ignore``,
  ``// istanbul ignore*``, ``// c8 ignore*``, ``// v8 ignore*``,
  ``// tslint:*``, ``// NOSONAR``.
* Strip every ``/* ... */`` block comment EXCEPT JSDoc (``/** */``) and
  webpack/bundler magic comments such as ``/* webpackChunkName: "..." */``,
  ``/*! ... */`` license blocks, and ``/* @preserve */`` / ``/* @license */``.
* Collapse multiple consecutive blank lines down to one; remove a blank line
  directly after ``{`` and directly before ``}``.
* JSX comments ``{/* ... */}`` reduce to ``{ }`` — a valid empty JSX
  expression slot that renders nothing.

Idempotent: running twice produces the same output as running once.
"""
from __future__ import annotations

import sys
from pathlib import Path

_LINE_DIRECTIVES = (
    '@ts-ignore', '@ts-expect-error', '@ts-nocheck',
    'eslint-disable', 'eslint-enable',
    'prettier-ignore', 'biome-ignore',
    'istanbul ignore', 'c8 ignore', 'v8 ignore',
    'tslint:', 'nosonar',
)

_BLOCK_DIRECTIVES = (
    'webpackchunkname', 'webpackinclude', 'webpackexclude',
    'webpackmode', 'webpackprefetch', 'webpackpreload',
    'webpackignore',
    '@preserve', '@license',
    'eslint-disable', 'eslint-enable',
    'istanbul ignore', 'c8 ignore', 'v8 ignore',
)


def _is_line_directive(text: str) -> bool:
    body = text.lstrip('/').strip().lower()
    return any(body.startswith(d) for d in _LINE_DIRECTIVES)


def _is_block_directive(text: str) -> bool:
    body = text[2:-2].strip().lower() if text.endswith('*/') else text[2:].strip().lower()
    if text.startswith('/*!'):
        return True
    return any(d in body for d in _BLOCK_DIRECTIVES)


def strip_comments(src: str) -> str:
    out: list[str] = []
    i = 0
    n = len(src)

    while i < n:
        c = src[i]

        if c == '`':
            out.append(c)
            i += 1
            while i < n:
                if src[i] == '\\' and i + 1 < n:
                    out.append(src[i])
                    out.append(src[i + 1])
                    i += 2
                    continue
                if src[i] == '`':
                    out.append(src[i])
                    i += 1
                    break
                if src[i] == '$' and i + 1 < n and src[i + 1] == '{':
                    out.append('${')
                    i += 2
                    depth = 1
                    while i < n and depth > 0:
                        if src[i] == '{':
                            depth += 1
                        elif src[i] == '}':
                            depth -= 1
                            if depth == 0:
                                out.append(src[i])
                                i += 1
                                break
                        out.append(src[i])
                        i += 1
                    continue
                out.append(src[i])
                i += 1
            continue

        if c == '"':
            out.append(c)
            i += 1
            while i < n:
                if src[i] == '\\' and i + 1 < n:
                    out.append(src[i])
                    out.append(src[i + 1])
                    i += 2
                    continue
                if src[i] == '"':
                    out.append(src[i])
                    i += 1
                    break
                if src[i] == '\n':
                    break
                out.append(src[i])
                i += 1
            continue

        if c == "'":
            out.append(c)
            i += 1
            while i < n:
                if src[i] == '\\' and i + 1 < n:
                    out.append(src[i])
                    out.append(src[i + 1])
                    i += 2
                    continue
                if src[i] == "'":
                    out.append(src[i])
                    i += 1
                    break
                if src[i] == '\n':
                    break
                out.append(src[i])
                i += 1
            continue

        if c == '/' and i + 1 < n and src[i + 1] == '/':
            j = i
            while j < n and src[j] != '\n':
                j += 1
            comment_text = src[i:j]
            if _is_line_directive(comment_text):
                out.append(comment_text)
            i = j
            continue

        if c == '/' and i + 1 < n and src[i + 1] == '*':
            is_jsdoc = i + 2 < n and src[i + 2] == '*' and (i + 3 >= n or src[i + 3] != '/')
            j = i + 2
            while j + 1 < n and not (src[j] == '*' and src[j + 1] == '/'):
                j += 1
            j = min(j + 2, n)
            comment_text = src[i:j]
            if is_jsdoc or _is_block_directive(comment_text):
                out.append(comment_text)
            i = j
            continue

        out.append(c)
        i += 1

    return ''.join(out)


def collapse_blank_lines(src: str) -> str:
    lines = [line.rstrip() for line in src.split('\n')]
    pass1: list[str] = []
    blank_run = 0
    for line in lines:
        if line == '':
            blank_run += 1
            if blank_run <= 1:
                pass1.append(line)
        else:
            blank_run = 0
            pass1.append(line)

    pass2: list[str] = []
    for line in pass1:
        if (
            line == ''
            and pass2
            and pass2[-1].rstrip().endswith('{')
        ):
            continue
        if (
            line.lstrip().startswith('}')
            and pass2
            and pass2[-1] == ''
        ):
            pass2.pop()
        pass2.append(line)

    return '\n'.join(pass2)


def process(path: Path) -> bool:
    src = path.read_text(encoding='utf-8')
    cleaned = collapse_blank_lines(strip_comments(src))
    if cleaned != src:
        path.write_text(cleaned, encoding='utf-8')
        return True
    return False


def main(argv: list[str]) -> int:
    extensions = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}
    skip_dirs = {'node_modules', '.next', '.git', 'dist', 'build', 'coverage'}
    changed = 0
    seen = 0
    for arg in argv:
        path = Path(arg)
        if path.is_dir():
            for p in path.rglob('*'):
                if not p.is_file() or p.suffix not in extensions:
                    continue
                if any(part in skip_dirs for part in p.parts):
                    continue
                seen += 1
                if process(p):
                    changed += 1
        elif path.is_file() and path.suffix in extensions:
            seen += 1
            if process(path):
                changed += 1
    print(f'scanned {seen} file(s); cleaned {changed}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
