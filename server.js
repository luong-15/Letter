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
let googleSheetsReady = false

// Initialize Google Sheets - make it synchronous for Vercel
function initializeGoogleSheets() {
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

    SPREADSHEET_ID = process.env.SPREADSHEET_ID
    console.log("✅ Google Sheets configuration ready")
    return true

  } catch (error) {
    console.error("❌ Google Sheets initialization error:", error.message)
    return false
  }
}

// Initialize Google Sheets on startup
googleSheetsReady = initializeGoogleSheets()

// Helper function to get authenticated sheets client
async function getSheetsClient() {
  if (!googleSheetsReady || !googleAuth) {
    throw new Error("Google Sheets not configured")
  }
  
  if (!sheets) {
    const authClient = await googleAuth.getClient()
    sheets = google.sheets({ version: "v4", auth: authClient })
  }
  
  return sheets
}

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
      return res.status(400).send("Lựa chọn không hợp lệ.")
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
    if (googleSheetsReady && SPREADSHEET_ID) {
      try {
        console.log("📊 Attempting to save to Google Sheets...")
        
        // Get authenticated client
        const sheetsClient = await getSheetsClient()
        
        const values = [
          [timestamp, choice, feedback || "", ip, userAgent]
        ]
        
        console.log("📝 Data to append:", JSON.stringify(values))
        
        // Try primary sheet first
        let appendRequest = {
          spreadsheetId: SPREADSHEET_ID,
          range: "result_cr!A:E",
          valueInputOption: "USER_ENTERED",
          insertDataOption: "INSERT_ROWS",
          resource: {
            values: values
          }
        }
        
        try {
          const response = await sheetsClient.spreadsheets.values.append(appendRequest)
          console.log("✅ Successfully saved to Google Sheets (result_cr)")
          console.log(`📊 Updated range: ${response.data.updates.updatedRange}`)
          console.log(`📈 Rows added: ${response.data.updates.updatedRows}`)
          sheetsSuccess = true
        } catch (rangeError) {
          if (rangeError.message.includes("Unable to parse range") || rangeError.code === 400) {
            console.log("🔄 Sheet 'result_cr' not found, trying Sheet1...")
            
            // Fallback to Sheet1
            appendRequest.range = "Sheet1!A:E"
            const fallbackResponse = await sheetsClient.spreadsheets.values.append(appendRequest)
            console.log("✅ Successfully saved to Google Sheets (Sheet1)")
            console.log(`📊 Updated range: ${fallbackResponse.data.updates.updatedRange}`)
            sheetsSuccess = true
          } else {
            throw rangeError
          }
        }
        
      } catch (sheetsError) {
        console.error("❌ Google Sheets error:", sheetsError.message)
        console.error("Error details:", {
          code: sheetsError.code,
          status: sheetsError.status,
          message: sheetsError.message
        })
        
        // Check for specific errors
        if (sheetsError.code === 403) {
          console.error("❌ Permission denied. Make sure to share the spreadsheet with the service account email")
        } else if (sheetsError.code === 404) {
          console.error("❌ Spreadsheet not found. Check SPREADSHEET_ID")
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
app.get("/health", async (req, res) => {
  let sheetsStatus = "not configured"
  
  if (googleSheetsReady && SPREADSHEET_ID) {
    try {
      const sheetsClient = await getSheetsClient()
      const response = await sheetsClient.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID
      })
      sheetsStatus = "connected"
    } catch (error) {
      sheetsStatus = `error: ${error.message}`
    }
  }

  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    googleSheets: {
      configured: !!(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.SPREADSHEET_ID),
      ready: googleSheetsReady,
      spreadsheetId: SPREADSHEET_ID ? "configured" : "not configured",
      status: sheetsStatus
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
        configured: !!(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.SPREADSHEET_ID),
        error: "Google Sheets not configured properly"
      })
    }

    // Try to read spreadsheet info
    const sheetsClient = await getSheetsClient()
    const response = await sheetsClient.spreadsheets.get({
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
      error: error.message,
      code: error.code || "unknown"
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
    console.log("💕 Ready to receive love confessions!")
    console.log(`📊 Google Sheets: ${googleSheetsReady ? '✅ Ready' : '❌ Not configured'}`)
    console.log()
  })
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 Server shutting down gracefully...")
  process.exit(0)
})