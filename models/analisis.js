
const mongoose = require('mongoose');

const analisisSchema = new mongoose.Schema({

    prueba: {
        type: String,
        required: true,
        trim: true
    },

    media: {
        type: Number,
        required: true
    },

    desviacionEstandar: {
        type: Number,
        required: true
    },

    coeficienteVariacion: {
        type: Number,
        required: true
    },

    totalMediciones: {
        type: Number,
        required: true
    },

    mediciones: [{
        fecha: {
            type: Date,
            required: true
        },
        valor: {
            type: Number,
            required: true
        }
    }]

}, {
    timestamps: true,
    collection: 'analisis'
});

module.exports = mongoose.model('Analisis', analisisSchema);
