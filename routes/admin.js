const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');

// Umbral de similitud coseno (82% de coincidencia recomendado para MobileFaceNet)
const SIMILARITY_THRESHOLD = 0.82;

// Función para calcular similitud coseno entre dos vectores (embeddings)
function calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
        return 0.0;
    }
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0.0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 1. Obtener estado del registro facial del administrador
router.get('/face-status', async (req, res) => {
    try {
        const admin = await Admin.findOne({ username: 'admin' });
        if (!admin) {
            return res.status(404).json({ hasFace: false, message: 'Administrador no encontrado.' });
        }
        const hasFace = admin.faceEmbedding && admin.faceEmbedding.length > 0;
        res.json({ hasFace: hasFace });
    } catch (err) {
        console.error('Error al obtener estado facial:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// 2. Registrar el embedding facial del administrador
router.post('/register-face', async (req, res) => {
    try {
        const { faceEmbedding } = req.body;
        if (!faceEmbedding || !Array.isArray(faceEmbedding) || faceEmbedding.length === 0) {
            return res.status(400).json({ success: false, message: 'Embedding de rostro inválido o vacío.' });
        }

        const admin = await Admin.findOne({ username: 'admin' });
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Administrador no encontrado.' });
        }

        admin.faceEmbedding = faceEmbedding;
        await admin.save();

        console.log(`✅ Rostro registrado en MongoDB para el usuario: ${admin.username} (${faceEmbedding.length} elementos)`);
        res.json({ success: true, message: '¡Rostro biométrico registrado correctamente en MongoDB!' });
    } catch (err) {
        console.error('Error al registrar rostro:', err);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// 3. Verificar rostro del administrador (Comparación Vectorial)
router.post('/verify-face', async (req, res) => {
    try {
        const { faceEmbedding } = req.body;
        if (!faceEmbedding || !Array.isArray(faceEmbedding) || faceEmbedding.length === 0) {
            return res.status(400).json({ success: false, message: 'Embedding de rostro enviado es inválido.' });
        }

        const admin = await Admin.findOne({ username: 'admin' });
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Administrador no encontrado.' });
        }

        if (!admin.faceEmbedding || admin.faceEmbedding.length === 0) {
            return res.status(400).json({ success: false, message: 'El administrador aún no tiene un rostro registrado en la base de datos.' });
        }

        // Calcular similitud coseno entre el rostro actual y el de la base de datos
        const similarity = calculateCosineSimilarity(faceEmbedding, admin.faceEmbedding);
        const match = similarity >= SIMILARITY_THRESHOLD;

        console.log(`Inferencia vectorial -> Similitud Calculada: ${(similarity * 100).toFixed(2)}% | Umbral: ${(SIMILARITY_THRESHOLD * 100).toFixed(2)}% | Coincidencia: ${match}`);

        if (match) {
            res.json({ 
                success: true, 
                similarity: similarity, 
                message: '✅ Acceso concedido: Rostro verificado con éxito.' 
            });
        } else {
            res.status(401).json({ 
                success: false, 
                similarity: similarity, 
                message: '❌ Acceso denegado: El rostro no coincide con el registrado.' 
            });
        }
    } catch (err) {
        console.error('Error al verificar rostro:', err);
        res.status(500).json({ success: false, error: 'Error del servidor' });
    }
});

module.exports = router;
