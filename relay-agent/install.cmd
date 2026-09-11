@echo off
setlocal
cd /d "%~dp0"

echo.
echo  ========================================
echo   Sanjar Patir ^| Relay Agent o'rnatish
echo  ========================================
echo.

:: Node.js borligini tekshirish
where node >nul 2>&1
if errorlevel 1 (
    echo  [XATO] Node.js topilmadi.
    echo  https://nodejs.org dan LTS versiyasini o'rnating, keyin qaytadan ishlatina.
    echo.
    pause
    exit /b 1
)

:: .env fayli borligini tekshirish
if not exist ".env" (
    echo  [XATO] .env fayli topilmadi.
    echo  ".env.example" faylini ".env" ga ko'chiring va to'ldiring.
    echo.
    if exist ".env.example" (
        echo  Misol uchun .env.example mazmuni:
        type .env.example
    )
    echo.
    pause
    exit /b 1
)

:: npm o'rnatish (kerak bo'lsa)
if not exist "node_modules" (
    echo  Kutubxonalar yuklanmoqda (bir marta)...
    call npm install --omit=dev
    if errorlevel 1 (
        echo  [XATO] npm install muvaffaqiyatsiz.
        pause
        exit /b 1
    )
    echo.
)

:: Task Scheduler da ro'yxatdan o'tkazish
echo  Windows Task Scheduler ga qo'shilmoqda...

set "VBS_PATH=%~dp0start-hidden.vbs"
set "TASK_NAME=SanjarPatirRelayAgent_%~n0"

:: Avval o'chirish (agar allaqachon bor bo'lsa)
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

:: Yangi task yaratish (login bo'lganda ishga tushadi, oyna ko'rinmaydi)
schtasks /create ^
    /tn "%TASK_NAME%" ^
    /tr "wscript.exe \"%VBS_PATH%\"" ^
    /sc ONLOGON ^
    /rl HIGHEST ^
    /f >nul

if errorlevel 1 (
    echo.
    echo  [XATO] Task qo'shib bo'lmadi. Administrator sifatida ishlatib ko'ring.
    echo  (Fayl ustiga o'ng klik ^> "Run as administrator")
    echo.
    pause
    exit /b 1
)

echo.
echo  ========================================
echo   [OK] Muvaffaqiyatli o'rnatildi!
echo  ========================================
echo.
echo  Nima bo'ladi endi:
echo    - Kompyuter yoqilganda agent o'zi ishga tushadi
echo    - Oyna ko'rinmaydi (fon rejimda ishlaydi)
echo    - Loglar: https://sanjarpatir.onrender.com/staff/agents
echo.
echo  Hoziroq ishga tushurish uchun: start.cmd ni ikki marta bosing
echo  Bekor qilish uchun:           uninstall.cmd ni ikki marta bosing
echo.
pause
endlocal
