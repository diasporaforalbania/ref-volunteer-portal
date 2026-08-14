#!/bin/zsh
set -euo pipefail

cd "${0:A:h}"

/Users/gledguri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 render_titles.py
if [[ ! -s audio/narration.aiff ]]; then
  /usr/bin/say -v Samantha -r 180 -f narration.txt -o audio/narration.aiff
fi

ffmpeg -y \
  -loop 1 -t 10 -i assets/01-mengjesi.png \
  -loop 1 -t 10 -i assets/02-ekipi.png \
  -loop 1 -t 10 -i assets/03-biseda.png \
  -loop 1 -t 10 -i assets/04-siguria.png \
  -loop 1 -t 10 -i assets/05-dorezimi.png \
  -loop 1 -t 10 -i assets/06-mbyllja.png \
  -loop 1 -t 10 -i titles/01.png \
  -loop 1 -t 10 -i titles/02.png \
  -loop 1 -t 10 -i titles/03.png \
  -loop 1 -t 10 -i titles/04.png \
  -loop 1 -t 10 -i titles/05.png \
  -loop 1 -t 10 -i titles/06.png \
  -i audio/narration.aiff \
  -filter_complex "[0:v]scale=2048:1152,crop=1920:1080:x='64+18*sin(t/3)':y='36+10*cos(t/3)',fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[b0];[1:v]scale=2048:1152,crop=1920:1080:x='64-18*sin(t/3)':y='36+10*sin(t/3)',fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[b1];[2:v]scale=2048:1152,crop=1920:1080:x='64+20*sin(t/3)':y='36-8*sin(t/3)',fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[b2];[3:v]scale=2048:1152,crop=1920:1080:x='64-20*sin(t/3)':y='36+8*cos(t/3)',fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[b3];[4:v]scale=2048:1152,crop=1920:1080:x='64+18*sin(t/3)':y='36+10*cos(t/3)',fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[b4];[5:v]scale=2048:1152,crop=1920:1080:x='64-18*sin(t/3)':y='36+10*sin(t/3)',fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[b5];[b0][6:v]overlay[v0];[b1][7:v]overlay[v1];[b2][8:v]overlay[v2];[b3][9:v]overlay[v3];[b4][10:v]overlay[v4];[b5][11:v]overlay[v5];[v0][v1][v2][v3][v4][v5]concat=n=6:v=1:a=0,format=yuv420p[v];[12:a]atempo=1.1,apad=pad_dur=60,atrim=0:60,afade=t=out:st=58:d=2[a]" \
  -map "[v]" -map "[a]" -t 60 -r 30 \
  -c:v libx264 -preset medium -crf 18 -profile:v high -level 4.1 \
  -c:a aac -b:a 192k -movflags +faststart \
  nje-dite-si-ndihmes.mp4

ffmpeg -y -ss 00:00:27 -i nje-dite-si-ndihmes.mp4 -frames:v 1 -update 1 frames/preview.png
