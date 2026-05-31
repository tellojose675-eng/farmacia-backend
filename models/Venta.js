const mongoose = require('mongoose');

const ventaSchema = new mongoose.Schema({
    productoNombre: { type: String, required: true },
    cantidad: { type: Number, required: true },
    total: { type: Number, required: true },
    fecha: { type: Number, required: true } // Almacenando fecha como timestamp (long) para que coincida con Android
}, {
    timestamps: true
});

module.exports = mongoose.model('Venta', ventaSchema);
