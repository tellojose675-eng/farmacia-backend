const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    faceEmbedding: { type: [Number], default: [] } // Array de 192 números decimales de FaceNet
});

module.exports = mongoose.model('Admin', adminSchema);
