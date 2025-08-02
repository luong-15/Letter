require("dotenv").config()
const express = require("express")
const bodyParser = require("body-parser")
const { google } = require("googleapis")
const path = require("path")
const cors = require("cors")

const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")))

// Google Sheets setup
let sheets
let SPREADSHEET_ID

try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.SPREADSHEET_ID) {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    sheets = google.sheets({ version: "v4", auth })
    SPREADSHEET_ID = process.env.SPREADSHEET_ID
    console.log("✅ Google Sheets integration configured successfully")
  } else {
    console.log("⚠️  Google Sheets not configured. Responses will be logged to console only.")
  }
} catch (error) {
  console.log("⚠️  Google Sheets configuration error:", error.message)
  console.log("📝 Responses will be logged to console only.")
}

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.post("/submit-response", async (req, res) => {
  try {
    const { choice, feedback } = req.body
    const timestamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })

    if (!choice) {
      return res.status(400).json({ error: "Lựa chọn không hợp lệ." })
    }

    // Extract IP address with better handling for Vercel
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
              req.headers['x-real-ip'] || 
              req.connection.remoteAddress || 
              req.socket.remoteAddress ||
              req.ip || 
              "Unknown IP"
    
    // Extract User-Agent (device info)
    const userAgent = req.headers['user-agent'] || "Unknown Device"

    // Log to console for debugging
    console.log("\n🎉 NEW RESPONSE RECEIVED:")
    console.log("⏰ Time:", timestamp)
    console.log("💝 Choice:", choice === "yes" ? "✅ ĐỒNG Ý!" : "❌ Không...")
    console.log("💭 Feedback:", feedback || "Không có phản hồi")
    console.log("🌐 IP Address:", ip)
    console.log("📱 Device Info:", userAgent.substring(0, 100) + "...")
    console.log("─".repeat(50))

    // Try to save to Google Sheets if configured
    if (sheets && SPREADSHEET_ID) {
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: "result_cr!A:E",
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [[timestamp, choice, feedback || "", ip, userAgent]],
          },
        })
        console.log("✅ Response saved to Google Sheets")
      } catch (sheetsError) {
        console.error("❌ Google Sheets error:", sheetsError.message)
        // Continue execution even if sheets fails
      }
    }

    // Prepare response message
    let responseMessage = ""
    if (choice === "yes") {
      responseMessage = "🎉 Niceeeeee! Anh hạnh phúc quá! Cảm ơn em rất nhiều! 🥰💕"
    } else if (choice === "no") {
      responseMessage = "😔 Anh hiểu rồi. Tuy hơi buồn nhưng anh vẫn trân trọng cảm nhận của em. 💙"
    } else {
      responseMessage = "Cảm ơn em đã phản hồi! 💖"
    }

    // Send successful response
    res.status(200).send(responseMessage)

  } catch (error) {
    console.error("❌ Error processing response:", error.message)
    console.error("Stack trace:", error.stack)
    
    // Send error response
    res.status(500).send("Có lỗi xảy ra. Anh vẫn nhận được phản hồi của em rồi! 💕")
  }
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    googleSheets: !!(sheets && SPREADSHEET_ID),
    environment: process.env.NODE_ENV || 'development'
  })
})

// API status endpoint
app.get("/api/status", (req, res) => {
  res.json({
    status: "running",
    timestamp: new Date().toISOString(),
    googleSheets: !!(sheets && SPREADSHEET_ID)
  })
})

// Handle all other routes by serving index.html (SPA support)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

// Error handler
app.use((error, req, res, next) => {
  console.error("Server error:", error)
  res.status(500).send("Có lỗi xảy ra trên server. Vui lòng thử lại sau.")
})

// Export for Vercel
module.exports = app

// Only listen if not in serverless environment
if (require.main === module) {
  app.listen(port, () => {
    console.log("\n🚀 Love Confession Website is running!")
    console.log(`📍 Local: http://localhost:${port}`)
    console.log("💕 Ready to receive love confessions!\n")
  })
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 Server shutting down gracefully...")
  process.exit(0)
})