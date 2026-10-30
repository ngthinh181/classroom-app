# 🤖 HƯỚNG DẪN SỬ DỤNG TRỢ LÝ ZALO BOT CHO LỚP HỌC

Trợ lý Zalo Bot giúp tự động kết nối giữa trang web lớp học (`https://classroom-web-app-eight.vercel.app`) và nhóm chat Zalo của lớp.

---

## 🚀 Cách Bật Bot (Chỉ 1 Bấm Chuột)

1. Mở thư mục `zalo-bot`:
   - Đường dẫn: `c:\Users\Admin\Documents\Web học tập\classroom-app\zalo-bot`
2. Bấm đúp chuột vào file: **`run-bot.bat`**
3. Cửa sổ dòng lệnh màu đen sẽ hiện ra cùng **Mã QR Zalo**:
   - Mở ứng dụng Zalo trên điện thoại của cô giáo (hoặc tài khoản trợ lý).
   - Bấm vào biểu tượng **Quét mã QR** ở góc trên màn hình Zalo.
   - Quét mã QR hiển thị trên màn hình máy tính ➔ Bấm **Xác nhận đăng nhập** trên điện thoại.
4. **Xong!** Bot sẽ thông báo `🎉 Đăng nhập Zalo thành công!` và sẵn sàng hoạt động trong các nhóm Zalo.
   *(Các lần sau khi mở lại máy, bạn chỉ cần bấm `run-bot.bat`, bot sẽ tự động đăng nhập lại mà không cần quét lại mã QR).*

---

## 💬 Các Câu Lệnh Sử Dụng Trong Nhóm Zalo

Cô giáo hoặc học sinh chỉ cần gõ các câu lệnh sau vào ô chat của nhóm lớp:

| Câu lệnh | Chức năng của Bot |
| :--- | :--- |
| **`/diem`** hoặc **`!diem`** | Tự động lấy bài tập mới nhất, thống kê điểm số cả lớp từ cao xuống thấp và điểm trung bình. |
| **`/nhac`** hoặc **`/nhacbai`** | Liệt kê đích danh những bạn **chưa nộp bài** kèm đường link nộp bài trên web để giục nộp gấp. |
| **`/top`** | Bảng vinh danh Top 5 học sinh đạt điểm cao nhất có huy chương vàng, bạc, đồng (🥇🥈🥉). |
| **`/diemdanh`** | Thống kê sĩ số buổi học gần nhất: bao nhiêu bạn có mặt, đi muộn, vắng có phép / không phép. |
| **`/web`** | Gửi đường link trang web lớp học để học sinh và phụ huynh tiện truy cập. |
| **`/help`** | Xem lại bảng hướng dẫn các câu lệnh. |

---

## 💡 Lưu Ý Quan Trọng
- **Bảo mật:** Không chia sẻ file `session.json` (chứa phiên đăng nhập Zalo) ra ngoài.
- Để bot luôn phản hồi 24/7, bạn chỉ cần để cửa sổ `run-bot.bat` thu nhỏ trên thanh taskbar khi bật máy tính.
