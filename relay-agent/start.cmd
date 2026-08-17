@echo off
cd /d "%~dp0"
title Sanjar Patir Relay Agent
echo.
echo  Agent fayllari yangilanmoqda...
set "BASE=https://raw.githubusercontent.com/sanjarpatirtizimi/tizimerp/main/relay-agent"
for %%F in (index.js prepare-face-jpeg.js hikvision-multipart.js acs-events.js sync-agent-files.js) do (
  curl -fsSL -o "%%F.new" "%BASE%/%%F" && move /Y "%%F.new" "%%F" >nul
)
echo.
echo  Relay Agent ishga tushmoqda...
echo  Oynani YOPMANG.
echo.
call npm start
echo.
echo Agent toxtadi. Xato bolsa yuqoridagi matnni oqing.
pause
