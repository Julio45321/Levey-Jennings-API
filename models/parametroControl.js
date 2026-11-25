
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
    },

    analisisOrigenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Analisis',
        default: null
    },

    estado: {
        type: String,
        enum: ['pendiente_validacion', 'validado'],
        default: 'pendiente_validacion'
    },

    // version de los parametros objetivo

    version: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
        validate: {
            validator: Number.isInteger,
            message: 'La version debe ser un numero entero.'
        }
    },

    // identificar si los parametros estan vigentes

    activo: {
        type: Boolean,
        default: false
    },

    // fecha de validacion de los parametros

    fechaValidacion: {
        type: Date,
        default: null
    },

    // responsable de validar los parametros

    validadoPor: {
        type: String,
        trim: true,
        default: null
    },

    // referencia a la version anterior

    versionAnteriorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParametroControl',
        default: null
    }

}, {
    timestamps: true
});

// evitar parametros duplicados para la misma combinacion

parametroControlSchema.index(
    {
        prueba: 1,
        nivelControl: 1,
        lote: 1,
        equipo: 1
    },
    {
        unique: true
    }
);

// evitar versiones duplicadas de los parametros objetivo
parametroControlSchema.index({
    prueba: 1,
    nivelControl: 1,
    lote: 1,
    equipo: 1,
    version: 1
}, {
    unique: true,
    name: 'parametros_version_unica'
});

// permitir solamente una version activa por conjunto de control
parametroControlSchema.index({
    prueba: 1,
    nivelControl: 1,
    lote: 1,
    equipo: 1
}, {
    unique: true,
    partialFilterExpression: {
        activo: true
    },
    name: 'parametros_activos_unicos'
});

module.exports = mongoose.model(
    'ParametroControl',
    parametroControlSchema
);
