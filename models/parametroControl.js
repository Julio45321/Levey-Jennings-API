
const mongoose = require('mongoose');

const parametroControlSchema = new mongoose.Schema({

    prueba: {
        type: String,
        required: true
    },

    nivelControl: {
        type: String,
        required: true
    },

    lote: {
        type: String,
        required: true
    },

    equipo: {
        type: String,
        required: true
    },

    media: {
        type: Number,
        required: true
    },

    desviacionEstandar: {
        type: Number,
        required: true
    }

}, {
    timestamps: true
});

// Evitar parámetros duplicados para la misma combinación
parametroControlSchema.index(
    { prueba: 1, nivelControl: 1, lote: 1, equipo: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    'ParametroControl',
    parametroControlSchema
);
