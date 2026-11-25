
const Decimal = require("decimal.js");

// Configuracion independiente de precision estadistica.

const DecimalEstadistico = Decimal.clone({
    precision: 50,
    rounding: Decimal.ROUND_HALF_EVEN
});


// Validar y convertir un numero a formato decimal.

function convertirDecimal(valor, nombre = "Valor") {

    if (!Number.isFinite(valor)) {
        throw new Error(
            `${nombre} debe ser un numero finito.`
        );
    }

    return new DecimalEstadistico(
        valor.toString()
    );
}


// Validar los parametros estadisticos.

function validarDatosEstadisticos(
    valor,
    media,
    desviacionEstandar
) {

    const valorDecimal =
        convertirDecimal(valor, "La medicion");

    const mediaDecimal =
        convertirDecimal(media, "La media");

    const desviacionDecimal =
        convertirDecimal(
            desviacionEstandar,
            "La desviacion estandar"
        );

    if (desviacionDecimal.lte(0)) {

        throw new Error(
            "La desviacion estandar debe ser mayor que cero."
        );
    }

    return {

        valorDecimal,
        mediaDecimal,
        desviacionDecimal
    };
}


// Calcular Z-score mediante aritmetica decimal.

function calcularZScoreDecimal(
    valor,
    media,
    desviacionEstandar
) {

    const {

        valorDecimal,
        mediaDecimal,
        desviacionDecimal

    } = validarDatosEstadisticos(
        valor,
        media,
        desviacionEstandar
    );

    return valorDecimal
        .minus(mediaDecimal)
        .div(desviacionDecimal);
}


// Comparar una medicion contra un limite de DE.
// Evita utilizar la division para decidir
// si una medicion alcanza un limite.

function compararLimiteZ(
    valor,
    media,
    desviacionEstandar,
    limite
) {

    const {

        valorDecimal,
        mediaDecimal,
        desviacionDecimal

    } = validarDatosEstadisticos(
        valor,
        media,
        desviacionEstandar
    );

    const limiteDecimal =
        convertirDecimal(limite, "El limite Z");

    const diferencia =
        valorDecimal.minus(mediaDecimal);

    const limiteCalculado =
        desviacionDecimal.times(limiteDecimal);

    return diferencia.comparedTo(
        limiteCalculado
    );
}


// Calcular un limite de control.

function calcularLimiteControlDecimal(
    media,
    desviacionEstandar,
    limite
) {

    const mediaDecimal =
        convertirDecimal(media, "La media");

    const desviacionDecimal =
        convertirDecimal(
            desviacionEstandar,
            "La desviacion estandar"
        );

    const limiteDecimal =
        convertirDecimal(limite, "El limite Z");

    if (desviacionDecimal.lte(0)) {

        throw new Error(
            "La desviacion estandar debe ser mayor que cero."
        );
    }

    return mediaDecimal.plus(
        desviacionDecimal.times(limiteDecimal)
    );
}


// Exportar las funciones.

module.exports = {

    convertirDecimal,
    validarDatosEstadisticos,
    calcularZScoreDecimal,
    compararLimiteZ,
    calcularLimiteControlDecimal
};
