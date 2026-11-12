const mongoose = require('mongoose');

const medicionSchema = new mongoose.Schema({

    prueba: {
        type: String,
        required: true,
        trim: true
    },

    nivelControl: {
        type: String,
        required: false,
        trim: true
    },

    valor: {
        type: Number,
        required: true
    },

    fecha: {
        type: Date,
        required: true
    },

    lote: {
        type: String,
        required: false,
        trim: true
    },

    equipo: {
        type: String,
        required: false,
        trim: true
    },


    // Identificador del análisis al que pertenece la medición
    analisisId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Analisis',
        default: null
    },


    // Estado de la medición
    estado: {
        type: String,
        enum: ['pendiente_revision', 'valida', 'excluida'],
        default: 'valida'
    },

    // Documentación de la investigación
    investigacion: {
        observaciones: {
            type: String,
            default: ''
        },
        fechaRevision: {
            type: Date,
            default: null
        }
    },

    // Documentación de una exclusión autorizada
    exclusion: {
        motivo: {
            type: String,
            default: ''
        },
        autorizadoPor: {
            type: String,
            default: ''
        },
        fechaExclusion: {
            type: Date,
            default: null
        }
    }

}, {
    timestamps: true,
    collection: 'mediciones'
});

module.exports = mongoose.model('Medicion', medicionSchema);
