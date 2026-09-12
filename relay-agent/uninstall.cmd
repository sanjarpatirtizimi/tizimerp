@echo off
cd /d "%~dp0"

echo.
echo  Sanjar Patir Relay Agent — avtomatik ishga tushishni o'chirish
echo.

set "TASK_NAME=SanjarPatirRelayAgent_%~n0"

:: Avval ishlab turgan node jarayonini to'xtatish
echo  Ishlab turgan agent to'xtatilmoqda...
taskkill /f /im node.exe >nul 2>&1

:: Task Scheduler dan o'chirish
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

if errorlevel 1 (
    echo  Task topilmadi (allaqachon o'chirilgan bo'lishi mumkin).
) else (
    echo  [OK] Avtomatik ishga tushish o'chirildi.
)

echo.
echo  Endi kompyuter yoqilganda agent o'zi ishlamaydi.
echo  Qayta o'rnatish uchun: install.cmd ni ikki marta bosing.
echo.
pause
