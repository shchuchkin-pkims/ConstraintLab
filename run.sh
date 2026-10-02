#!/bin/sh
# Запуск ConstraintLab в отдельном окне (режим приложения Chrome/Chromium/Edge),
# при их отсутствии – в браузере по умолчанию.
DIR="$(cd "$(dirname "$0")" && pwd)"
URL="file://$DIR/index.html"
for b in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser; do
  if command -v "$b" >/dev/null 2>&1; then
    exec "$b" --app="$URL" --window-size=1500,950 >/dev/null 2>&1
  fi
done
if command -v xdg-open >/dev/null 2>&1; then exec xdg-open "$URL"; fi
if command -v open >/dev/null 2>&1; then exec open "$URL"; fi
echo "Open in a browser / Откройте в браузере: $URL"
