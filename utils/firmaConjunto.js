
const crypto = require("crypto");

function generarFirmaConjunto(mediciones) {

    if (!Array.isArray(mediciones)) {
        throw new Error(
            "Se requiere un arreglo de mediciones."
        );
    }

    // Normalizar los datos de cada medición
    const datos = mediciones.map((medicion) => {

        const fecha = new Date(medicion.fecha);

        if (
            !medicion._id ||
            !Number.isFinite(fecha.getTime()) ||
            typeof medicion.valor !== "number" ||
            !Number.isFinite(medicion.valor)
        ) {
            throw new Error(
                "El conjunto contiene una medición inválida."
            );
        }

        return {
            id: String(medicion._id),
            fecha: fecha.toISOString(),
            valor: medicion.valor
        };
    });

    // Ordenar para obtener siempre la misma firma
    datos.sort((a, b) =>
        a.id.localeCompare(b.id)
    );

    // Convertir el conjunto a texto
    const contenido = JSON.stringify(datos);

    // Generar la firma SHA-256
    return crypto
        .createHash("sha256")
        .update(contenido)
        .digest("hex");
}

module.exports = {
    generarFirmaConjunto
};
