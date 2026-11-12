
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
    }],

    analisisGrubbs: {
    type: mongoose.Schema.Types.Mixed,
    default: null
},

    // Estado del análisis
    estado: {
        type: String,
        enum: [
            'pendiente_revision',
            'requiere_reemplazo',
            'completo'
        ],
        default: 'pendiente_revision'
    },

    // Cantidad de mediciones válidas necesarias
    medicionesRequeridas: {
        type: Number,
        default: 20
    },

    // Cantidad de mediciones válidas registradas
    totalMedicionesValidas: {
        type: Number,
        default: 0
    },


}, {
    timestamps: true,
    collection: 'analisis'
});

module.exports = mongoose.model('Analisis', analisisSchema);
