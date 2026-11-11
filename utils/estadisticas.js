
function calcularEstadisticas(valores) {

    if (!Array.isArray(valores) || valores.length !== 20) {
        throw new Error('Se necesitan exactamente 20 mediciones.');
    }

    if (!valores.every(valor => Number.isFinite(valor))) {
        throw new Error('Todas las mediciones deben ser números válidos.');
    }

    const total = valores.length;

    const suma = valores.reduce((acumulado, valor) => acumulado + valor, 0);

    const media = suma / total;

    const sumaCuadrados = valores.reduce((acumulado, valor) => {
        return acumulado + Math.pow(valor - media, 2);
    }, 0);

    const desviacionEstandar = Math.sqrt(sumaCuadrados / (total - 1));

    const coeficienteVariacion = media !== 0
        ? (desviacionEstandar / Math.abs(media)) * 100
        : null;

    return {
        totalMediciones: total,
        media: Number(media.toFixed(4)),
        desviacionEstandar: Number(desviacionEstandar.toFixed(4)),
        coeficienteVariacion: coeficienteVariacion === null
            ? null
            : Number(coeficienteVariacion.toFixed(4))
    };
}

module.exports = { calcularEstadisticas };
