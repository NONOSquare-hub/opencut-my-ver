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

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; irm bun.sh/install.ps1 | iex"

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

REM ============================================================
REM KIEM TRA MICROSOFT VISUAL C++ REDISTRIBUTABLE (MSVC Runtime)
REM ============================================================
set "HAS_VC_REDIST=1"
if not exist "%SystemRoot%\System32\vcruntime140.dll" set "HAS_VC_REDIST=0"
if not exist "%SystemRoot%\System32\msvcp140.dll" set "HAS_VC_REDIST=0"

if "%HAS_VC_REDIST%"=="0" (
    echo [!] MAY NAY THIEU THU VIEN MICROSOFT VISUAL C++ REDISTRIBUTABLE.
    echo     Day la thu vien bat buoc de chay Electron va cac native module tren Windows.
    echo     Dang tai va tu dong mo trinh cai dat...
    echo     Vui long chon 'Yes' khi he thong hoi quyen Administrator UAC.
    echo.
    
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile '$env:TEMP\vc_redist.x64.exe'; Start-Process -FilePath '$env:TEMP\vc_redist.x64.exe' -ArgumentList '/install /passive /norestart' -Verb RunAs -Wait"
    
    echo.
    echo ============================================================
    echo [OK] DA KICH HOAT CAI DAT VISUAL C++ REDISTRIBUTABLE!
    echo ============================================================
    echo De Windows cap nhat va nhan dien thu vien moi:
    echo   1. Vui long DONG cua so CMD nay.
    echo   2. Nhap dup chuot KHOI DONG LAI file "OpenCut.bat".
    echo ============================================================
    echo.
    pause
    exit
)

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

REM Kiem tra neu node_modules da co nhung thieu Electron binary do loi truoc do
if "%NEED_INSTALL%"=="0" (
    if not exist "node_modules\electron\dist\electron.exe" (
        if not exist "apps\web\node_modules\electron\dist\electron.exe" (
            echo     [!] Phat hien node_modules bi thieu Electron binary do loi thieu VC truoc do.
            set "NEED_INSTALL=1"
            echo     Dang don dep node_modules loi de chuan bi tai lai...
            if exist "node_modules" rmdir /s /q "node_modules" >nul 2>&1
            if exist "apps\web\node_modules" rmdir /s /q "apps\web\node_modules" >nul 2>&1
        )
    )
)

if "%NEED_INSTALL%"=="1" (
    echo     Chua co thu vien. Dang tien hanh cai dat ...
    call "%BUN_CMD%" install
    if errorlevel 1 (
        echo [!] CAI DAT THU VIEN THAT BAI.
        pause
        exit /b 1
    )
    
    REM Cap nhat lai ELECTRON_EXE sau khi cai dat thanh cong
    if exist "node_modules\electron\dist\electron.exe" set "ELECTRON_EXE=node_modules\electron\dist\electron.exe"
    if exist "apps\web\node_modules\electron\dist\electron.exe" set "ELECTRON_EXE=apps\web\node_modules\electron\dist\electron.exe"
    
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

REM Mo ung dung GUI Electron truc tiep (chay dong bo de hien thi log neu bi crash hoac loi)
if defined ELECTRON_EXE (
    call "%ELECTRON_EXE%" apps\web
) else (
    call "%BUN_CMD%" run desktop
)

REM Giu lai cua so CMD neu xay ra loi khi chay Electron
if errorlevel 1 (
    echo.
    echo [!] KHOI DONG UNG DUNG DESKTOP APPLICATION BI LOI HOAC CRASH.
    echo     Vui long kiem tra cac dong thong bao loi o tren de biet nguyen nhan.
    pause
)

exit
