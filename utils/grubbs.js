
const { jStat } = require('jstat');

// Prueba de Grubbs para detectar un posible valor atípico
function pruebaGrubbs(datos, nivelSignificancia = 0.05) {

    // Validar que recibamos un conjunto de datos
    if (!Array.isArray(datos) || datos.length < 3) {
        return {
            error: 'Se necesitan al menos 3 mediciones para realizar la prueba de Grubbs.'
        };
    }

    // Validar que todos los valores sean números válidos
    if (!datos.every(valor => Number.isFinite(valor))) {
        return {
            error: 'Todos los datos deben ser números válidos.'
        };
    }

    // Calcular la media
    const n = datos.length;

    const media = datos.reduce((suma, valor) => suma + valor, 0) / n;

    // Calcular la desviación estándar muestral
    const sumaCuadrados = datos.reduce(
        (suma, valor) => suma + Math.pow(valor - media, 2),
        0
    );

    const desviacionEstandar = Math.sqrt(sumaCuadrados / (n - 1));

    // Evitar división entre cero
    if (desviacionEstandar === 0) {
        return {
            error: 'No se puede realizar Grubbs porque todas las mediciones son iguales.'
        };
    }

    // Buscar el valor más alejado de la media
    const valoresDistancias = datos.map(valor => Math.abs(valor - media));

    const indiceMayor = valoresDistancias.indexOf(
        Math.max(...valoresDistancias)
    );

    const valorSospechoso = datos[indiceMayor];

    // Calcular estadístico G
    const G = Math.abs(valorSospechoso - media) / desviacionEstandar;

    // Calcular valor crítico
    const alfa = nivelSignificancia;

    const tCritico = jStat.studentt.inv(
        1 - alfa / (2 * n),
        n - 2
    );

    const Gcritico =
        ((n - 1) / Math.sqrt(n)) *
        Math.sqrt(
            Math.pow(tCritico, 2) /
            (n - 2 + Math.pow(tCritico, 2))
        );

    // Determinar resultado
    const esAtipico = G > Gcritico;

    return {
        metodo: 'Prueba de Grubbs',
        numeroMediciones: n,
        media: Number(media.toFixed(4)),
        desviacionEstandar: Number(desviacionEstandar.toFixed(4)),
        valorSospechoso,
        indiceValorSospechoso: indiceMayor,
        estadisticoG: Number(G.toFixed(4)),
        valorCritico: Number(Gcritico.toFixed(4)),
        nivelSignificancia: alfa,
        resultado: esAtipico
            ? 'Posible valor atípico detectado'
            : 'No se detectaron valores atípicos',
        esAtipico
    };
}

module.exports = {
    pruebaGrubbs
};
