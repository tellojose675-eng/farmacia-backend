const express = require('express');
const router = express.Router();
const Venta = require('../models/Venta');

// Obtener todas las ventas
router.get('/', async (req, res) => {
    try {
        const ventas = await Venta.find();
        res.json(ventas);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Registrar una venta
router.post('/', async (req, res) => {
    const venta = new Venta({
        productoNombre: req.body.productoNombre,
        cantidad: req.body.cantidad,
        total: req.body.total,
        fecha: req.body.fecha || Date.now()
    });

    try {
        const nuevaVenta = await venta.save();
        res.status(201).json(nuevaVenta);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
