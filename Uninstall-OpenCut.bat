@echo off
chcp 65001 >nul
setlocal enableextensions

title OpenCut Classic - Go cai dat va Don dep tu dong 1-Click

echo.
echo ============================================================
echo   DANG TIEN HANH GO CAI DAT ^& DON DEP TOAN BO HE THONG...
echo ============================================================
echo.

REM 1. DUNG CAC TIEN TRINH CHAY NGAM
echo [1/4] Dang dung cac tien trinh (Electron, Next.js, Bun)...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM bun.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo      [OK] Da dung tat ca cac tien trinh chay ngam.
echo.

REM 2. XOA THU VIEN DU AN
echo [2/4] Dang xoa thu vien tam thoi (node_modules, .next) - Vui long cho trong giay lat...
if exist "node_modules" (
    rmdir /s /q "node_modules" >nul 2>&1
)
if exist "apps\web\node_modules" (
    rmdir /s /q "apps\web\node_modules" >nul 2>&1
)
if exist "apps\web\.next" (
    rmdir /s /q "apps\web\.next" >nul 2>&1
)
echo      [OK] Da xoa sach thu muc node_modules va cache build .next.
echo.

REM 3. XOA CAU HINH TAM
echo [3/4] Dang xoa cac file cau hinh va script tam thoi...
if exist "apps\web\.env.local" (
    del /f /q "apps\web\.env.local" >nul 2>&1
)
if exist "scripts\launch_server.vbs" (
    del /f /q "scripts\launch_server.vbs" >nul 2>&1
)
echo      [OK] Da xoa file .env.local va launch_server.vbs.
echo.

REM 4. XOA APPDATA VAI CACHE OPENCUT
echo [4/4] Dang xoa du lieu ung dung va bo nho dem (AppData ^& Cache)...
if exist "%APPDATA%\OpenCut Classic" (
    rmdir /s /q "%APPDATA%\OpenCut Classic" >nul 2>&1
)
if exist "data" (
    rmdir /s /q "data" >nul 2>&1
)
echo      [OK] Da xoa sach du lieu AppData va bo nho dem Cache.
echo.

echo ============================================================
echo    DA GO CAI DAT ^& DON DEP SACH SE TOAN BO DU AN!
echo    Cua so nay se tu dong dong sau 3 giay...
echo ============================================================
echo.
ping 127.0.0.1 -n 4 >nul
exit