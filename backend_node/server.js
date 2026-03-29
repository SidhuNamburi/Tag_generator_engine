require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');
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
    }, { new: true });

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

// 10. AI WEBHOOK (The "Loudspeaker" for Python)
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
server.listen(PORT, () => {
  console.log(`🚀 TagAndTrail Backend (with WebSockets) running on port ${PORT}`);
});