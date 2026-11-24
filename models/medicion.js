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


    // Número de medición dentro de su nivel de control
    numeroMedicion: {
      type: Number,
      min: 1,
      max: 2,
      default: null,
    },

    // Posición real de procesamiento dentro de la corrida
    ordenAnalitico: {
      type: Number,
      min: 1,
      default: null,
    },

    // Fecha y hora real de procesamiento, cuando se conozca
    fechaHoraMedicion: {
      type: Date,
      default: null,
    },


    corridaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CorridaControl",
      default: null,
    },

    // identificar de forma única una solicitud de reemplazo
    claveIdempotencia: {
      type: String,
      default: null,
      trim: true,
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


// impedir que una misma clave de reemplazo se registre dos veces
medicionSchema.index(
  { claveIdempotencia: 1 },
  {
    unique: true,
    partialFilterExpression: {
      claveIdempotencia: { $type: "string" }
    }
  }
);


medicionSchema.index({
  prueba: 1,
  lote: 1,
  equipo: 1,
  corridaId: 1,
  ordenAnalitico: 1
});



module.exports = mongoose.model("Medicion", medicionSchema);
