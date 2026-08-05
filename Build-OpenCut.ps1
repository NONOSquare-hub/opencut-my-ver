#Requires -Version 5.0
<#
.SYNOPSIS
    Build-OpenCut.ps1 — Tạo file cài đặt OpenCut Classic (.exe)

.DESCRIPTION
    Script PowerShell tự động hóa toàn bộ quy trình build:
      1. Kiểm tra Bun runtime
      2. Cài dependencies nếu cần
      3. Kiểm tra file cấu hình .env.local
      4. Chạy Next.js build (standalone)
      5. Chạy electron-builder để tạo file .exe

.EXAMPLE
    .\Build-OpenCut.ps1
    .\Build-OpenCut.ps1 -SkipInstall   # Bỏ qua bước bun install
    .\Build-OpenCut.ps1 -SkipBuild     # Bỏ qua bước next build (dùng .next đã có)
#>

param(
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$Verbose
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Màu sắc ─────────────────────────────────────────────────────────────────
function Write-Step  ($n, $total, $msg) { Write-Host "`n[$n/$total] $msg" -ForegroundColor Cyan }
function Write-Ok    ($msg) { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Warn  ($msg) { Write-Host "  ⚠️  $msg" -ForegroundColor Yellow }
function Write-Fail  ($msg) { Write-Host "  ❌ $msg" -ForegroundColor Red }
function Write-Info  ($msg) { Write-Host "  $msg" -ForegroundColor Gray }
function Write-Hr           { Write-Host ("─" * 60) -ForegroundColor DarkGray }

# ─── Đường dẫn ───────────────────────────────────────────────────────────────
$ROOT_DIR = $PSScriptRoot                          # Thư mục gốc dự án
$WEB_DIR  = Join-Path $ROOT_DIR "apps\web"
$TOTAL    = 5

Write-Hr
Write-Host "  🚀 OpenCut Classic — Build Installer" -ForegroundColor Cyan -NoNewline
Write-Host " (PowerShell)" -ForegroundColor DarkCyan
Write-Host "  Root: $ROOT_DIR" -ForegroundColor DarkGray
Write-Hr

# ─── BƯỚC 1: Tìm Bun ─────────────────────────────────────────────────────────
Write-Step 1 $TOTAL "Kiểm tra Bun runtime..."

$BUN_EXE = $null

# 1a. Tìm trong PATH
$bunInPath = Get-Command bun -ErrorAction SilentlyContinue
if ($bunInPath) {
    $BUN_EXE = $bunInPath.Source
    Write-Info "Tìm thấy Bun trong PATH: $BUN_EXE"
}

# 1b. Kiểm tra vị trí mặc định
if (-not $BUN_EXE) {
    $candidates = @(
        "$env:USERPROFILE\.bun\bin\bun.exe",
        "$env:LOCALAPPDATA\bun\bun.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $BUN_EXE = $c
            Write-Info "Tìm thấy Bun tại: $BUN_EXE"
            break
        }
    }
}

if (-not $BUN_EXE) {
    Write-Fail "Không tìm thấy Bun!"
    Write-Fail "Vui lòng cài Bun tại: https://bun.sh"
    Write-Fail "Sau đó mở lại terminal và chạy lại script này."
    exit 1
}

$bunVersion = & "$BUN_EXE" --version 2>&1
Write-Ok "Bun $bunVersion — $BUN_EXE"

# ─── BƯỚC 2: Cài dependencies ─────────────────────────────────────────────────
Write-Step 2 $TOTAL "Kiểm tra dependencies (node_modules)..."

$needInstall = $false
if (-not (Test-Path (Join-Path $ROOT_DIR "node_modules"))) { $needInstall = $true }
if (-not (Test-Path (Join-Path $WEB_DIR "node_modules")))  { $needInstall = $true }

if ($SkipInstall) {
    Write-Warn "Bỏ qua bước cài đặt (--SkipInstall)"
} elseif ($needInstall) {
    Write-Info "Chưa có node_modules. Đang chạy bun install..."
    Push-Location $ROOT_DIR
    try {
        & "$BUN_EXE" install
        if ($LASTEXITCODE -ne 0) { throw "bun install thất bại (exit code $LASTEXITCODE)" }
        Write-Ok "Cài đặt dependencies xong."
    } finally { Pop-Location }
} else {
    Write-Ok "node_modules đã có sẵn."
}

# ─── BƯỚC 3: Kiểm tra .env.local ─────────────────────────────────────────────
Write-Step 3 $TOTAL "Kiểm tra file cấu hình..."

$envLocal   = Join-Path $WEB_DIR ".env.local"
$envExample = Join-Path $WEB_DIR ".env.example"

if (-not (Test-Path $envLocal)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envLocal
        Write-Ok "Đã tạo .env.local từ .env.example"
    } else {
        Write-Warn "Không tìm thấy .env.local — build có thể thiếu biến môi trường"
    }
} else {
    Write-Ok ".env.local đã tồn tại"
}

# ─── BƯỚC 4: Build Next.js ────────────────────────────────────────────────────
Write-Step 4 $TOTAL "Build Next.js (standalone mode)..."

if ($SkipBuild) {
    Write-Warn "Bỏ qua bước build (--SkipBuild)"
    $serverJs = Join-Path $WEB_DIR ".next\standalone\server.js"
    if (-not (Test-Path $serverJs)) {
        Write-Fail "Dùng --SkipBuild nhưng .next\standalone\server.js không tồn tại!"
        Write-Fail "Chạy lại không có --SkipBuild để build trước."
        exit 1
    }
} else {
    Write-Info "Đang build... (có thể mất 2–5 phút)"
    Push-Location $WEB_DIR
    try {
        & "$BUN_EXE" run build
        if ($LASTEXITCODE -ne 0) { throw "next build thất bại (exit code $LASTEXITCODE)" }
    } catch {
        Write-Fail "Next.js build thất bại!"
        Write-Fail "Nguyên nhân thường gặp:"
        Write-Fail "  - Thiếu biến trong .env.local"
        Write-Fail "  - Lỗi TypeScript / import trong source code"
        Write-Fail "  - Xem log ở trên để biết chi tiết"
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Ok "Next.js build hoàn tất."

    # Kiểm tra output
    $standaloneDir = Join-Path $WEB_DIR ".next\standalone"
    $serverJs = Join-Path $standaloneDir "server.js"

    if (-not (Test-Path $standaloneDir)) {
        Write-Fail 'Thư mục ".next\standalone" không tồn tại sau build!'
        Write-Fail 'Kiểm tra next.config.ts: phải có output: "standalone"'
        exit 1
    }
    Write-Ok '".next\standalone" tồn tại'

    if (-not (Test-Path $serverJs)) {
        Write-Fail '"server.js" không tìm thấy trong standalone!'
        Write-Fail "Đường dẫn mong đợi: $serverJs"
        exit 1
    }
    Write-Ok '"server.js" tìm thấy — Next.js server sẵn sàng'

    # Copy static assets
    Write-Info "Đang copy static assets..."
    $staticSrc  = Join-Path $WEB_DIR ".next\static"
    $staticDst  = Join-Path $standaloneDir ".next\static"
    $publicSrc  = Join-Path $WEB_DIR "public"
    $publicDst  = Join-Path $standaloneDir "public"

    if (Test-Path $staticSrc) {
        Copy-Item -Recurse -Force $staticSrc $staticDst
        Write-Ok "Copied: .next\static → standalone\.next\static"
    } else {
        Write-Warn '".next\static" không tìm thấy — bỏ qua'
    }

    if (Test-Path $publicSrc) {
        Copy-Item -Recurse -Force $publicSrc $publicDst
        Write-Ok "Copied: public\ → standalone\public\"
    } else {
        Write-Warn '"public\" không tìm thấy — bỏ qua'
    }
}

# ─── BƯỚC 5: Chạy electron-builder ───────────────────────────────────────────
Write-Step 5 $TOTAL "Chạy electron-builder (tạo file .exe)..."
Write-Info "Lần đầu có thể mất 5–10 phút để download Electron binary (~100MB)."
Write-Info "Đừng đóng terminal trong lúc này!"

$maxAttempts = 3
$success = $false

for ($i = 1; $i -le $maxAttempts; $i++) {
    Write-Info "Lần thử $i / $maxAttempts ..."
    Push-Location $WEB_DIR
    try {
        & "$BUN_EXE" run electron-builder --win --config.extraMetadata.main=electron/main.js
        if ($LASTEXITCODE -eq 0) {
            $success = $true
            Pop-Location
            break
        }
        throw "electron-builder kết thúc với exit code $LASTEXITCODE"
    } catch {
        Write-Warn "Lần thử $i thất bại: $_"
        Pop-Location
        if ($i -lt $maxAttempts) {
            Write-Info "Chờ 5 giây trước khi thử lại (bypass Windows Defender lock)..."
            Start-Sleep -Seconds 5
        }
    }
}

if (-not $success) {
    Write-Fail "electron-builder thất bại sau $maxAttempts lần thử!"
    Write-Fail "Nguyên nhân thường gặp:"
    Write-Fail "  1. Mạng chặn download Electron binary — thử dùng VPN hoặc tắt proxy"
    Write-Fail "  2. Windows Defender xóa file trong lúc build — thêm ngoại lệ cho thư mục dự án"
    Write-Fail "  3. Thiếu NSIS — tải tại: https://nsis.sourceforge.io/Download"
    Write-Fail "  4. Ổ đĩa C:\ đầy — output là C:\temp\opencut-dist (cần ~500MB trống)"
    exit 1
}

Write-Ok "electron-builder hoàn tất!"

# ─── Kết quả ─────────────────────────────────────────────────────────────────
Write-Hr
Write-Host "`n  🎉 BUILD THÀNH CÔNG!" -ForegroundColor Green

$outDir = Join-Path $WEB_DIR "dist"
if (Test-Path $outDir) {
    $exeFiles = Get-ChildItem -Path $outDir -Filter "*.exe" -ErrorAction SilentlyContinue
    if ($exeFiles) {
        foreach ($f in $exeFiles) {
            $sizeMB = [math]::Round($f.Length / 1MB, 1)
            Write-Ok "Installer: $($f.FullName)  ($sizeMB MB)"
        }
    }
}

Write-Host ""
Write-Host "  Các bước tiếp theo:" -ForegroundColor Cyan
Write-Host "    1. Chạy file .exe vừa tạo để cài đặt" -ForegroundColor Gray
Write-Host "    2. Mở app từ shortcut trên Desktop" -ForegroundColor Gray
Write-Host "    3. Kiểm tra app load bình thường (không bị màn hình đen)" -ForegroundColor Gray
Write-Hr
