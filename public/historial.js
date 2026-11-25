document.addEventListener("DOMContentLoaded", () => {
  const inputPrueba = document.getElementById("historialPrueba");

  const btnConsultar = document.getElementById("btnConsultarHistorial");

  const mensajeHistorial = document.getElementById("mensajeHistorial");

  const tablaHistorial = document.getElementById("tablaHistorialMediciones");

  const resumenHistorial = document.getElementById("resumenHistorial");

  const tablaConjuntosControl = document.getElementById(
    "tablaConjuntosControl",
  );

  const graficaHistorialLevey = document.getElementById(
    "graficaHistorialLevey",
  );

  const mensajeHistorialLevey = document.getElementById(
    "mensajeHistorialLevey",
  );

  let medicionesConsultadas = [];
  let urlGraficaHistorial = null;
  let solicitudGraficaActual = 0;

  async function obtenerParametrosObjetivo(prueba, nivelControl, lote, equipo) {
    // Evitar consultas con datos incompletos.
    if (
      !prueba ||
      !nivelControl ||
      !lote ||
      !equipo ||
      nivelControl === "Sin nivel" ||
      lote === "Sin lote" ||
      equipo === "Sin equipo"
    ) {
      throw new Error("El conjunto no tiene todos los datos necesarios.");
    }

    // Construir los filtros de búsqueda.
    const filtros = new URLSearchParams({
      prueba,
      nivelControl,
      lote,
      equipo,
    });

    // Consultar los parámetros registrados en MongoDB.
    const respuesta = await fetch(
      "/api/control/parametros?" + filtros.toString(),
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(
        resultado.mensaje ||
          "No fue posible consultar los parámetros objetivo.",
      );
    }

    // Verificar que existan parámetros.
    if (
      !Array.isArray(resultado.parametros) ||
      resultado.parametros.length === 0
    ) {
      throw new Error(
        "No existen parámetros objetivo registrados para este conjunto.",
      );
    }

    // Evitar utilizar parámetros ambiguos.
    if (resultado.parametros.length !== 1) {
      throw new Error(
        "Se encontró más de un registro de parámetros para este conjunto.",
      );
    }

    const parametro = resultado.parametros[0];

    // Validar la media y desviación estándar.
    if (
      !Number.isFinite(parametro.media) ||
      !Number.isFinite(parametro.desviacionEstandar) ||
      parametro.desviacionEstandar <= 0
    ) {
      throw new Error("Los parámetros objetivo registrados no son válidos.");
    }

    return parametro;
  }


function limpiarGraficaHistorial() {

    solicitudGraficaActual++;

    graficaHistorialLevey.hidden = true;
    graficaHistorialLevey.removeAttribute("src");

    if (urlGraficaHistorial) {
        URL.revokeObjectURL(urlGraficaHistorial);
        urlGraficaHistorial = null;
    }

    mensajeHistorialLevey.textContent =
        "Selecciona un conjunto para visualizar su gráfica.";
}


async function mostrarGraficaHistorial(conjunto, mediciones) {

    limpiarGraficaHistorial();

    const solicitud = solicitudGraficaActual;

    mensajeHistorialLevey.textContent =
        "Generando gráfica de Levey-Jennings...";

    try {

        if (mediciones.length === 0) {
            throw new Error(
                "No existen mediciones para generar la gráfica."
            );
        }

        const prueba = mediciones[0].prueba;

        // Obtener parámetros objetivo desde MongoDB.
        const parametros = await obtenerParametrosObjetivo(
            prueba,
            conjunto.nivel,
            conjunto.lote,
            conjunto.equipo
        );

        // Preparar los resultados históricos.
        const resultados = mediciones.map(medicion => ({
            fecha: medicion.fecha,
            valor: medicion.valor
        }));

        // Preparar los datos para nuestra API.
        const datosGrafica = {
            prueba:
                prueba + " - " +
                conjunto.nivel + " - " +
                conjunto.lote + " - " +
                conjunto.equipo,

            media: parametros.media,

            desviacionEstandar:
                parametros.desviacionEstandar,

            resultados,

            alertas: []
        };

        // Solicitar la gráfica.
        const respuesta = await fetch(
            "/api/levey-jennings/grafica",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(datosGrafica)
            }
        );

        if (!respuesta.ok) {

            const error = await respuesta.json();

            throw new Error(
                error.error ||
                "No fue posible generar la gráfica."
            );
        }

        // Recuperar la imagen PNG.
        const imagen = await respuesta.blob();

        // Evitar mostrar una gráfica de una selección anterior.
        if (solicitud !== solicitudGraficaActual) {
            return;
        }

        urlGraficaHistorial = URL.createObjectURL(imagen);

        graficaHistorialLevey.src = urlGraficaHistorial;

        graficaHistorialLevey.hidden = false;

        mensajeHistorialLevey.textContent =
            "Media objetivo: " + parametros.media +
            " | DE objetivo: " + parametros.desviacionEstandar +
            " | Mediciones: " + resultados.length;

    } catch (error) {

        if (solicitud !== solicitudGraficaActual) {
            return;
        }

        console.error(
            "ERROR AL GENERAR GRÁFICA HISTÓRICA:",
            error
        );

        mensajeHistorialLevey.textContent = error.message;

        graficaHistorialLevey.hidden = true;
    }
}


  function mostrarMedicionesHistorial(mediciones) {
    tablaHistorial.innerHTML = "";

    if (mediciones.length === 0) {
      tablaHistorial.innerHTML =
        '<tr><td colspan="8">No hay mediciones para este conjunto.</td></tr>';
      return;
    }

    for (const medicion of mediciones) {
      const fila = document.createElement("tr");

      const fecha = medicion.fecha
        ? new Date(medicion.fecha).toLocaleDateString("es-MX", {
            timeZone: "UTC",
          })
        : "Sin fecha";

      const columnas = [
        fecha,
        medicion.prueba || "",
        medicion.nivelControl || "Sin nivel",
        medicion.lote || "Sin lote",
        medicion.equipo || "Sin equipo",
        medicion.valor ?? "",
        "Pendiente de integración",
        medicion.estado || "Sin estado",
      ];

      for (const valor of columnas) {
        const celda = document.createElement("td");
        celda.textContent = String(valor);
        fila.appendChild(celda);
      }

      tablaHistorial.appendChild(fila);
    }
  }

  function mostrarConjuntosControl(mediciones) {
    tablaConjuntosControl.innerHTML = "";

    const conjuntos = new Map();

    for (const medicion of mediciones) {
      const nivel = medicion.nivelControl || "Sin nivel";
      const lote = medicion.lote || "Sin lote";
      const equipo = medicion.equipo || "Sin equipo";

      // Clave compuesta para evitar mezclar conjuntos.
      const clave = JSON.stringify([nivel, lote, equipo]);

      if (!conjuntos.has(clave)) {
        conjuntos.set(clave, {
          nivel,
          lote,
          equipo,
          total: 0,
        });
      }

      conjuntos.get(clave).total++;
    }

    if (conjuntos.size === 0) {
      const fila = document.createElement("tr");
      const celda = document.createElement("td");

      celda.colSpan = 4;
      celda.textContent = "No se encontraron conjuntos.";

      fila.appendChild(celda);
      tablaConjuntosControl.appendChild(fila);

      return;
    }

    const conjuntosOrdenados = [...conjuntos.values()].sort(
      (a, b) =>
        a.nivel.localeCompare(b.nivel, "es") ||
        a.lote.localeCompare(b.lote, "es") ||
        a.equipo.localeCompare(b.equipo, "es"),
    );

    for (const conjunto of conjuntosOrdenados) {
      const fila = document.createElement("tr");

      fila.style.cursor = "pointer";
      fila.title = "Seleccionar este conjunto de control";

      fila.addEventListener("click", () => {
        const medicionesFiltradas = medicionesConsultadas.filter(
          (medicion) =>
            (medicion.nivelControl || "Sin nivel") === conjunto.nivel &&
            (medicion.lote || "Sin lote") === conjunto.lote &&
            (medicion.equipo || "Sin equipo") === conjunto.equipo,
        );

        mostrarMedicionesHistorial(medicionesFiltradas);

        mostrarGraficaHistorial(
    conjunto,
    medicionesFiltradas
);

        // Resaltar la fila seleccionada.
        const filas = tablaConjuntosControl.querySelectorAll("tr");

        filas.forEach((f) => {
          f.style.backgroundColor = "";
        });

        fila.style.backgroundColor = "#dbeafe";

        resumenHistorial.textContent =
          "Conjunto seleccionado: " +
          conjunto.nivel +
          " | Lote: " +
          conjunto.lote +
          " | Equipo: " +
          conjunto.equipo +
          " | Mediciones: " +
          medicionesFiltradas.length;
      });

      const columnas = [
        conjunto.nivel,
        conjunto.lote,
        conjunto.equipo,
        conjunto.total,
      ];

      for (const valor of columnas) {
        const celda = document.createElement("td");
        celda.textContent = String(valor);
        fila.appendChild(celda);
      }

      tablaConjuntosControl.appendChild(fila);
    }
  }

  btnConsultar.addEventListener("click", async () => {
    const prueba = inputPrueba.value.trim();

    if (!prueba) {
      mensajeHistorial.textContent =
        "Debes introducir el nombre de un analito.";
      return;
    }

    btnConsultar.disabled = true;

    mensajeHistorial.textContent = "Consultando historial de " + prueba + "...";

    tablaHistorial.innerHTML = "";

    tablaConjuntosControl.innerHTML = "";

    medicionesConsultadas = [];

    limpiarGraficaHistorial();

    resumenHistorial.textContent = "Consultando mediciones...";

    try {
      const url = "/api/control/historial?prueba=" + encodeURIComponent(prueba);

      const respuesta = await fetch(url);

      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          resultado.mensaje || "No se pudo consultar el historial.",
        );
      }

      // Evitar mostrar resultados de otros analitos.
      const mediciones = (
        Array.isArray(resultado.mediciones) ? resultado.mediciones : []
      ).filter(
        (medicion) =>
          typeof medicion.prueba === "string" &&
          medicion.prueba.trim().toLocaleLowerCase("es") ===
            prueba.toLocaleLowerCase("es"),
      );

      if (mediciones.length === 0) {
        mensajeHistorial.textContent =
          "No se encontraron mediciones para " + prueba + ".";

        resumenHistorial.textContent = "Sin mediciones registradas.";

        tablaHistorial.innerHTML =
          '<tr><td colspan="8">Sin resultados.</td></tr>';

        return;
      }

      // Ordenar de la fecha más reciente a la más antigua.
      mediciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      mensajeHistorial.textContent = "Historial recuperado correctamente.";

      resumenHistorial.textContent =
        "Analito: " +
        prueba +
        " | Mediciones encontradas: " +
        mediciones.length;

      // Guardar las mediciones recuperadas.
      medicionesConsultadas = mediciones;

      // Mostrar los conjuntos encontrados.
      mostrarConjuntosControl(mediciones);

      // Mostrar inicialmente todas las mediciones del analito.
      mostrarMedicionesHistorial(mediciones);

      console.log("HISTORIAL RECUPERADO:", mediciones);
    } catch (error) {
      console.error("ERROR AL CONSULTAR HISTORIAL:", error);

      mensajeHistorial.textContent = error.message;

      resumenHistorial.textContent = "No fue posible recuperar las mediciones.";

      tablaHistorial.innerHTML =
        '<tr><td colspan="8">Error al consultar.</td></tr>';
    } finally {
      btnConsultar.disabled = false;
    }
  });
});
