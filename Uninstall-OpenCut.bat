@echo off
chcp 65001 >nul
setlocal enableextensions

title OpenCut Classic - Gỡ cài đặt và Dọn dẹp tự động 1-Click

echo.
echo ============================================================
echo   ĐANG TIẾN HÀNH GỠ CÀI ĐẶT & DỌN DẸP TOÀN BỘ HỆ THỐNG...
echo ============================================================
echo.

REM 1. DỪNG CÁC TIẾN TRÌNH CHAY NGẦM
echo [1/4] Đang dừng các tiến trình (Electron, Next.js, Bun)...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM bun.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo      [OK] Đã dừng tất cả các tiến trình chạy ngầm.
echo.

REM 2. XÓA THƯ VIỆN DỰ ÁN
echo [2/4] Đang xóa thư viện tạm thời (node_modules, .next) - Vui lòng đợi trong giây lát...
if exist "node_modules" (
    rmdir /s /q "node_modules" >nul 2>&1
)
if exist "apps\web\node_modules" (
    rmdir /s /q "apps\web\node_modules" >nul 2>&1
)
if exist "apps\web\.next" (
    rmdir /s /q "apps\web\.next" >nul 2>&1
)
echo      [OK] Đã xóa sạch thư mục node_modules và cache build .next.
echo.

REM 3. XÓA CẤU HÌNH TẠM
echo [3/4] Đang xóa các file cấu hình và script tạm thời...
if exist "apps\web\.env.local" (
    del /f /q "apps\web\.env.local" >nul 2>&1
)
if exist "scripts\launch_server.vbs" (
    del /f /q "scripts\launch_server.vbs" >nul 2>&1
)
echo      [OK] Đã xóa file .env.local và launch_server.vbs.
echo.

REM 4. XÓA APPDATA VÀ CACHE OPENCUT
echo [4/4] Đang xóa dữ liệu ứng dụng và bộ nhớ đệm (AppData & Cache)...
if exist "%APPDATA%\OpenCut Classic" (
    rmdir /s /q "%APPDATA%\OpenCut Classic" >nul 2>&1
)
if exist "data" (
    rmdir /s /q "data" >nul 2>&1
)
echo      [OK] Đã xóa sạch dữ liệu AppData và bộ nhớ đệm Cache.
echo.

echo ============================================================
echo    🎉 ĐÃ GỠ CÀI ĐẶT & DỌN DẸP SẠCH SẼ TOÀN BỘ DỰ ÁN!
echo    Cửa sổ này sẽ tự động đóng sau 3 giây...
echo ============================================================
echo.
timeout /t 3 >nul
exit
