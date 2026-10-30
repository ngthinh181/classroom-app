import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import qrcodeTerminal from 'qrcode-terminal';
import { Zalo, ThreadType, LoginQRCallbackEventType } from 'zca-js';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from parent directory if available
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pigopliqcjybbdbxvpsa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const WEBSITE_URL = 'https://classroom-web-app-eight.vercel.app';

if (!SUPABASE_KEY) {
  console.error('❌ LỖI: Chưa cấu hình Supabase Key trong .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const SESSION_FILE = path.resolve(__dirname, 'session.json');

console.log('='.repeat(60));
console.log('   🤖 HỆ THỐNG TRỢ LÝ ZALO BOT CHO LỚP HỌC (ZALO CLASSROOM BOT)');
console.log('   🌐 Kết nối Website: ' + WEBSITE_URL);
console.log('='.repeat(60));

async function getLatestAssignment(classId = null) {
  let query = supabase
    .from('assignments')
    .select('id, title, due_date, class_id, classes(name)')
    .order('created_at', { ascending: false })
    .limit(1);

  if (classId) query = query.eq('class_id', classId);
  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;
  return data[0];
}

async function getAssignmentReport(assignmentId, classId) {
  const [subRes, scRes] = await Promise.all([
    supabase
      .from('submissions')
      .select('score, status, submitted_at, profiles(id, full_name, username)')
      .eq('assignment_id', assignmentId)
      .order('score', { ascending: false }),
    supabase
      .from('students_classes')
      .select('profiles(id, full_name, username)')
      .eq('class_id', classId),
  ]);

  const submissions = (subRes.data || []).map((s) => ({
    studentId: s.profiles?.id,
    name: s.profiles?.full_name || 'Học sinh',
    score: s.score,
    submittedAt: s.submitted_at,
  }));

  const allStudents = (scRes.data || [])
    .map((sc) => sc.profiles)
    .filter(Boolean)
    .map((p) => ({
      id: p.id,
      name: p.full_name,
      username: p.username,
    }));

  const submittedIds = new Set(submissions.map((s) => s.studentId));
  const unsubmitted = allStudents.filter((st) => !submittedIds.has(st.id));

  return { submissions, allStudents, unsubmitted };
}

async function getLatestAttendance(classId = null) {
  let sessionQuery = supabase
    .from('sessions')
    .select('id, class_id, date, start_time, end_time, classes(name)')
    .order('date', { ascending: false })
    .limit(1);

  if (classId) sessionQuery = sessionQuery.eq('class_id', classId);
  const { data: sessions, error } = await sessionQuery;
  if (error || !sessions || sessions.length === 0) return null;

  const session = sessions[0];
  const [attRes, scRes] = await Promise.all([
    supabase
      .from('attendance')
      .select('status, notes, student_id, profiles(full_name)')
      .eq('session_id', session.id),
    supabase
      .from('students_classes')
      .select('profiles(id, full_name)')
      .eq('class_id', session.class_id),
  ]);

  const records = attRes.data || [];
  const students = (scRes.data || []).map((sc) => sc.profiles).filter(Boolean);

  const present = records.filter((r) => r.status === 'present');
  const late = records.filter((r) => r.status === 'late');
  const absentExcused = records.filter((r) => r.status === 'absent_excused');
  const absentUnexcused = records.filter((r) => r.status === 'absent_unexcused');

  return {
    session,
    total: students.length,
    present: present.length,
    late: late.length,
    absentExcused,
    absentUnexcused,
  };
}

async function handleMessage(api, message) {
  try {
    const rawContent = message?.data?.content;
    if (!rawContent || typeof rawContent !== 'string') return;

    const text = rawContent.trim();
    const threadId = message.threadId;
    const isGroup = message.type === ThreadType.Group;

    // Check if the message is a command
    if (!text.startsWith('/') && !text.startsWith('!') && !text.toLowerCase().startsWith('@bot')) {
      return;
    }

    const cleanCommand = text
      .replace(/^@bot\s+/i, '')
      .replace(/^[/!]/, '')
      .trim()
      .toLowerCase();

    console.log(`📩 Nhận lệnh từ ${isGroup ? 'Nhóm' : 'Cá nhân'} [${threadId}]: "${cleanCommand}"`);

    // Command 1: HELP
    if (cleanCommand === 'help' || cleanCommand === 'trogiup' || cleanCommand === 'lenh') {
      const helpMsg =
`🤖 XIN CHÀO! TÔI LÀ TRỢ LÝ LỚP HỌC 📚
Dưới đây là các câu lệnh bạn có thể sử dụng:

📊 /diem : Thống kê điểm bài tập mới nhất của cả lớp
⏰ /nhac : Danh sách các bạn CHƯA NỘP bài tập để nhắc nhở
🏆 /top  : Bảng vinh danh Top 5 học sinh đạt điểm cao nhất
📅 /diemdanh : Thống kê sĩ số & danh sách vắng buổi học gần nhất
🌐 /web  : Nhận đường link trang web lớp học để nộp bài
❓ /help : Xem lại bảng hướng dẫn này

👉 Bạn chỉ cần gõ đúng cú pháp (ví dụ: /diem hoặc /nhac) vào nhóm là tôi sẽ tự động trả lời ngay!`;

      await api.sendMessage({ msg: helpMsg }, threadId, message.type);
      return;
    }

    // Command 2: WEB LINK
    if (cleanCommand === 'web' || cleanCommand === 'link') {
      const linkMsg =
`🌐 TRANG WEB HỌC TẬP VÀ NỘP BÀI:
👉 Đường dẫn: ${WEBSITE_URL}

Các em học sinh đăng nhập bằng tài khoản được cấp để xem bài tập, nộp bài hoặc làm trắc nghiệm trực tuyến nhé!`;
      await api.sendMessage({ msg: linkMsg }, threadId, message.type);
      return;
    }

    // Command 3: REMINDER (CHƯA NỘP BÀI)
    if (cleanCommand === 'nhac' || cleanCommand === 'nhacbai' || cleanCommand === 'chuanop') {
      const assignment = await getLatestAssignment();
      if (!assignment) {
        await api.sendMessage({ msg: 'Hiện tại chưa có bài tập nào được giao trên hệ thống.' }, threadId, message.type);
        return;
      }

      const { submissions, allStudents, unsubmitted } = await getAssignmentReport(assignment.id, assignment.class_id);

      if (unsubmitted.length === 0) {
        const fullMsg =
`🎉 CHÚC MỪNG CẢ LỚP! 🎉
Bài tập: "${assignment.title}"
✅ 100% học sinh (${allStudents.length}/${allStudents.length}) đã nộp bài đầy đủ! Cô giáo xin biểu dương tinh thần tự giác của cả lớp! 👏`;
        await api.sendMessage({ msg: fullMsg }, threadId, message.type);
        return;
      }

      const unsubmittedList = unsubmitted
        .map((st, idx) => `   ${idx + 1}. ${st.name} (@${st.username || 'hs'})`)
        .join('\n');

      const reminderMsg =
`📢 [THÔNG BÁO NHẮC NỘP BÀI TẬP] 📢
📖 Bài tập: "${assignment.title}"
⏰ Hạn nộp: ${assignment.due_date ? new Date(assignment.due_date).toLocaleString('vi-VN') : 'Theo thông báo'}
📊 Tình hình: Đã nộp ${submissions.length}/${allStudents.length} học sinh (còn ${unsubmitted.length} bạn chưa nộp).

⚠️ DANH SÁCH CÁC BẠN CHƯA NỘP BÀI:
${unsubmittedList}

👉 Các em chú ý nhanh chóng vào trang web để làm và nộp bài trước hạn nhé:
🔗 ${WEBSITE_URL}/student/assignments`;

      await api.sendMessage({ msg: reminderMsg }, threadId, message.type);
      return;
    }

    // Command 4: SCORES (ĐIỂM SỐ)
    if (cleanCommand === 'diem' || cleanCommand === 'bangdiem') {
      const assignment = await getLatestAssignment();
      if (!assignment) {
        await api.sendMessage({ msg: 'Hiện tại chưa có bài tập nào trên hệ thống.' }, threadId, message.type);
        return;
      }

      const { submissions, allStudents, unsubmitted } = await getAssignmentReport(assignment.id, assignment.class_id);

      const gradedSubs = submissions.filter((s) => s.score !== null && s.score !== undefined);
      const avgScore = gradedSubs.length > 0
        ? (gradedSubs.reduce((acc, cur) => acc + Number(cur.score), 0) / gradedSubs.length).toFixed(1)
        : 'Chưa có';

      const scoresList = submissions
        .map((s, idx) => {
          const scoreStr = s.score !== null && s.score !== undefined ? `${s.score}đ` : 'Chờ chấm';
          return `   ${idx + 1}. ${s.name}: ${scoreStr}`;
        })
        .join('\n');

      const scoreMsg =
`📊 BẢNG ĐIỂM BÀI TẬP: "${assignment.title}"
👥 Đã nộp: ${submissions.length}/${allStudents.length} học sinh
📈 Điểm trung bình cả lớp: ${avgScore}

📝 DANH SÁCH ĐIỂM CHI TIẾT:
${scoresList || '   (Chưa có bài nộp nào)'}
${unsubmitted.length > 0 ? `\n⚠️ Còn ${unsubmitted.length} bạn chưa nộp bài (gõ /nhac để xem chi tiết).` : ''}

🔗 Xem chi tiết trên hệ thống: ${WEBSITE_URL}`;

      await api.sendMessage({ msg: scoreMsg }, threadId, message.type);
      return;
    }

    // Command 5: TOP (VINH DANH TOP ĐIỂM CAO)
    if (cleanCommand === 'top' || cleanCommand === 'vinhdanh') {
      const assignment = await getLatestAssignment();
      if (!assignment) {
        await api.sendMessage({ msg: 'Chưa có bài tập nào trên hệ thống.' }, threadId, message.type);
        return;
      }

      const { submissions } = await getAssignmentReport(assignment.id, assignment.class_id);
      const graded = submissions.filter((s) => s.score !== null && s.score !== undefined);

      if (graded.length === 0) {
        await api.sendMessage({ msg: 'Bài tập này hiện chưa có bài nộp nào được chấm điểm.' }, threadId, message.type);
        return;
      }

      const medals = ['🥇', '🥈', '🥉', '🎖️', '🎖️'];
      const top5 = graded.slice(0, 5);

      const topList = top5
        .map((s, idx) => `   ${medals[idx] || '⭐'} Top ${idx + 1}: ${s.name} - ${s.score} điểm`)
        .join('\n');

      const topMsg =
`🏆 BẢNG VINH DANH TOP ĐIỂM CAO 🏆
📖 Bài tập: "${assignment.title}"

${topList}

🎉 Xin chúc mừng các bạn đã đạt kết quả xuất sắc! Cả lớp cùng cố gắng noi theo nhé! 👏`;

      await api.sendMessage({ msg: topMsg }, threadId, message.type);
      return;
    }

    // Command 6: DIEMDANH (ĐIỂM DANH)
    if (cleanCommand === 'diemdanh' || cleanCommand === 'chuyencan') {
      const att = await getLatestAttendance();
      if (!att) {
        await api.sendMessage({ msg: 'Hiện tại chưa có dữ liệu điểm danh trên hệ thống.' }, threadId, message.type);
        return;
      }

      const absentExcusedNames = att.absentExcused.map((r) => r.profiles?.full_name || 'Học sinh').join(', ');
      const absentUnexcusedNames = att.absentUnexcused.map((r) => r.profiles?.full_name || 'Học sinh').join(', ');

      const attMsg =
`📅 BÁO CÁO ĐIỂM DANH LỚP HỌC
📆 Ngày: ${att.session.date} (${att.session.classes?.name || 'Lớp học'})
⏰ Thời gian: ${att.session.start_time || ''} - ${att.session.end_time || ''}

📊 TỔNG HỢP:
   ✅ Có mặt: ${att.present}/${att.total} học sinh
   ⏰ Đi muộn: ${att.late} học sinh
   ❌ Vắng có phép: ${att.absentExcused.length} ${absentExcusedNames ? `(${absentExcusedNames})` : ''}
   🚫 Vắng không phép: ${att.absentUnexcused.length} ${absentUnexcusedNames ? `(${absentUnexcusedNames})` : ''}

🔗 Xem sổ điểm danh chi tiết tại: ${WEBSITE_URL}/admin/attendance`;

      await api.sendMessage({ msg: attMsg }, threadId, message.type);
      return;
    }
  } catch (err) {
    console.error('❌ Lỗi xử lý tin nhắn:', err);
  }
}

async function startBot() {
  const zalo = new Zalo({
    selfListen: true, // Listen to own messages so teacher's account can trigger commands
    logging: false,
  });

  let api = null;

  // Check if session exists to auto-login without QR
  if (fs.existsSync(SESSION_FILE)) {
    try {
      console.log('🔄 Đang thử đăng nhập lại bằng phiên trước đó (session.json)...');
      const credentials = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      api = await zalo.login(credentials);
      console.log('✅ Đăng nhập lại thành công bằng phiên cũ! Không cần quét lại mã QR.');
    } catch (e) {
      console.log('⚠️ Phiên đăng nhập cũ đã hết hạn hoặc không hợp lệ. Đang tạo mã QR mới...');
      try { fs.unlinkSync(SESSION_FILE); } catch (_) {}
    }
  }

  // If not logged in, generate QR Code
  if (!api) {
    console.log('\n📲 ĐANG TẠO MÃ QR ĐĂNG NHẬP ZALO...');
    console.log('👉 Vui lòng mở Zalo trên điện thoại ➔ bấm vào biểu tượng Quét mã QR ➔ quét mã bên dưới:\n');

    api = await zalo.loginQR({}, (event) => {
      if (event.type === LoginQRCallbackEventType.QRCodeGenerated) {
        console.log('\n' + '='.repeat(50));
        console.log('   MÃ QR ĐĂNG NHẬP ZALO (QUÉT BẰNG APP ZALO):');
        console.log('='.repeat(50) + '\n');
        // Render QR in terminal
        qrcodeTerminal.generate(event.data.code, { small: true });
        console.log('\n⌛ Đang chờ bạn quét mã QR trên điện thoại...');
      } else if (event.type === LoginQRCallbackEventType.QRCodeScanned) {
        console.log('👀 Đã nhận diện quét mã! Vui lòng bấm [Xác nhận đăng nhập] trên điện thoại.');
      } else if (event.type === LoginQRCallbackEventType.GotLoginInfo) {
        console.log('🎉 Đăng nhập Zalo thành công!');
        try {
          fs.writeFileSync(SESSION_FILE, JSON.stringify(event.data, null, 2), 'utf8');
          console.log('💾 Đã lưu phiên đăng nhập (session.json) cho các lần chạy sau.');
        } catch (err) {
          console.error('Không thể lưu session:', err);
        }
      }
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('   🚀 ZALO BOT ĐÃ SẴN SÀNG HOẠT ĐỘNG!');
  console.log('   📍 Bot đang lắng nghe tin nhắn trong tất cả các nhóm Zalo.');
  console.log('   💡 Gõ /help hoặc /diem hoặc /nhac trong nhóm Zalo để thử nghiệm.');
  console.log('='.repeat(60) + '\n');

  // Register listener for incoming messages
  api.listener.on('message', (message) => {
    handleMessage(api, message);
  });

  // Start listening
  api.listener.start();
}

startBot().catch((err) => {
  console.error('❌ Lỗi khởi động Bot:', err);
});
