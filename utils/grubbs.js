

const { jStat } = require('jstat');

// Prueba de Grubbs para detectar un posible valor atípico
function pruebaGrubbs(mediciones, nivelSignificancia = 0.05) {

    // Validar el conjunto de datos
    if (!Array.isArray(mediciones) || mediciones.length < 3) {
        return {
            error: 'Se necesitan al menos 3 mediciones para realizar la prueba de Grubbs.'
        };
    }

    // Validar valores
    if (!mediciones.every(m =>
        Number.isFinite(m.valor)
    )) {
        return {
            error: 'Todas las mediciones deben contener valores numéricos válidos.'
        };
    }

    const n = mediciones.length;
    const valores = mediciones.map(m => m.valor);

    // Calcular media
    const suma = valores.reduce((a, b) => a + b, 0);
    const media = suma / n;

    // Desviación estándar muestral
    const sumaCuadrados = valores.reduce(
        (suma, valor) => suma + Math.pow(valor - media, 2),
        0
    );

    const desviacionEstandar = Math.sqrt(sumaCuadrados / (n - 1));

    if (desviacionEstandar === 0) {
        return {
            error: 'No se puede realizar Grubbs porque todas las mediciones son iguales.'
        };
    }

    // Identificar mínimo y máximo
    const valorMinimo = Math.min(...valores);
    const valorMaximo = Math.max(...valores);

    const medicionMinima = mediciones.find(m => m.valor === valorMinimo);
    const medicionMaxima = mediciones.find(m => m.valor === valorMaximo);

    // Calcular distancias
    const distanciaInferior = media - valorMinimo;
    const distanciaSuperior = valorMaximo - media;

    const distanciaMaxima = Math.max(
        distanciaInferior,
        distanciaSuperior
    );

    // Identificar el extremo más alejado
    const esExtremoInferior = distanciaInferior > distanciaSuperior;
    const esExtremoSuperior = distanciaSuperior > distanciaInferior;
    const hayEmpate = distanciaInferior === distanciaSuperior;

    let valorSospechoso = null;
    let medicionSospechosa = null;
    let ladoSospechoso = null;

    if (!hayEmpate) {
        valorSospechoso = esExtremoInferior
            ? valorMinimo
            : valorMaximo;

        medicionSospechosa = esExtremoInferior
            ? medicionMinima
            : medicionMaxima;

        ladoSospechoso = esExtremoInferior
            ? 'Inferior'
            : 'Superior';
    }

    // Estadístico G
    const G = distanciaMaxima / desviacionEstandar;

    // Valor crítico bilateral
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

    // Resultado
    const esAtipico = G > Gcritico;

    return {
        metodo: 'Prueba de Grubbs',
        numeroMediciones: n,

        media: Number(media.toFixed(4)),
        desviacionEstandar: Number(desviacionEstandar.toFixed(4)),

        valorMinimo,
        fechaValorMinimo: medicionMinima.fecha,

        valorMaximo,
        fechaValorMaximo: medicionMaxima.fecha,

        distanciaInferior: Number(distanciaInferior.toFixed(4)),
        distanciaSuperior: Number(distanciaSuperior.toFixed(4)),
        distanciaMaxima: Number(distanciaMaxima.toFixed(4)),

        valorSospechoso,
        fechaValorSospechoso: medicionSospechosa
            ? medicionSospechosa.fecha
            : null,

        ladoSospechoso,
        hayEmpate,

        estadisticoG: Number(G.toFixed(4)),
        valorCritico: Number(Gcritico.toFixed(4)),
        nivelSignificancia: alfa,

        resultado: hayEmpate
            ? 'Empate entre los extremos: requiere revisión'
            : esAtipico
                ? 'Posible valor atípico detectado'
                : 'No se detectaron valores atípicos',

        esAtipico: esAtipico && !hayEmpate
    };
}

module.exports = {
    pruebaGrubbs
};
