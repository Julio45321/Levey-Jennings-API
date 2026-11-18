const mongoose = require("mongoose");

const analisisSchema = new mongoose.Schema(
  {
    prueba: {
      type: String,
      required: true,
      trim: true,
    },

    // Nivel del material de control
    nivelControl: {
      type: String,
      trim: true,
      default: null,
    },

    // Lote del material de control
    lote: {
      type: String,
      trim: true,
      default: null,
    },

    // Equipo utilizado
    equipo: {
      type: String,
      trim: true,
      default: null,
    },

    media: {
      type: Number,
      default: null,
    },

    desviacionEstandar: {
      type: Number,
      default: null,
    },

    coeficienteVariacion: {
      type: Number,
      default: null,
    },

    totalMediciones: {
      type: Number,
      default: 0,
    },

    mediciones: [
      {
        fecha: {
          type: Date,
          required: true,
        },
        valor: {
          type: Number,
          required: true,
        },
      },
    ],

    analisisGrubbs: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },


versionReemplazos: {
  type: Number,
  default: 0,
  min: 0
},

    
// Estado del análisis
estado: {
    type: String,
    enum: [
        "en_recopilacion",
        "pendiente_revision",
        "requiere_reemplazo",
        "requiere_revision_empate",
        "completo"
    ],
    default: "en_recopilacion"
},



    // Cantidad de mediciones válidas necesarias
    medicionesRequeridas: {
      type: Number,
      default: 20,
    },

    // Cantidad de mediciones válidas registradas
    totalMedicionesValidas: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "analisis",
  },
);


/*
 * Evitar análisis iniciales activos duplicados.
 * Se permiten múltiples análisis históricos completos.
 */
analisisSchema.index(
    {
        prueba: 1,
        nivelControl: 1,
        lote: 1,
        equipo: 1
    },
    {
        unique: true,
        name: "unico_analisis_activo",
        
        partialFilterExpression: {
            estado: {
                $in: [
                    "en_recopilacion",
                    "pendiente_revision",
                    "requiere_reemplazo"
                ]
            }
        }
    }
);



/*
 * Nuevo índice único para proteger todos los
 * estados activos, incluyendo revisión de empate.
 */
analisisSchema.index(
    {
        prueba: 1,
        nivelControl: 1,
        lote: 1,
        equipo: 1
    },
    {
        unique: true,
        name: "unico_analisis_activo_v2",
        partialFilterExpression: {
            estado: {
                $in: [
                    "en_recopilacion",
                    "pendiente_revision",
                    "requiere_reemplazo",
                    "requiere_revision_empate"
                ]
            }
        }
    }
);



module.exports = mongoose.model("Analisis", analisisSchema);
