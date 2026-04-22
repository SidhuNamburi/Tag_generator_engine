require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');

// 👇 NEW IMPORTS FOR MANUAL UPLOAD
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;

// Import our new Blueprints (Models)
const User = require('./models/User');
const Document = require('./models/Document');

// Wrap Express with HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Allows your React Native app to connect without CORS issues
    methods: ["GET", "POST"]
  }
});

// Just to log when the app connects or disconnects
io.on('connection', (socket) => {
  console.log(`🔌 Frontend connected to Loudspeaker: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🛑 Frontend disconnected: ${socket.id}`);
  });
});

app.use(cors());
app.use(express.json());

// ─── NGROK BYPASS ───
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

app.get('/', (req, res) => {
  res.status(200).json({ 
    status: "online", 
    message: "Tag & Trail Node Backend is running",
    socket_status: io.sockets.connected ? "active" : "waiting"
  });
});

// 👇 CLOUDINARY & MULTER CONFIG
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const upload = multer({ dest: 'uploads/' });

// ─── DATABASE CONNECTION ───
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas!'))
  .catch((err) => console.error('❌ MongoDB connection failed:', err.message));

// ==========================================
// ─── API ROUTES ───
// ==========================================

// 1. REGISTER NEW USER ROUTE
app.post('/api/auth/register', async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res.status(400).json({ error: "Phone number and password are required" });
    }

    let user = await User.findOne({ phoneNumber });
    if (user) {
      return res.status(400).json({ error: "User already exists. Please login." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ phoneNumber, password: hashedPassword });
    await user.save();

    console.log(`✨ New user created: ${phoneNumber}`);
    res.json({ _id: user._id, phoneNumber: user.phoneNumber });

  } catch (error) {
    res.status(500).json({ error: "Server error during registration" });
  }
});

// 2. LOGIN EXISTING USER ROUTE
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res.status(400).json({ error: "Phone number and password are required" });
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(400).json({ error: "User not found. Please create an account." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    console.log(`👋 User logged in: ${phoneNumber}`);
    res.json({ _id: user._id, phoneNumber: user.phoneNumber });

  } catch (error) {
    res.status(500).json({ error: "Server error during login" });
  }
});

// ------------------------------------------
// ─── PHASE 1: DOCUMENT ROUTES ───
// ------------------------------------------

// 3. GET DOCUMENTS BY CATEGORY (Sorted newest first)
app.get('/api/documents/category/:userId/:category', async (req, res) => {
  try {
    const { userId, category } = req.params;
    const docs = await Document.find({ userId, category }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents by category" });
  }
});

// 4. GET RECENT DOCUMENTS (Top 10 across all categories EXCEPT Trash)
app.get('/api/documents/recent/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🚨 React Native is asking for documents belonging to: ${userId}`);
    const docs = await Document.find({
      userId,
      category: { $ne: 'Trash' }
    }).sort({ createdAt: -1 }).limit(10);

    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch recent documents" });
  }
});

// 5. GET PLATFORM STATS (Calculates totals in parallel for speed)
app.get('/api/documents/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [
      total_docs, safe_docs, total_links, total_pdfs,
      public_count, private_count, restricted_count, trash_count
    ] = await Promise.all([
      Document.countDocuments({ userId, category: { $ne: 'Trash' } }),
      Document.countDocuments({ userId, security_status: 'safe', category: { $ne: 'Trash' } }),
      Document.countDocuments({ userId, type: 'link', category: { $ne: 'Trash' } }),
      Document.countDocuments({ userId, type: 'pdf', category: { $ne: 'Trash' } }),
      Document.countDocuments({ userId, category: 'Public' }),
      Document.countDocuments({ userId, category: 'Private' }),
      Document.countDocuments({ userId, category: 'Restricted' }),
      Document.countDocuments({ userId, category: 'Trash' })
    ]);

    res.json({
      total_docs, safe_docs, total_links, total_pdfs,
      public_count, private_count, restricted_count, trash_count
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// 6. SOFT DELETE (Capture Memory)
app.put('/api/documents/trash/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    const doc = await Document.findById(docId);

    if (!doc) return res.status(404).json({ error: "Not found" });

    console.log(`🗑️ Trashing: ${doc.title} | Original Category: ${doc.category}`);

    const updatedDoc = await Document.findByIdAndUpdate(docId, {
      previousCategory: doc.category, // Capture the memory
      category: 'Trash',
      trashedAt: new Date()
    }, { returnDocument: 'after' });

    res.json(updatedDoc);
  } catch (error) {
    res.status(500).json({ error: "Trash failed" });
  }
});

// 7. RESTORE (The Logic Fix)
app.put('/api/documents/restore/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    const doc = await Document.findById(docId);

    if (!doc) return res.status(404).json({ error: "Not found" });

    // 1. If flagged -> ALWAYS Restricted
    // 2. If safe -> Go to previousCategory OR default to Private
    let target = doc.previousCategory || 'Private';
    if (doc.security_status === 'flagged') {
      target = 'Restricted';
    }

    console.log(`♻️ Restoring: ${doc.title} | Status: ${doc.security_status} | Sending to: ${target}`);

    await Document.findByIdAndUpdate(docId, {
      category: target,
      trashedAt: null,
      previousCategory: null
    });

    res.json({ message: "Success", category: target });
  } catch (error) {
    res.status(500).json({ error: "Restore failed" });
  }
});

// 8. PERMANENT DELETE (Single Document)
app.delete('/api/documents/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    await Document.findByIdAndDelete(docId);
    res.json({ message: "Document permanently deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// 9. EMPTY TRASH (Delete all trash for a user)
app.delete('/api/documents/empty-trash/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    // Wipes everything in the Trash category for this specific user
    const result = await Document.deleteMany({ userId, category: 'Trash' });
    res.json({ message: `Emptied ${result.deletedCount} documents from Trash` });
  } catch (error) {
    res.status(500).json({ error: "Failed to empty trash" });
  }
});

// 👇 THE NEW ROUTE: 10. MANUAL UPLOAD RELAY
// 👇 THE NEW ROUTE: 10. MANUAL UPLOAD RELAY (WITH AGGRESSIVE RETRY)
app.post('/api/documents/manual-upload', upload.single('file'), async (req, res) => {
  try {
    const { userId, type, url } = req.body;
    let finalUrl = url;

    // If it's a PDF, upload it to Cloudinary first
    if (type === 'pdf' && req.file) {
      console.log("📥 Catching PDF from App, uploading to Cloudinary...");
      
      const cloudRes = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_large(
          req.file.path, 
          { resource_type: "raw" }, 
          function(error, result) {
            if (error) {
              console.error("☁️ Cloudinary Upload Error:", error);
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
      });
      
      console.log("☁️ Cloudinary URL:", cloudRes.secure_url);
      finalUrl = cloudRes.secure_url;
      
      // Delete the temp file off the Node server to save space
      fs.unlinkSync(req.file.path);
    }

    // Prepare the clean JSON payload for Python
    const pythonPayload = {
      userId: userId,
      type: type,
      url: finalUrl
    };

    console.log("🚀 Firing payload to Python AI Engine:", pythonPayload);
    const PYTHON_RENDER_URL = 'https://tag-generator-engine.onrender.com/manual';

    // 🔥 THE TWILIO SECRET: Aggressive Retry Loop 🔥
    let pythonRes = null;
    let retries = 5; // Will try 5 times (approx 40 seconds of waiting)

    while (retries > 0) {
      try {
        console.log(`⏳ Knocking on Python's door... (Retries left: ${retries})`);
        
        // 👇 FIX: The critical 10-second timeout. If Python takes longer than 10s to reply, 
        // Node hangs up and immediately tries again instead of freezing!
        pythonRes = await axios.post(PYTHON_RENDER_URL, pythonPayload, { timeout: 10000 });
        
        break; // IT WORKED! Break out of the loop!
      } catch (axiosErr) {
        retries--;
        
        if (retries === 0) {
          console.log("❌ Python never woke up. Giving up.");
          return res.status(500).json({ error: "Python server failed to wake up after multiple attempts." });
        }
        
        // This will now catch timeout errors AND 502 Bad Gateway errors
        console.log(`😴 Python didn't answer (${axiosErr.code || axiosErr.message}). Waiting 8 seconds...`);
        // Wait exactly 8 seconds before looping again
        await new Promise(resolve => setTimeout(resolve, 8000));
      }
    }

    // If we made it here, Python successfully answered!
    console.log(`✅ Python replied with Status ${pythonRes.status}:`, pythonRes.data);
    res.status(200).json({ message: "Sent to AI Engine successfully" });

  } catch (error) {
    console.error("❌ Manual upload failed:", error);
    res.status(500).json({ error: "Server error during upload" });
  }
});

// 11. AI WEBHOOK (The "Loudspeaker" for Python)
app.post('/api/ai/webhook', (req, res) => {
  try {
    // Python will send these details in its POST request
    const { title, security_status, message } = req.body;

    // Build the temporary log object for the frontend session
    const liveLog = {
      id: Date.now().toString(),
      message: message || `AI Analysis complete for "${title}"`,
      status: security_status === 'flagged' ? 'warning' : 'success',
      timestamp: new Date().toLocaleTimeString()
    };

    console.log(`📣 Broadcasting to App: ${liveLog.message}`);

    // 🔥 THIS IS THE MAGIC: Broadcasts the log & refresh command to the App
    io.emit('AI_UPDATE', liveLog);

    res.json({ success: true, message: "Node successfully shouted to the App!" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Failed to broadcast signal" });
  }
});

// ==========================================

// ─── START SERVER ───
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TagAndTrail Backend (with WebSockets) running on port ${PORT}`);
});