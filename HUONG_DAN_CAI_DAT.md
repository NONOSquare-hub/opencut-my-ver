# Hướng Dẫn Cài Đặt & Đóng Gói Dự Án OpenCut Classic

Tài liệu này hướng dẫn chi tiết cách thiết lập môi trường phát triển, khởi chạy ứng dụng và đóng gói dự án **OpenCut Classic** thành file cài đặt desktop `.exe` trên Windows.

---

## 📌 Tổng Quan Kiến Trúc
**OpenCut Classic** là một trình chỉnh sửa video ngoại tuyến chạy trên máy tính. 
- **Frontend / Logic**: Xây dựng bằng **Next.js** (đặt tại `apps/web/`).
- **Desktop Shell**: Sử dụng **Electron** làm lớp vỏ bọc bên ngoài kết nối với máy chủ Next.js chạy ngầm.
- **Core Xử Lý**: Sử dụng **Rust / WASM** để thực hiện các tác vụ biên tập video và hiệu ứng hiệu năng cao trên GPU cục bộ của thiết bị.

---

## 🛠️ Yêu Cầu Hệ Thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các phần mềm sau:

1. **Bun Runtime** (Bắt buộc): Trình quản lý package và runtime chính của dự án (tốc độ nhanh hơn npm/yarn rất nhiều).
   - Tải và cài đặt tại: [https://bun.sh](https://bun.sh)
2. **Docker & Docker Compose** (Tùy chọn): Dành cho việc chạy cơ sở dữ liệu PostgreSQL và Redis cục bộ nếu bạn phát triển các tính năng yêu cầu lưu trữ đồng bộ.
   - Tải và cài đặt tại: [https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/)
3. **Rust Toolchain** (Chỉ dành cho lập trình viên cần chỉnh sửa mã nguồn Rust/WASM):
   - Tải và cài đặt Rust thông qua [Rustup](https://rustup.rs/).
   - Cài đặt các công cụ biên dịch WASM:
     ```bash
     cargo install wasm-pack
     cargo install cargo-watch
     ```

---

## 🚀 Hướng Dẫn Khởi Chạy Dự Án (Chế Độ Phát Triển - Dev Mode)

Dự án hỗ trợ 2 cách khởi chạy để thử nghiệm hoặc lập trình:

### Cách 1: Khởi chạy nhanh 1-Click trên Windows (Khuyên dùng)
Nếu bạn đang sử dụng hệ điều hành Windows, trong thư mục gốc của dự án đã có sẵn file script **`OpenCut.bat`**. 
Chỉ cần **nhấp đúp chuột (Double Click) vào file `OpenCut.bat`**, hệ thống sẽ tự động thực hiện các bước sau:
1. **Kiểm tra Bun**: Nếu máy chưa cài đặt Bun, script sẽ tự động mở trình duyệt dẫn đến trang hướng dẫn cài đặt Bun.
2. **Cài đặt thư viện (Dependencies)**: Nếu chưa có thư mục `node_modules`, script tự động chạy `bun install`.
3. **Cấu hình môi trường**: Tự động copy file cấu hình mẫu `.env.example` thành `.env.local` ở thư mục `apps/web/` nếu chưa tồn tại.
4. **Giải phóng cổng 3000**: Tự động tắt bất kỳ tiến trình chạy ẩn nào đang chiếm cổng 3000 để tránh xung đột.
5. **Chạy ngầm Web Server**: Sử dụng một file script VBScript (`scripts/launch_server.vbs`) để chạy ngầm lệnh `bun run dev:web` (Next.js server) mà không làm hiện cửa sổ dòng lệnh CMD gây vướng mắt.
6. **Mở Electron GUI**: Khởi động giao diện Desktop Electron bọc lấy ứng dụng đang chạy ở cổng 3000.
7. **Tự động đóng**: Cửa sổ CMD khởi chạy sẽ tự động đóng ngay lập tức sau khi giao diện OpenCut xuất hiện.

---

### Cách 2: Khởi chạy thủ công bằng dòng lệnh (Dành cho macOS / Linux / Windows CLI)
Nếu muốn kiểm soát chi tiết quá trình khởi chạy hoặc chạy trên hệ điều hành khác, bạn có thể thực hiện theo các bước sau từ terminal:

1. **Cài đặt các gói phụ thuộc (Dependencies)** tại thư mục gốc:
   ```bash
   bun install
   ```

2. **Cấu hình biến môi trường**:
   Sao chép file cấu hình mẫu sang cấu hình chạy cục bộ:
   - **Unix/Linux/Mac**:
     ```bash
     cp apps/web/.env.example apps/web/.env.local
     ```
   - **Windows PowerShell**:
     ```powershell
     Copy-Item apps/web/.env.example apps/web/.env.local
     ```

3. **(Tùy chọn) Khởi động Database & Redis** (nếu phát triển tính năng cần DB):
   ```bash
   docker compose up -d db redis serverless-redis-http
   ```

4. **Khởi chạy máy chủ Next.js**:
   ```bash
   bun dev:web
   ```
   *Lúc này, bạn có thể truy cập ứng dụng trên trình duyệt web tại địa chỉ: [http://localhost:3000](http://localhost:3000)*

5. **Khởi chạy ứng dụng Electron Desktop**:
   Mở một cửa sổ terminal mới tại thư mục gốc và chạy:
   ```bash
   bun run desktop
   ```

---

## 📦 Hướng Dẫn Đóng Gói (Build) Thành File Cài Đặt `.exe`

Nếu bạn muốn tạo file cài đặt chính thức (Installer `.exe`) để chia sẻ cho người dùng khác cài đặt trên máy tính của họ:

### Cách 1: Sử dụng PowerShell Script (Tự động & Khuyên dùng trên Windows)
1. Mở PowerShell trong thư mục dự án.
2. Chạy file script:
   ```powershell
   .\Build-OpenCut.ps1
   ```
   *Mẹo: Nếu PowerShell báo lỗi chính sách bảo mật không cho chạy script, hãy chạy lệnh sau trước:*
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process
   ```
3. Script sẽ tự động dọn dẹp, kiểm tra môi trường, build Next.js ở chế độ tối ưu độc lập (`standalone`), copy các thư mục assets (`static`, `public`) và gọi `electron-builder` để tạo bộ cài đặt.

**Các tùy chọn khi chạy script:**
- `.\Build-OpenCut.ps1 -SkipInstall`: Bỏ qua việc chạy `bun install` nếu bạn đã chắc chắn thư viện đã đầy đủ và mới nhất.
- `.\Build-OpenCut.ps1 -SkipBuild`: Bỏ qua việc build lại Next.js (sử dụng thư mục `.next` đã build trước đó) để tiết kiệm thời gian.

---

### Cách 2: Sử dụng lệnh đóng gói trực tiếp
Bạn cũng có thể chạy lệnh đóng gói được định nghĩa sẵn trong `apps/web/package.json` bằng cách gõ lệnh sau từ thư mục gốc của dự án:
```bash
bun run build:exe
```
Lệnh này sẽ kích hoạt script `pack-electron.js` để tự động hóa toàn bộ quy trình build tương tự như script PowerShell.

---

### 📂 Vị trí file cài đặt sau khi đóng gói thành công
Để tránh lỗi phân quyền Windows Defender hoặc quyền ghi ổ đĩa (`EPERM`) trên các phân vùng ổ đĩa phụ (như D:, E:), thư mục đầu ra của bộ cài đặt được thiết lập cố định tại:
👉 **`C:\temp\opencut-dist\`**

Tại đây, bạn sẽ tìm thấy file cài đặt dạng:
- **`OpenCut Classic Setup <phiên_bản>.exe`** (Kích thước ~80MB - 120MB) dùng để cài đặt trực tiếp lên các máy Windows khác.

---

## 🗑️ Hướng Dẫn Gỡ Cài Đặt & Dọn Dẹp Môi Trường

Nếu bạn không còn phát triển hoặc muốn xóa sạch toàn bộ môi trường chạy thử của OpenCut trên máy tính:
1. Nhấp đúp chuột chạy file **`Uninstall-OpenCut.bat`** ở thư mục gốc của dự án.
2. Script sẽ tự động:
   - Dừng mọi tiến trình chạy ngầm liên quan (Electron, Next.js server, Bun) để giải phóng RAM và CPU.
   - Xóa các thư mục thư viện tạm thời dung lượng rất nặng (`node_modules`, `.next`).
   - Xóa các file cấu hình và script khởi động tạm thời (`.env.local`, `launch_server.vbs`).
   - Hỏi ý kiến bạn để tự động xóa sạch dữ liệu ứng dụng, dự án tạm thời & bộ nhớ đệm cache (`AppData\OpenCut Classic` và thư mục `data`) khỏi ổ cứng máy tính.

---

## ⚠️ Các Lỗi Thường Gặp & Cách Khắc Phục (Troubleshooting)

1. **Lỗi `EPERM: operation not permitted` khi build:**
   - *Nguyên nhân*: Windows Defender hoặc một trình diệt virus đang quét và khóa các file tạm trong quá trình đóng gói của `electron-builder`.
   - *Cách xử lý*: Thêm thư mục dự án và thư mục `C:\temp\opencut-dist\` vào danh sách loại trừ (Exclusions) của Windows Defender / phần mềm diệt virus rồi thử chạy lại.

2. **Lỗi thiếu NSIS khi đóng gói:**
   - *Nguyên nhân*: `electron-builder` cần công cụ NSIS để tạo bộ cài đặt Windows, thông thường nó tự động tải về nhưng có thể bị chặn bởi tường lửa/proxy mạng.
   - *Cách xử lý*: Bạn có thể tự tải và cài đặt NSIS thủ công tại: [https://nsis.sourceforge.io/Download](https://nsis.sourceforge.io/Download).

3. **Ứng dụng hiển thị màn hình trắng / đen sau khi cài đặt hoặc khởi động:**
   - *Nguyên nhân*: Next.js server khởi động ngầm không kịp hoặc cổng bị xung đột.
   - *Cách xử lý*: Đảm bảo bạn đã cấu hình đúng file `.env.local`. Nếu lỗi vẫn tiếp diễn, hãy thử mở Task Manager và tắt các tiến trình `node.exe` hoặc `bun.exe` đang chạy ngầm rồi khởi động lại ứng dụng.
