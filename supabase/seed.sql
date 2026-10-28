-- ============================================
-- QUẢN LÝ LỚP HỌC - DỮ LIỆU MẪU (SEED DATA)
-- Chạy file này SAU KHI đã chạy schema.sql trong Supabase SQL Editor
-- ============================================

-- 1. Tạo 2 lớp học mẫu
INSERT INTO public.classes (id, name, school_year, description) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Lớp 10A1', '2024-2025', 'Lớp chuyên Toán - Tin'),
  ('c2222222-2222-2222-2222-222222222222', 'Lớp 11B2', '2024-2025', 'Lớp tự nhiên')
ON CONFLICT (id) DO NOTHING;

-- 2. Tạo thời khóa biểu mẫu cho tuần này
INSERT INTO public.sessions (class_id, subject, date, start_time, end_time, room, notes) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Toán Đại số', CURRENT_DATE, '07:30', '09:00', 'Phòng 201', 'Kiểm tra 15 phút đầu giờ'),
  ('c1111111-1111-1111-1111-111111111111', 'Vật Lý', CURRENT_DATE + INTERVAL '1 day', '09:15', '10:45', 'Phòng Lab Lý', 'Mang theo dụng cụ thí nghiệm'),
  ('c1111111-1111-1111-1111-111111111111', 'Hóa Học', CURRENT_DATE + INTERVAL '2 day', '07:30', '09:00', 'Phòng 201', 'Học chương phản ứng oxi hóa khử'),
  ('c1111111-1111-1111-1111-111111111111', 'Tin Học', CURRENT_DATE + INTERVAL '3 day', '14:00', '15:30', 'Phòng Máy 1', 'Thực hành lập trình Next.js & SQL')
ON CONFLICT DO NOTHING;

-- 3. Tạo bài tập mẫu có trắc nghiệm
INSERT INTO public.assignments (id, class_id, title, description, due_date, has_quiz, show_answers) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Bài tập ôn tập chương 1 - Đại số 10', 'Các em làm bài trắc nghiệm 4 câu bên dưới và nộp bài trước hạn. Kết quả sẽ được chấm tự động ngay khi nộp!', NOW() + INTERVAL '3 days', true, true)
ON CONFLICT (id) DO NOTHING;

-- Câu hỏi trắc nghiệm mẫu
INSERT INTO public.questions (assignment_id, question_number, content, option_a, option_b, option_c, option_d, correct_answer, points) VALUES
  ('a1111111-1111-1111-1111-111111111111', 1, 'Tập hợp nào sau đây là tập hợp rỗng?', 'A = {x ∈ R | x² - 4 = 0}', 'B = {x ∈ R | x² + 1 = 0}', 'C = {x ∈ Z | x² = 1}', 'D = {x ∈ Q | x² = 4}', 'B', 2.5),
  ('a1111111-1111-1111-1111-111111111111', 2, 'Mệnh đề nào sau đây là mệnh đề ĐÚNG?', 'Mọi số nguyên tố đều là số lẻ', 'Tổng hai số lẻ là một số lẻ', 'Một tam giác có ba góc nhọn là tam giác nhọn', 'Số 0 là số nguyên dương nhỏ nhất', 'C', 2.5),
  ('a1111111-1111-1111-1111-111111111111', 3, 'Cho tập hợp A = {1, 2, 3, 4, 5}. Số phần tử của tập hợp A là:', '3', '4', '5', '6', 'C', 2.5),
  ('a1111111-1111-1111-1111-111111111111', 4, 'Bất phương trình bậc nhất hai ẩn có dạng:', 'ax + by < c', 'ax² + by < c', 'ax + by² < c', 'ax² + by² < c', 'A', 2.5)
ON CONFLICT DO NOTHING;

-- 4. HƯỚNG DẪN TẠO TÀI KHOẢN ADMIN:
-- Sau khi tạo tài khoản Admin trong Supabase Auth (Dashboard -> Authentication -> Users -> Add User):
-- Ví dụ email: admin@lop.local, mật khẩu: 123456
-- Hãy chạy lệnh bên dưới để phân quyền 'admin' cho tài khoản đó:
--
-- UPDATE public.profiles
-- SET role = 'admin', full_name = 'Cô Giáo Quản Trị'
-- WHERE username = 'admin';
