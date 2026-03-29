const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // 👈 We added this!
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);