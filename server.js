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

// Google Sheets setup - optimized for serverless
let googleAuth
let SPREADSHEET_ID = process.env.SPREADSHEET_ID

// Initialize Google Auth for each request (serverless-friendly)
function createGoogleAuth() {
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || !process.env.SPREADSHEET_ID) {
      console.log("⚠️  Google Sheets not configured. Missing environment variables.")
      return null
    }

    console.log("🔑 Creating Google Auth...")
    
    let credentials
    try {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    } catch (parseError) {
      console.error("❌ Error parsing Google credentials JSON:", parseError.message)
      return null
    }

    // Validate required fields in credentials
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email']
    for (const field of requiredFields) {
      if (!credentials[field]) {
        console.error(`❌ Missing required field in credentials: ${field}`)
        return null
      }
    }

    // Create auth instance
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    console.log("✅ Google Auth created successfully")
    return auth

  } catch (error) {
    console.error("❌ Google Auth creation error:", error.message)
    return null
  }
}

// Helper function to get authenticated sheets client
async function getSheetsClient() {
  const auth = createGoogleAuth()
  if (!auth) {
    throw new Error("Google Sheets not configured")
  }
  
  const authClient = await auth.getClient()
  return google.sheets({ version: "v4", auth: authClient })
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

    // Extract request info - improved for Vercel
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
              req.headers['x-real-ip'] || 
              req.headers['cf-connecting-ip'] || // Cloudflare
              req.connection?.remoteAddress || 
              req.socket?.remoteAddress ||
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
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && SPREADSHEET_ID) {
      try {
        console.log("📊 Attempting to save to Google Sheets...")
        
        // Get authenticated client for this request
        const sheetsClient = await getSheetsClient()
        
        const values = [
          [timestamp, choice, feedback || "", ip, userAgent]
        ]
        
        console.log("📝 Data to append:", JSON.stringify(values))
        
        // Try to append data with fallback sheet names
        const sheetNames = ["result_cr", "Sheet1", "responses"]
        let appendSuccess = false
        
        for (const sheetName of sheetNames) {
          try {
            const appendRequest = {
              spreadsheetId: SPREADSHEET_ID,
              range: `${sheetName}!A:E`,
              valueInputOption: "USER_ENTERED",
              insertDataOption: "INSERT_ROWS",
              resource: {
                values: values
              }
            }
            
            const response = await sheetsClient.spreadsheets.values.append(appendRequest)
            console.log(`✅ Successfully saved to Google Sheets (${sheetName})`)
            console.log(`📊 Updated range: ${response.data.updates.updatedRange}`)
            console.log(`📈 Rows added: ${response.data.updates.updatedRows}`)
            appendSuccess = true
            sheetsSuccess = true
            break
          } catch (sheetError) {
            console.log(`⚠️ Sheet '${sheetName}' not found, trying next...`)
            continue
          }
        }
        
        if (!appendSuccess) {
          throw new Error("No valid sheet found in the spreadsheet")
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
      console.log("⚠️  Google Sheets not configured - missing credentials or spreadsheet ID")
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
  
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && SPREADSHEET_ID) {
    try {
      const sheetsClient = await getSheetsClient()
      const response = await sheetsClient.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID
      })
      sheetsStatus = `connected - ${response.data.properties.title}`
    } catch (error) {
      sheetsStatus = `error: ${error.message}`
    }
  }

  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    googleSheets: {
      configured: !!(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.SPREADSHEET_ID),
      spreadsheetId: SPREADSHEET_ID ? "configured" : "not configured",
      status: sheetsStatus
    },
    environment: process.env.NODE_ENV || 'development',
    platform: 'vercel'
  })
})

// Debug endpoint for checking Google Sheets connection
app.get("/debug/sheets", async (req, res) => {
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || !SPREADSHEET_ID) {
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
    googleSheets: !!(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && SPREADSHEET_ID),
    platform: "vercel"
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

// Export for Vercel (serverless)
module.exports = app

// Only listen if not in serverless environment
if (require.main === module) {
  app.listen(port, () => {
    console.log("\n🚀 Love Confession Website is running!")
    console.log(`📍 Local: http://localhost:${port}`)
    console.log("💕 Ready to receive love confessions!")
    console.log(`📊 Google Sheets: ${!!(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && SPREADSHEET_ID) ? '✅ Configured' : '❌ Not configured'}`)
    console.log()
  })
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 Server shutting down gracefully...")
  process.exit(0)
})