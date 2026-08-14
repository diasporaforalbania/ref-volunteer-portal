#!/usr/bin/env bash
# ============================================================================
# render-pdf.sh — kthen STRUKTURA_DHE_ROLET.md në PDF.
#
#   ./render-pdf.sh                        # rendon STRUKTURA_DHE_ROLET.md
#   ./render-pdf.sh dokument-tjeter.md     # rendon çdo .md tjetër
#
# Kërkon: pandoc + një motor LaTeX (xelatex / lualatex / tectonic).
#   macOS:  brew install pandoc && brew install --cask basictex
#   Ubuntu: sudo apt install pandoc texlive-xetex texlive-fonts-recommended
#
# XeLaTeX-i (jo pdflatex) është i domosdoshëm për dy arsye:
#   1. shkronjat shqipe ë/ç dalin drejt vetëm me font Unicode;
#   2. diagramet janë me karaktere vizatimi (┌ │ └ ─ ┬), të cilat i ka vetëm
#      një font monospace i vërtetë sistemi (Menlo/DejaVu), jo Latin Modern.
# ============================================================================
set -euo pipefail

# Shko te dosja e vetë skedarit. Pa këtë rresht, skripti punon vetëm kur e nis
# nga terminali brenda dosjes: i nisur nga Finder-i, ai fillon te dosja e
# përdoruesit (~) dhe nuk e gjen dot .md-në.
cd "$(dirname "$0")"

SRC="${1:-STRUKTURA_DHE_ROLET.md}"
OUT="${SRC%.md}.pdf"

# ---- kontrollet paraprake ---------------------------------------------------
command -v pandoc >/dev/null 2>&1 || {
  echo "GABIM: pandoc nuk u gjet. Instaloje: brew install pandoc" >&2; exit 1; }

[ -f "$SRC" ] || { echo "GABIM: nuk gjendet '$SRC'" >&2; exit 1; }

ENGINE=""
for e in xelatex lualatex tectonic; do
  if command -v "$e" >/dev/null 2>&1; then ENGINE="$e"; break; fi
done
[ -n "$ENGINE" ] || {
  echo "GABIM: asnjë motor LaTeX. Instaloje: brew install --cask basictex" >&2
  echo "       (pas instalimit hap një terminal të ri, që PATH-i të rifreskohet)" >&2
  exit 1; }

# ---- fontet -----------------------------------------------------------------
# Dy kushte, të dyja të domosdoshme:
#   • fonti kryesor duhet të ketë → (U+2192) dhe ✓ (U+2713). Helvetica Neue
#     NUK i ka: matrica e të drejtave do të dilte krejt bosh.
#   • fonti monospace duhet të ketë karakteret e vizatimit (┌ │ └ ─ ┬ ╔ ═).
if [ "$(uname)" = "Darwin" ]; then
  MAIN="Lucida Grande"; MONO="Menlo"
else
  MAIN="DejaVu Sans";   MONO="DejaVu Sans Mono"
fi

echo "→ burimi : $SRC"
echo "→ motori : $ENGINE"
echo "→ fontet : $MAIN / $MONO"

# ---- rendërimi --------------------------------------------------------------
# Metadata (titulli, TOC, faqosja, ngjyrat) rrijnë te kreu YAML i vetë .md-së;
# këtu jepen vetëm fontet, që skedari të mbetet i rendueshëm edhe në Linux.
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

pandoc "$SRC" \
  --output="$OUT" \
  --pdf-engine="$ENGINE" \
  --variable=mainfont:"$MAIN" \
  --variable=monofont:"$MONO" \
  --variable=monofontoptions:"Scale=0.82" \
  --variable=fontsize:10pt \
  --highlight-style=tango \
  --table-of-contents \
  --toc-depth=3 2>&1 | tee "$LOG"

# ---- kontrolli i shkronjave që mungojnë -------------------------------------
# Një shkronjë që mungon nuk e ndal rendërimin — ajo thjesht del BOSH në PDF.
# Prandaj kontrollohet me dorë: më mirë një paralajmërim se një tabelë e zbrazët.
MISSING="$(grep -c 'Missing character' "$LOG" || true)"
if [ "$MISSING" -gt 0 ]; then
  echo
  echo "KUJDES: $MISSING shkronja mungojnë te fonti '$MAIN' — do të dalin bosh:"
  grep -oE 'There is no .' "$LOG" | sort -u | sed 's/^/   /'
  echo "   Zgjidhja: zëvendëso MAIN te ky skedar me një font me mbulim të plotë."
fi

echo "✓ U krijua: $OUT  ($(du -h "$OUT" | cut -f1))"
