# 💕 Love Confession Website

Một website tỏ tình lãng mạn với hiệu ứng đẹp mắt và chuyển cảnh mượt mà.

## 🚀 Cài đặt và chạy nhanh

### Bước 1: Tải project
\`\`\`bash
# Tải và giải nén project vào thư mục love-confession-website
cd love-confession-website
\`\`\`

### Bước 2: Cài đặt dependencies
\`\`\`bash
npm install
\`\`\`

### Bước 3: Chạy website
\`\`\`bash
# Development mode (khuyến nghị)
npm run dev

# Production mode
npm start
\`\`\`

### Bước 4: Truy cập
Mở trình duyệt: `http://localhost:3000`

## ✨ Tính năng

- 🎨 Thiết kế đẹp mắt với gradient động
- 💫 Hiệu ứng chuyển cảnh mượt mà
- 💕 Trái tim bay lơ lửng
- ⌨️ Hiệu ứng đánh máy thư tình
- 🎉 Pháo giấy khi nhận được câu trả lời "Có"
- 📱 Responsive hoàn hảo trên mọi thiết bị
- 📊 Tích hợp Google Sheets để lưu phản hồi (tùy chọn)

## 📁 Cấu trúc project

\`\`\`
love-confession-website/
├── public/
│   ├── index.html          # Trang chủ
│   ├── style.css           # CSS với hiệu ứng đẹp
│   └── script.js           # JavaScript logic
├── server.js               # Express server
├── package.json            # Dependencies
├── .env.local.example      # Environment variables example
├── .gitignore             # Git ignore rules
└── README.md              # Hướng dẫn này
\`\`\`

## 🎨 Tùy chỉnh nhanh

### Thay đổi nội dung thư tình
Chỉnh sửa biến `letterContent` trong `public/script.js`

### Thay đổi ảnh avatar
Thay thế URL trong `public/index.html` tại dòng `<img id="letterAvatar"`

## 🔧 Troubleshooting

### Lỗi "Cannot find module"
\`\`\`bash
rm -rf node_modules package-lock.json
npm install
\`\`\`

### Port đã được sử dụng
\`\`\`bash
# Tạo file .env.local
echo "PORT=3001" > .env.local
\`\`\`

---

💕 **Chúc bạn thành công với lời tỏ tình!** 💕
