require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // Aumentamos límite para el array del embedding facial

// Servir la página web estática
app.use(express.static(path.join(__dirname, 'public')));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/farmacia_db';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB (' + MONGODB_URI + ')');
    sembrarDatosIniciales();
  })
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Rutas
app.use('/api/productos', require('./routes/productos'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/admin', require('./routes/admin')); // ← NUEVA RUTA BIOMÉTRICA

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor de Farmacia corriendo en el puerto ${PORT}`);
});

// Insertar datos de ejemplo solo si la BD está vacía
async function sembrarDatosIniciales() {
    const Producto = require('./models/Producto');
    const Admin = require('./models/Admin');

    // --- Sembrar productos ---
    const countProductos = await Producto.countDocuments();
    if (countProductos === 0) {
        console.log('📦 Base de datos vacía, insertando productos de ejemplo...');
        await Producto.insertMany([
            { nombre: 'Paracetamol 500mg', descripcion: 'Analgésico y antipirético.', precio: 2.50, categoria: 'Medicamentos', stock: 50 },
            { nombre: 'Vitamina C 1000mg', descripcion: 'Suplemento vitamínico.', precio: 15.00, categoria: 'Vitaminas', stock: 30 },
            { nombre: 'Alcohol en Gel', descripcion: 'Desinfectante de manos 70%.', precio: 5.00, categoria: 'Cuidado Personal', stock: 25 },
            { nombre: 'Ibuprofeno 400mg', descripcion: 'Antiinflamatorio no esteroideo.', precio: 3.20, categoria: 'Medicamentos', stock: 40 },
            { nombre: 'Jarabe para la tos', descripcion: 'Alivio rápido de la tos seca.', precio: 12.50, categoria: 'Medicamentos', stock: 3 },
            { nombre: 'Crema Hidratante', descripcion: 'Loción corporal para piel seca.', precio: 25.00, categoria: 'Cuidado Personal', stock: 2 },
        ]);
        console.log('✅ Productos de ejemplo insertados correctamente.');
    } else {
        console.log(`✅ Inventario listo con ${countProductos} producto(s).`);
    }

    // --- Sembrar administrador por defecto ---
    const countAdmins = await Admin.countDocuments();
    if (countAdmins === 0) {
        await Admin.create({ username: 'admin', password: 'admin123', faceEmbedding: [] });
        console.log('👤 Administrador por defecto creado: usuario=admin, contraseña=admin123');
        console.log('   ℹ️  Rostro biométrico vacío. El admin deberá registrar su rostro la primera vez.');
    } else {
        const admin = await Admin.findOne({ username: 'admin' });
        const hasFace = admin && admin.faceEmbedding && admin.faceEmbedding.length > 0;
        console.log(`👤 Administrador listo | Rostro biométrico: ${hasFace ? '✅ Registrado' : '⚠️  Sin registrar'}`);
    }
}
