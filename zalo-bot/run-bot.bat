@echo off
chcp 65001 > nul
title TRỢ LÝ ZALO LỚP HỌC - CLASSROOM BOT

echo ======================================================================
echo          🤖 KHỞI ĐỘNG TRỢ LÝ ZALO BOT CHO LỚP HỌC
echo ======================================================================
echo.

set PATH=C:\Program Files\nodejs;%PATH%

cd /d "%~dp0"

echo [1/2] Đang kiểm tra môi trường Node.js...
node -v > nul 2>&1
if %errorlevel% neq 0 (
    echo [LỖI] Không tìm thấy Node.js trên máy tính! Vui lòng cài đặt Node.js.
    pause
    exit /b
)

echo [2/2] Đang kết nối Zalo và Cơ sở dữ liệu lớp học...
echo.
node bot.js

echo.
echo Đã dừng Bot.
pause
