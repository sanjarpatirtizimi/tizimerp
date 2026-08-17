@echo off
cd /d "%~dp0"
echo Relay agent yangilanmoqda (PicFeaturePoints tuzatishi)...
set "BASE=https://raw.githubusercontent.com/sanjarpatirtizimi/tizimerp/cursor/fix-relay-face-jpeg-2ec4/relay-agent"
for %%F in (index.js prepare-face-jpeg.js hikvision-multipart.js sync-agent-files.js) do (
  curl -fsSL -o "%%F.new" "%BASE%/%%F" && move /Y "%%F.new" "%%F" >nul && echo   %%F ok
)
echo.
echo Tayyor. Endi start.cmd yoki npm start ni ishga tushiring.
pause
