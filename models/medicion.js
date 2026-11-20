const mongoose = require("mongoose");

const medicionSchema = new mongoose.Schema(
  {
    prueba: {
      type: String,
      required: true,
      trim: true,
    },

    nivelControl: {
      type: String,
      required: false,
      trim: true,
    },

    valor: {
      type: Number,
      required: true,
    },

    fecha: {
      type: Date,
      required: true,
    },

    // Identificar la etapa de la medición
    tipoMedicion: {
      type: String,
      enum: ["inicial", "seguimiento"],
      default: "inicial",
      required: true,
    },

    lote: {
      type: String,
      required: false,
      trim: true,
    },

    equipo: {
      type: String,
      required: false,
      trim: true,
    },

    // Identificador del análisis al que pertenece la medición
    analisisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Analisis",
      default: null,
    },

    corridaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CorridaControl",
    default: null,
},

    // Estado de la medición
    estado: {
      type: String,
      enum: ["pendiente_revision", "valida", "excluida"],
      default: "valida",
    },

    decisionRevision: {
      type: String,
      enum: ["conservar", "excluir"],
      default: null,
    },

    firmaConjuntoRevision: {
      type: String,
      default: null,
    },

    // Documentación de la investigación
    investigacion: {
      observaciones: {
        type: String,
        default: "",
      },
      fechaRevision: {
        type: Date,
        default: null,
      },
    },

    // Documentación de una exclusión autorizada
    exclusion: {
      motivo: {
        type: String,
        default: "",
      },
      autorizadoPor: {
        type: String,
        default: "",
      },
      fechaExclusion: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    collection: "mediciones",
  },
);

module.exports = mongoose.model("Medicion", medicionSchema);
