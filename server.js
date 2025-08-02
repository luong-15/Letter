const express = require("express")
const bodyParser = require("body-parser")
const path = require("path")
const cors = require("cors")

const app = express()

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")))

// Lazy load Google APIs only when needed
let google = null
let googleAuth = null
let SPREADSHEET_ID = process.env.SPREADSHEET_ID

// Initialize Google Auth only when needed
async function createGoogleAuth() {
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || !process.env.SPREADSHEET_ID) {
      console.log("⚠️  Google Sheets not configured.")
      return null
    }

    // Lazy load googleapis
    if (!google) {
      google = require("googleapis").google
    }

    console.log("🔑 Creating Google Auth...")
    
    let credentials
    try {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    } catch (parseError) {
      console.error("❌ Error parsing Google credentials:", parseError.message)
      return null
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
  const auth = await createGoogleAuth()
  if (!auth) {
    throw new Error("Google Sheets not configured")
  }
  
  const authClient = await auth.getClient()
  return google.sheets({ version: "v4", auth: authClient })
}

// Routes
app.get("/", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "public", "index.html"))
  } catch (error) {
    console.error("Error serving index.html:", error)
    res.status(500).send("Error loading page")
  }
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
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
              req.headers['x-real-ip'] || 
              req.headers['cf-connecting-ip'] || 
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

    // Try to save to Google Sheets
    let sheetsSuccess = false
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && SPREADSHEET_ID) {
      try {
        console.log("📊 Attempting to save to Google Sheets...")
        
        const sheetsClient = await getSheetsClient()
        
        const values = [
          [timestamp, choice, feedback || "", ip, userAgent.substring(0, 200)]
        ]
        
        // Try multiple sheet names
        const sheetNames = ["result_cr", "Sheet1", "responses", "data"]
        let appendSuccess = false
        
        for (const sheetName of sheetNames) {
          try {
            const response = await sheetsClient.spreadsheets.values.append({
              spreadsheetId: SPREADSHEET_ID,
              range: `${sheetName}!A:E`,
              valueInputOption: "USER_ENTERED",
              insertDataOption: "INSERT_ROWS",
              resource: {
                values: values
              }
            })
            
            console.log(`✅ Successfully saved to Google Sheets (${sheetName})`)
            console.log(`📊 Updated range: ${response.data.updates.updatedRange}`)
            appendSuccess = true
            sheetsSuccess = true
            break
          } catch (sheetError) {
            if (sheetError.code === 400 && sheetError.message.includes("Unable to parse range")) {
              console.log(`⚠️ Sheet '${sheetName}' not found, trying next...`)
              continue
            } else {
              throw sheetError
            }
          }
        }
        
        if (!appendSuccess) {
          console.error("❌ No valid sheet found. Please ensure you have a sheet named 'result_cr', 'Sheet1', 'responses', or 'data'")
        }
        
      } catch (sheetsError) {
        console.error("❌ Google Sheets error:", sheetsError.message)
        
        if (sheetsError.code === 403) {
          console.error("❌ Permission denied. Share the spreadsheet with service account email")
        } else if (sheetsError.code === 404) {
          console.error("❌ Spreadsheet not found. Check SPREADSHEET_ID")
        }
      }
    } else {
      console.log("⚠️  Google Sheets not configured")
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

    console.log(sheetsSuccess ? "✅ Response saved to spreadsheet" : "⚠️  Response logged only")
    console.log("─".repeat(50))

    // Send successful response
    res.status(200).send(responseMessage)

  } catch (error) {
    console.error("❌ Error processing response:", error.message)
    
    // Send positive response even on error
    const fallbackMessage = req.body?.choice === "yes" 
      ? "🎉 Anh đã nhận được phản hồi của em! Anh rất hạnh phúc! 💕"
      : "💙 Anh đã nhận được phản hồi của em. Cảm ơn em đã thành thật!"
    
    res.status(200).send(fallbackMessage)
  }
})

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
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
  } catch (error) {
    console.error("Health check error:", error)
    res.status(500).json({
      status: "ERROR",
      error: error.message
    })
  }
})

// Debug endpoint
app.get("/debug/sheets", async (req, res) => {
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || !SPREADSHEET_ID) {
      return res.json({
        status: "not ready",
        configured: false,
        error: "Missing environment variables"
      })
    }

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

// Serve static files for any other routes
app.get("*", (req, res) => {
  try {
    // Check if it's a static file request
    const ext = path.extname(req.path)
    if (ext) {
      // Try to serve static file
      const filePath = path.join(__dirname, "public", req.path)
      res.sendFile(filePath, (err) => {
        if (err) {
          res.status(404).send("File not found")
        }
      })
    } else {
      // Serve index.html for all other routes (SPA support)
      res.sendFile(path.join(__dirname, "public", "index.html"))
    }
  } catch (error) {
    console.error("Error serving file:", error)
    res.status(500).send("Error loading page")
  }
})

// Error handler
app.use((error, req, res, next) => {
  console.error("Server error:", error)
  res.status(500).json({
    error: "Internal server error",
    message: error.message
  })
})

// Export for Vercel
module.exports = app