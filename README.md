# 🎓 Web App Quản Lý Lớp Học (Next.js + Supabase + Tailwind CSS)

Hệ thống quản lý lớp học hiện đại, đầy đủ tính năng, giao diện responsive mượt mà trên cả điện thoại và máy tính, tối ưu hóa cho giáo viên và học sinh Việt Nam.

---

## 🌟 Tính năng nổi bật

### 👩‍🏫 Dành cho Cô giáo (Admin):
- **Dashboard tổng quan**: Thống kê số lượng học sinh, lớp học, buổi học hôm nay và bài tập sắp đến hạn.
- **Quản lý lớp & học sinh**: Thêm/sửa/xóa lớp học, tạo tài khoản học sinh (`tendangnhap@lop.local`), nhập học sinh hàng loạt từ file Excel/CSV, đặt lại mật khẩu, khóa/mở tài khoản.
- **Thời khóa biểu & Lịch học**: Tạo buổi học đơn lẻ hoặc lặp lại hàng tuần theo thứ trong tuần, xem lịch theo tuần hoặc tháng.
- **Điểm danh thông minh**: Điểm danh từng buổi học (Có mặt, Vắng có phép, Vắng không phép, Đi muộn), nút bấm 1 chạm "Tất cả có mặt", thêm ghi chú cho từng học sinh.
- **Giao bài tập & Soạn trắc nghiệm**:
  - Tải lên tệp đề bài (PDF, Word, ảnh).
  - Soạn trắc nghiệm online (A, B, C, D) trực tiếp hoặc nhập nhanh từ file Excel.
  - Tùy chọn bật/tắt xem đáp án và giải thích ngay khi nộp.
- **Chấm bài & Nhận xét**: Xem danh sách bài nộp, tự động chấm điểm trắc nghiệm, chấm điểm tự luận và gửi lời phê/nhận xét tới học sinh.
- **Thống kê & Báo cáo**: Biểu đồ chuyên cần theo tuần, bảng xếp hạng học sinh, cảnh báo học sinh vắng quá giới hạn, xuất báo cáo ra file Excel (.xlsx).

### 👨‍🎓 Dành cho Học sinh (Student):
- **Trang chủ học tập**: Xem lớp đang học, tỷ lệ chuyên cần cá nhân, bài tập cần nộp gấp và kết quả chấm bài gần nhất.
- **Xem lịch học**: Xem thời khóa biểu theo tuần hoặc theo danh sách, phòng học, ghi chú dặn dò của cô giáo.
- **Theo dõi chuyên cần**: Thống kê số buổi có mặt, vắng có phép, vắng không phép, đi muộn kèm thanh tiến độ trực quan.
- **Làm bài & Nộp bài trực tuyến**:
  - Tải đề bài của cô giáo về máy.
  - Làm bài trắc nghiệm trực tuyến (giao diện chọn A, B, C, D to, rõ ràng, dễ thao tác trên điện thoại).
  - Xem ngay đáp án đúng/sai nếu cô giáo cho phép.
  - Tải lên file bài làm tự luận (ảnh chụp bài làm, PDF, Word).
  - Xem điểm số và lời nhận xét của cô giáo sau khi được chấm.

---

## 🚀 Hướng Dẫn Từng Bước Thiết Lập Supabase (Backend Miễn Phí)

### Bước 1: Tạo tài khoản & Project trên Supabase
1. Truy cập [https://supabase.com](https://supabase.com) và đăng nhập (hoặc đăng ký bằng tài khoản GitHub).
2. Bấm vào nút **"New Project"**.
3. Điền các thông tin:
   - **Name**: `classroom-app` (hoặc tên bất kỳ bạn thích).
   - **Database Password**: Nhập mật khẩu cơ sở dữ liệu mạnh và **lưu lại mật khẩu này**.
   - **Region**: Chọn vùng gần Việt Nam nhất (ví dụ: `Singapore` - `ap-southeast-1`).
   - **Pricing Plan**: Chọn **Free** (Miễn phí 100%).
4. Bấm **"Create new project"** và đợi khoảng 1 - 2 phút để hệ thống khởi tạo.

---

### Bước 2: Chạy Database Schema (Tạo bảng & Phân quyền RLS)
1. Trong màn hình quản trị Supabase, nhìn sang thanh menu bên trái, chọn **SQL Editor** (biểu tượng `>_`).
2. Bấm **"New Query"**.
3. Mở file `supabase/schema.sql` trong mã nguồn của bạn, sao chép toàn bộ nội dung và dán vào ô SQL Editor.
4. Bấm nút **"Run"** (hoặc `Ctrl + Enter`).
   - *Kết quả*: Toàn bộ 10 bảng dữ liệu, các Index, các chính sách bảo mật Row Level Security (RLS) và 2 Storage bucket (`assignments`, `submissions`) sẽ được tạo tự động!

---

### Bước 3: Nạp dữ liệu mẫu (Seed Data - Tùy chọn)
1. Trong **SQL Editor**, bấm **"New Query"**.
2. Mở file `supabase/seed.sql`, sao chép nội dung và dán vào.
3. Bấm nút **"Run"**.
   - *Kết quả*: Bạn sẽ có sẵn 2 lớp học (`10A1`, `11B2`), thời khóa biểu mẫu và bài tập trắc nghiệm mẫu để trải nghiệm ngay.

---

### Bước 4: Tắt xác thực email (Email Confirmation)
Hệ thống sử dụng email nội bộ dạng `tendangnhap@lop.local` để học sinh và cô giáo không cần email thật. Do đó cần tắt gửi email kích hoạt:
1. Vào menu bên trái chọn **Authentication** -> **Providers** -> Chọn **Email**.
2. Tắt mục **"Confirm email"** (chuyển sang `OFF`).
3. Bấm **Save** ở dưới cùng.

---

### Bước 5: Lấy thông tin kết nối API Keys
1. Vào menu bên trái chọn biểu tượng bánh răng **Project Settings** -> chọn **API**.
2. Sao chép 3 thông số sau:
   - **Project URL**: Ví dụ `https://xyzabc.supabase.co`
   - **anon / public key**: Chuỗi khóa công khai
   - **service_role key**: Chuỗi khóa bảo mật dành cho server (bấm nút Reveal để sao chép)

---

### Bước 6: Tạo tài khoản Cô giáo (Admin) đầu tiên
1. Vào **Authentication** -> **Users** -> Bấm nút **"Add User"** -> **"Create User"**.
2. Điền thông tin:
   - **Email**: `admin@lop.local`
   - **Password**: `123456` (hoặc mật khẩu bạn chọn)
   - Bấm **"Create user"**.
3. Quay lại **SQL Editor**, chạy câu lệnh sau để trao quyền Admin cho tài khoản này:
   ```sql
   UPDATE public.profiles
   SET role = 'admin', full_name = 'Cô Giáo Quản Trị'
   WHERE username = 'admin';
   ```
4. Bây giờ bạn đã có thể đăng nhập tài khoản:
   - **Tên đăng nhập**: `admin`
   - **Mật khẩu**: `123456`

---

## 💻 Cấu hình chạy trên máy tính (Local)

1. Mở file `.env.local` trong thư mục dự án `classroom-app`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```
2. Cài đặt các thư viện (nếu chưa cài):
   ```bash
   npm install
   ```
3. Khởi động môi trường phát triển:
   ```bash
   npm run dev
   ```
4. Mở trình duyệt và truy cập: [http://localhost:3000](http://localhost:3000)

---

## 🌐 Hướng Dẫn Deploy Miễn Phí Lên Vercel

### Bước 1: Đẩy mã nguồn lên GitHub
1. Tạo một repository mới trên [GitHub](https://github.com/new) (ví dụ đặt tên là `classroom-app`).
2. Mở terminal tại thư mục dự án và chạy các lệnh:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Classroom management app"
   git branch -M main
   git remote add origin https://github.com/<tai-khoan-cua-ban>/classroom-app.git
   git push -u origin main
   ```

### Bước 2: Deploy lên Vercel
1. Truy cập [https://vercel.com](https://vercel.com) và đăng nhập bằng tài khoản GitHub.
2. Bấm nút **"Add New..."** -> Chọn **"Project"**.
3. Tìm repository `classroom-app` vừa tải lên và bấm nút **"Import"**.
4. Mở phần **"Environment Variables"** và thêm 3 biến môi trường tương ứng:
   - `NEXT_PUBLIC_SUPABASE_URL`: (Dán Project URL từ Supabase)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Dán Anon Key từ Supabase)
   - `SUPABASE_SERVICE_ROLE_KEY`: (Dán Service Role Key từ Supabase)
5. Bấm nút **"Deploy"**.
6. Đợi khoảng 1 phút, Vercel sẽ cung cấp cho bạn một tên miền miễn phí (dạng `https://classroom-app-xyz.vercel.app`).

🎉 **Chúc mừng bạn! Trang web Quản lý lớp học của bạn đã hoạt động trực tuyến 100% miễn phí!**
