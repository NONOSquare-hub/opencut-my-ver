@echo off
chcp 65001 >nul
setlocal enableextensions

title OpenCut Classic - Gỡ cài đặt & Dọn dẹp môi trường

echo.
echo ============================================================
echo         GỠ CÀI ĐẶT & DỌN DẸP MÔI TRƯỜNG OPENCUT CLASSIC
echo ============================================================
echo.
echo Script này sẽ thực hiện các công việc sau:
echo   1. Tắt tất cả tiến trình đang chạy ngầm (Electron, Next.js server, Bun).
echo   2. Xóa các thư mục thư viện tạm thời rất nặng (node_modules, .next).
echo   3. Xóa các file cấu hình và script khởi động tạm thời (.env.local, launch_server.vbs).
echo   4. Tùy chọn xóa toàn bộ dữ liệu dự án và bộ nhớ đệm (Cache) của OpenCut trong hệ thống.
echo.

set /p CONFIRM="Bạn có chắc chắn muốn tiếp tục dọn dẹp không? (Y/N): "
if /i "%CONFIRM%" neq "Y" (
    echo Hủy bỏ quá trình dọn dẹp.
    pause
    exit /b 0
)

echo.
echo ============================================================
echo [1/4] Đang dừng tất cả tiến trình liên quan...
echo ============================================================
REM Tắt Electron
taskkill /F /IM electron.exe >nul 2>&1
REM Tắt Bun
taskkill /F /IM bun.exe >nul 2>&1
REM Giải phóng cổng 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo     [OK] Đã dừng tất cả các tiến trình chạy ngầm thành công.
echo.

echo ============================================================
echo [2/4] Đang xóa các thư mục thư viện tạm thời (Dung lượng lớn)...
echo ============================================================
if exist "node_modules" (
    echo     Đang xóa node_modules ở thư mục gốc...
    rmdir /s /q "node_modules" >nul 2>&1
)
if exist "apps\web\node_modules" (
    echo     Đang xóa node_modules trong apps\web...
    rmdir /s /q "apps\web\node_modules" >nul 2>&1
)
if exist "apps\web\.next" (
    echo     Đang xóa thư mục cache build .next...
    rmdir /s /q "apps\web\.next" >nul 2>&1
)
echo     [OK] Đã dọn dẹp xong các thư mục thư viện nặng.
echo.

echo ============================================================
echo [3/4] Đang xóa file cấu hình và script khởi động tạm...
echo ============================================================
if exist "apps\web\.env.local" (
    del /f /q "apps\web\.env.local" >nul 2>&1
    echo     Đã xóa file apps\web\.env.local
)
if exist "scripts\launch_server.vbs" (
    del /f /q "scripts\launch_server.vbs" >nul 2>&1
    echo     Đã xóa file scripts\launch_server.vbs
)
echo     [OK] Đã dọn dẹp các file cấu hình khởi động tạm thời.
echo.

echo ============================================================
echo [4/4] Dọn dẹp dữ liệu lưu trữ ứng dụng (AppData & Cache)
echo ============================================================
echo * LƯU Ý: Nếu xóa, toàn bộ dữ liệu video/dự án tạm thời của OpenCut sẽ bị mất.
set /p CLEAN_DATA="Bạn có muốn xóa sạch Dữ liệu dự án & Bộ nhớ đệm (Cache) của OpenCut không? (Y/N): "
if /i "%CLEAN_DATA%"=="Y" (
    echo     Đang xóa dữ liệu trong AppData...
    if exist "%APPDATA%\OpenCut Classic" rmdir /s /q "%APPDATA%\OpenCut Classic" >nul 2>&1
    if exist "data" rmdir /s /q "data" >nul 2>&1
    echo     [OK] Đã xóa sạch dữ liệu ứng dụng và cache khỏi máy tính.
) else (
    echo     Bỏ qua bước dọn dẹp dữ liệu và cache hệ thống.
)
echo.

echo ============================================================
echo     HOÀN THÀNH QUÁ TRÌNH GỠ CÀI ĐẶT & DỌN DẸP SẠCH SẼ!
echo ============================================================
echo.
pause
exit
