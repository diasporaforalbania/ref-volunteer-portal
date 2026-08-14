#!/bin/zsh
set -euo pipefail

cd "${0:A:h}"

/Users/gledguri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 render_titles_45.py

ffmpeg -y \
  -loop 1 -t 9 -i assets-45/01-pergatitja.png \
  -loop 1 -t 9 -i assets-45/02-check-in-ekipi.png \
  -loop 1 -t 9 -i assets-45/03-karta-formulari.png \
  -loop 1 -t 9 -i assets-45/04-privatesia-incidenti.png \
  -loop 1 -t 9 -i assets-45/05-dorezimi-raportimi.png \
  -loop 1 -t 9 -i titles-45/01.png \
  -loop 1 -t 9 -i titles-45/02.png \
  -loop 1 -t 9 -i titles-45/03.png \
  -loop 1 -t 9 -i titles-45/04.png \
  -loop 1 -t 9 -i titles-45/05.png \
  -i audio/narration-45-sq-AL-AnilaNeural.mp3 \
  -filter_complex "[0:v]scale=2048:1152,crop=1920:1080:x='64+18*sin(t/3)':y='36+10*cos(t/3)',fade=t=in:st=0:d=0.45,fade=t=out:st=8.55:d=0.45[b0];[1:v]scale=2048:1152,crop=1920:1080:x='64-18*sin(t/3)':y='36+10*sin(t/3)',fade=t=in:st=0:d=0.45,fade=t=out:st=8.55:d=0.45[b1];[2:v]scale=2048:1152,crop=1920:1080:x='64+20*sin(t/3)':y='36-8*sin(t/3)',fade=t=in:st=0:d=0.45,fade=t=out:st=8.55:d=0.45[b2];[3:v]scale=2048:1152,crop=1920:1080:x='64-20*sin(t/3)':y='36+8*cos(t/3)',fade=t=in:st=0:d=0.45,fade=t=out:st=8.55:d=0.45[b3];[4:v]scale=2048:1152,crop=1920:1080:x='64+18*sin(t/3)':y='36+10*cos(t/3)',fade=t=in:st=0:d=0.45,fade=t=out:st=8.55:d=0.45[b4];[b0][5:v]overlay[v0];[b1][6:v]overlay[v1];[b2][7:v]overlay[v2];[b3][8:v]overlay[v3];[b4][9:v]overlay[v4];[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0,format=yuv420p[v];[10:a]atempo=1.04,apad=pad_dur=45,atrim=0:45,afade=t=out:st=43.8:d=1.0[a]" \
  -map "[v]" -map "[a]" -t 45 -r 30 \
  -c:v libx264 -preset medium -crf 18 -profile:v high -level 4.1 \
  -c:a aac -b:a 192k -movflags +faststart \
  nje-dite-si-ndihmes-45sek-shqip-Anila.mp4

ffmpeg -y -ss 00:00:22 -i nje-dite-si-ndihmes-45sek-shqip-Anila.mp4 \
  -frames:v 1 -update 1 frames-45/preview.png
