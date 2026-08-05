@echo off
chcp 65001 >nul
setlocal enableextensions

title OpenCut Classic - Khoi dong

echo.
echo ============================================================
echo                 MO OPEN CUT CLASSIC  -  1 NHAP CHUOT
echo ============================================================
echo.

REM ============================================================
REM BUOC 1: TIM PHAN MEM BUN VA ELECTRON GUI
REM ============================================================
echo [1/4] Dang kiem tra phan mem ...

set "BUN_CMD="

for /f "delims=" %%i in ('where bun 2^>nul') do (
    set "BUN_CMD=%%i"
    goto :found_bun
)

if exist "%USERPROFILE%\.bun\bin\bun.exe" (
    set "BUN_CMD=%USERPROFILE%\.bun\bin\bun.exe"
    goto :found_bun
)

echo.
echo [!] MAY NAY CHUA CAI "Bun" runtime.
echo     Dang tien hanh tu dong tai va cai dat Bun cho Windows...
echo     Vui long cho trong giay lat...
echo.

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; irm bun.sh/install.ps1 | iex"

if exist "%USERPROFILE%\.bun\bin\bun.exe" (
    set "BUN_CMD=%USERPROFILE%\.bun\bin\bun.exe"
    echo.
    echo     [OK] Da tu dong tai va cai dat Bun thanh cong!
    echo.
    goto :found_bun
)

echo.
echo [!] Khong the tu dong cai dat Bun.
echo     Trang web huong dan cai dat se tu dong mo.
echo     Vui long tu cai dat Bun, sau do dong cua so nay va chay lai OpenCut.bat.
start "" "https://bun.sh/docs/installation"
pause
exit /b 1

:found_bun
echo     Da tim thay Bun: %BUN_CMD%
echo.

cd /d "%~dp0"

for %%i in ("%BUN_CMD%") do set "BUN_DIR=%%~dpi"
if "%BUN_DIR:~-1%"=="\" set "BUN_DIR=%BUN_DIR:~0,-1%"
set "PATH=%BUN_DIR%;%PATH%"

set "ELECTRON_EXE="
if exist "node_modules\electron\dist\electron.exe" set "ELECTRON_EXE=node_modules\electron\dist\electron.exe"
if exist "apps\web\node_modules\electron\dist\electron.exe" set "ELECTRON_EXE=apps\web\node_modules\electron\dist\electron.exe"

REM Giai phong cong 3000 neu co tien trinh cu dang chay ngam
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM ============================================================
REM BUOC 2: KIEM TRA THU VIEN (node_modules)
REM ============================================================
echo [2/4] Dang kiem tra thu vien ...

set "NEED_INSTALL=0"
if not exist "node_modules" set "NEED_INSTALL=1"
if not exist "apps\web\node_modules" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
    echo     Chua co thu vien. Dang cai dat ...
    call "%BUN_CMD%" install
    if errorlevel 1 (
        echo [!] CAI DAT THU VIEN THAT BAI.
        pause
        exit /b 1
    )
    echo     Da cai dat thu vien xong.
) else (
    echo     Da co san thu vien.
)
echo.

REM ============================================================
REM BUOC 3: KIEM TRA FILE CAU HINH (.env.local)
REM ============================================================
echo [3/4] Dang kiem tra file cau hinh ...

if not exist "apps\web\.env.local" (
    if exist "apps\web\.env.example" (
        copy /y "apps\web\.env.example" "apps\web\.env.local" >nul
        echo     Da tao file ".env.local" tu file mau.
    )
) else (
    echo     Da co file ".env.local".
)
echo.

REM ============================================================
REM BUOC 4: KHOI DONG UNG DUNG DESKTOP PC & TAT BANG CMD
REM ============================================================
echo [4/4] Dang khoi dong OpenCut PC App...
echo     Cua so CMD nay se TU DONG TAT ngay sau khi mo app PC.
echo ============================================================
echo.

REM Tao VBS script de chay web server ngam 100% hoan toan
if not exist "scripts" mkdir "scripts"
echo Set WshShell = CreateObject("WScript.Shell") > "scripts\launch_server.vbs"
echo WshShell.Run "cmd /c cd /d """ ^& WshShell.CurrentDirectory ^& """ && bun run dev:web", 0, False >> "scripts\launch_server.vbs"

wscript "scripts\launch_server.vbs"

REM Mo ung dung GUI Electron truc tiep
if defined ELECTRON_EXE (
    start "" "%ELECTRON_EXE%" apps\web
) else (
    start "" "%BUN_CMD%" run desktop
)

REM Tu dong tat cua so CMD ngay lap tuc
exit
