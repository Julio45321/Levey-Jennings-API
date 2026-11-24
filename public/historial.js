document.addEventListener("DOMContentLoaded", () => {
  const inputPrueba = document.getElementById("historialPrueba");

  const btnConsultar = document.getElementById("btnConsultarHistorial");

  const mensajeHistorial = document.getElementById("mensajeHistorial");

  const tablaHistorial = document.getElementById("tablaHistorialMediciones");

  const resumenHistorial = document.getElementById("resumenHistorial");

  const tablaConjuntosControl = document.getElementById(
    "tablaConjuntosControl",
  );

  let medicionesConsultadas = [];


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
                timeZone: "UTC"
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
            medicion.estado || "Sin estado"
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

        const medicionesFiltradas =
            medicionesConsultadas.filter(medicion =>

                (medicion.nivelControl || "Sin nivel") === conjunto.nivel &&

                (medicion.lote || "Sin lote") === conjunto.lote &&

                (medicion.equipo || "Sin equipo") === conjunto.equipo

            );

        mostrarMedicionesHistorial(medicionesFiltradas);

        // Resaltar la fila seleccionada.
        const filas = tablaConjuntosControl.querySelectorAll("tr");

        filas.forEach(f => {
            f.style.backgroundColor = "";
        });

        fila.style.backgroundColor = "#dbeafe";

        resumenHistorial.textContent =
            "Conjunto seleccionado: " +
            conjunto.nivel +
            " | Lote: " + conjunto.lote +
            " | Equipo: " + conjunto.equipo +
            " | Mediciones: " + medicionesFiltradas.length;

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
