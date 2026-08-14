#!/usr/bin/env bash
# ============================================================================
# KLIKO-PER-PDF.command — kliko dy herë mbi këtë skedar për të prodhuar PDF-në.
#
# Pse ekziston ky skedar dhe jo thjesht `render-pdf.sh`:
# macOS-i NUK e ekzekuton një skedar `.sh` kur klikohet dy herë — e hap te
# një redaktues teksti. Vetëm prapashtesa `.command` hapet te Terminali.
# Ky skedar është thjesht një mbështjellës: punën e vërtetë e bën render-pdf.sh.
#
# Nga terminali përdorni drejtpërdrejt:  ./render-pdf.sh
# ============================================================================

cd "$(dirname "$0")"

echo "════════════════════════════════════════════════════════"
echo "  Referendum 21/2024 — prodhimi i PDF-së"
echo "════════════════════════════════════════════════════════"
echo

if ./render-pdf.sh "$@"; then
  echo
  echo "PDF-ja u prodhua te:"
  echo "  $(pwd)"
else
  echo
  echo "────────────────────────────────────────────────────────"
  echo "NUK U PRODHUA PDF-ja. Shkaku është shkruar më sipër."
  echo
  echo "Shkaqet e zakonshme:"
  echo "  • mungon pandoc-u   →  brew install pandoc"
  echo "  • mungon LaTeX-i    →  brew install --cask basictex"
  echo "    (pas instalimit të BasicTeX, mbyllni dhe rihapni Terminalin)"
  echo "────────────────────────────────────────────────────────"
fi

echo
echo "Shtypni Enter për ta mbyllur këtë dritare."
read -r
