
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
    }

}, {
    timestamps: true,
    collection: 'mediciones'
});

module.exports = mongoose.model('Medicion', medicionSchema);
