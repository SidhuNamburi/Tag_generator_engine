const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { type: String, required: true },
  type: { type: String, enum: ['link', 'pdf'], required: true },
  category: { type: String, enum: ['Public', 'Private', 'Restricted', 'Trash'], required: true },
  contentUrl: { type: String, required: true }, 
  size: { type: String }, 
  
  // 👇 THE TWO NEW FIELDS FOR YOUR AI BACKEND 👇
  tags: [{ type: String }], // This tells Mongoose to expect an array of strings
  metadata: { type: mongoose.Schema.Types.Mixed }, // This lets Mongoose accept the entire complex ML dictionary safely
  // 👇 THE MEMORY FIELD 👇
  previousCategory: { type: String },
  createdAt: { type: Date, default: Date.now },

  // 👇 THE NEW TRASH TRACKER 👇
  trashedAt: { type: Date, default: null } 
});

// 👇 THE 30-DAY AUTO-DELETE MAGIC 👇
// MongoDB will automatically delete documents 30 days (2592000 seconds) after the 'trashedAt' date.
// If 'trashedAt' is null, MongoDB ignores it and keeps the file safe!
documentSchema.index({ trashedAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Document', documentSchema);