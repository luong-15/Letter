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

// Google Sheets setup with better error handling
let sheets
let SPREADSHEET_ID
let googleAuth

async function initializeGoogleSheets() {
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || !process.env.SPREADSHEET_ID) {
      console.log("⚠️  Google Sheets not configured. Missing environment variables.")
      return false
    }

    console.log("🔑 Initializing Google Sheets...")
    
    // Parse credentials with better error handling
    let credentials
    try {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    } catch (parseError) {
      console.error("❌ Error parsing Google credentials JSON:", parseError.message)
      return false
    }

    // Validate required fields in credentials
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email']
    for (const field of requiredFields) {
      if (!credentials[field]) {
        console.error(`❌ Missing required field in credentials: ${field}`)
        return false
      }
    }

    // Create auth instance
    googleAuth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    // Get auth client
    const authClient = await googleAuth.getClient()
    console.log("✅ Google Auth client created successfully")

    // Create sheets instance
    sheets = google.sheets({ version: "v4", auth: authClient })
    SPREADSHEET_ID = process.env.SPREADSHEET_ID

    // Test connection by trying to read spreadsheet metadata
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID
      })
      console.log(`✅ Successfully connected to spreadsheet: ${response.data.properties.title}`)
      
      // Check if the sheet 'result_cr' exists
      const sheetNames = response.data.sheets.map(sheet => sheet.properties.title)
      if (!sheetNames.includes('result_cr')) {
        console.log("⚠️  Sheet 'result_cr' not found. Available sheets:", sheetNames)
        console.log("📝 Will try to create the sheet or use first available sheet")
      }
      
      return true
    } catch (testError) {
      console.error("❌ Error testing spreadsheet access:", testError.message)
      if (testError.code === 403) {
        console.error("❌ Permission denied. Make sure to share the spreadsheet with the service account email:")
        console.error(`📧 Service account email: ${credentials.client_email}`)
      }
      return false
    }

  } catch (error) {
    console.error("❌ Google Sheets initialization error:", error.message)
    return false
  }
}

// Initialize Google Sheets on startup
let googleSheetsReady = false
initializeGoogleSheets().then(success => {
  googleSheetsReady = success
  if (success) {
    console.log("✅ Google Sheets integration ready")
  } else {
    console.log("📝 Running without Google Sheets integration")
  }
})

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.post("/submit-response", async (req, res) => {
  console.log("\n🎉 NEW RESPONSE RECEIVED:")
  
  try {
    const { choice, feedback } = req.body
    const timestamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })

    if (!choice) {
      console.log("❌ Invalid choice received")
      return res.status(400).json({ error: "Lựa chọn không hợp lệ." })
    }

    // Extract request info
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
              req.headers['x-real-ip'] || 
              req.connection.remoteAddress || 
              req.socket.remoteAddress ||
              req.ip || 
              "Unknown IP"
    
    const userAgent = req.headers['user-agent'] || "Unknown Device"

    // Log response data
    console.log("⏰ Time:", timestamp)
    console.log("💝 Choice:", choice === "yes" ? "✅ ĐỒNG Ý!" : "❌ Không...")
    console.log("💭 Feedback:", feedback || "Không có phản hồi")
    console.log("🌐 IP Address:", ip)
    console.log("📱 Device Info:", userAgent.substring(0, 100) + "...")

    // Try to save to Google Sheets
    let sheetsSuccess = false
    if (googleSheetsReady && sheets && SPREADSHEET_ID) {
      try {
        console.log("📊 Attempting to save to Google Sheets...")
        
        const values = [
          [timestamp, choice, feedback || "", ip, userAgent]
        ]
        
        console.log("📝 Data to append:", JSON.stringify(values))
        
        const appendRequest = {
          spreadsheetId: SPREADSHEET_ID,
          range: "result_cr!A:E", // Try specific sheet first
          valueInputOption: "USER_ENTERED",
          insertDataOption: "INSERT_ROWS",
          resource: {
            values: values
          }
        }
        
        const response = await sheets.spreadsheets.values.append(appendRequest)
        
        console.log("✅ Successfully saved to Google Sheets")
        console.log(`📊 Updated range: ${response.data.updates.updatedRange}`)
        console.log(`📈 Rows added: ${response.data.updates.updatedRows}`)
        sheetsSuccess = true
        
      } catch (sheetsError) {
        console.error("❌ Google Sheets error:", sheetsError.message)
        console.error("Error details:", {
          code: sheetsError.code,
          status: sheetsError.status,
          message: sheetsError.message
        })
        
        // Try fallback to first sheet if result_cr doesn't exist
        if (sheetsError.message.includes("Unable to parse range")) {
          try {
            console.log("🔄 Trying fallback to Sheet1...")
            const fallbackRequest = {
              ...appendRequest,
              range: "Sheet1!A:E"
            }
            const fallbackResponse = await sheets.spreadsheets.values.append(fallbackRequest)
            console.log("✅ Saved to Sheet1 as fallback")
            sheetsSuccess = true
          } catch (fallbackError) {
            console.error("❌ Fallback also failed:", fallbackError.message)
          }
        }
      }
    } else {
      console.log("⚠️  Google Sheets not ready or not configured")
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

    // Add sheets status to response for debugging
    if (sheetsSuccess) {
      console.log("✅ Response saved successfully to spreadsheet")
    } else {
      console.log("⚠️  Response logged but not saved to spreadsheet")
    }

    console.log("─".repeat(50))

    // Send successful response
    res.status(200).send(responseMessage)

  } catch (error) {
    console.error("❌ Error processing response:", error.message)
    console.error("Stack trace:", error.stack)
    
    // Send error response but still positive message
    res.status(500).send("Anh đã nhận được phản hồi của em rồi! 💕")
  }
})

// Health check endpoint with detailed info
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    googleSheets: {
      configured: !!(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.SPREADSHEET_ID),
      ready: googleSheetsReady,
      spreadsheetId: SPREADSHEET_ID ? "configured" : "not configured"
    },
    environment: process.env.NODE_ENV || 'development'
  })
})

// Debug endpoint for checking Google Sheets connection
app.get("/debug/sheets", async (req, res) => {
  try {
    if (!googleSheetsReady) {
      return res.json({
        status: "not ready",
        configured: !!(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.SPREADSHEET_ID)
      })
    }

    // Try to read spreadsheet info
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    })

    res.json({
      status: "ready",
      spreadsheet: {
        title: response.data.properties.title,
        sheets: response.data.sheets.map(sheet => ({
          name: sheet.properties.title,
          id: sheet.properties.sheetId
        }))
      }
    })
  } catch (error) {
    res.json({
      status: "error",
      error: error.message
    })
  }
})

// API status endpoint
app.get("/api/status", (req, res) => {
  res.json({
    status: "running",
    timestamp: new Date().toISOString(),
    googleSheets: googleSheetsReady
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