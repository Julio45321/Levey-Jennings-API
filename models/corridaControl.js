const mongoose = require("mongoose");

const corridaControlSchema = new mongoose.Schema(
  {
    // Nombre de la prueba
    prueba: {
      type: String,
      required: true,
      trim: true,
    },

    // Lote del material de control
    lote: {
      type: String,
      required: true,
      trim: true,
    },

    // Equipo utilizado
    equipo: {
      type: String,
      required: true,
      trim: true,
    },

    // Fecha de la corrida
    fechaCorrida: {
      type: Date,
      required: true,
    },

    // Niveles utilizados en la corrida
    niveles: [
      {
        nombre: {
          type: String,
          required: true,
        },

        tipo: {
          type: String,
          enum: ["bajo", "normal", "alto"],
          required: true,
        },
      },
    ],

    // Cantidad de mediciones por nivel
    medicionesPorNivel: {
      type: Number,
      required: true,
      enum: [1, 2],
    },

    // Número total de resultados de control
    N: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4, 6],
    },
// Estado de la corrida de control
estado: {
    type: String,
    enum: [
        "registrada",
        "pendiente_evaluacion",
        "advertencia",
        "aceptada",
        "rechazada"
    ],
    default: "registrada",
},

// Evaluación de Westgard
evaluacionWestgard: {

    fechaEvaluacion: {
        type: Date,
        default: null,
    },

    reglasConfiguradas: {
        type: [String],
        default: [],
    },

    reglasEvaluadas: {
        type: [String],
        default: [],
    },

    reglasNoEvaluadas: {
        type: [String],
        default: [],
    },

    parametrosUtilizados: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
    },

    medicionesEvaluadas: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
    },

    alertas: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
    },

    mensaje: {
        type: String,
        default: "",
    },

    versionEvaluacion: {
        type: String,
        default: null,
    },

},

  },
  {
    timestamps: true,
    collection: "corridasControl",
  },
);

module.exports = mongoose.model("CorridaControl", corridaControlSchema);
