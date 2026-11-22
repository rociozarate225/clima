
// 1. Seleccionar los elementos HTML
const formulario = document.querySelector("#formulario");
const campoCiudad = document.querySelector("#ciudad");
const estado = document.querySelector("#estado");
const resultado = document.querySelector("#resultado");

// 2. Escuchar el envío del formulario
formulario.addEventListener("submit", consultarClima);


// 3. Función asíncrona para consultar las API
async function consultarClima(evento) {

    // Evita que la página se recargue
    evento.preventDefault();

    // Obtener el nombre de la ciudad
    const ciudad = campoCiudad.value.trim();

    // Ocultar el resultado anterior
    resultado.hidden = true;
    document.body.removeAttribute("data-clima");
    estado.textContent = "Buscando ciudad...";

    try {

        // 4. PRIMERA PETICIÓN: buscar las coordenadas
        const urlGeo = new URL(
            "https://geocoding-api.open-meteo.com/v1/search"
        );

        urlGeo.search = new URLSearchParams({
            name: ciudad,
            count: "1",
            language: "es",
            format: "json"
        }).toString();

        const respuestaGeo = await fetch(urlGeo);

        if (!respuestaGeo.ok) {
            throw new Error("No se pudo buscar la ciudad.");
        }

        const datosGeo = await respuestaGeo.json();

        // Comprobar que se encontró una ciudad
        const lugar = datosGeo.results?.[0];

        if (!lugar) {
            throw new Error("No encontramos esa ciudad.");
        }

        // 5. SEGUNDA PETICIÓN: consultar el clima
        estado.textContent = "Consultando el clima...";

        const urlClima = new URL(
            "https://api.open-meteo.com/v1/forecast"
        );

        urlClima.search = new URLSearchParams({
            latitude: lugar.latitude,
            longitude: lugar.longitude,
            current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
            daily: "weather_code,temperature_2m_max,temperature_2m_min",
            forecast_days: "4",
            timezone: "auto",
            temperature_unit: "celsius",
            wind_speed_unit: "kmh"
        }).toString();

        const respuestaClima = await fetch(urlClima);

        if (!respuestaClima.ok) {
            throw new Error("No se pudo consultar el clima.");
        }

        const datosClima = await respuestaClima.json();

        const pronostico = datosClima.daily;
        const camposDiarios = [
            "time",
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min"
        ];

        if (!pronostico || camposDiarios.some(campo =>
            !Array.isArray(pronostico[campo]) || pronostico[campo].length < 4
        )) {
            throw new Error("No se pudo obtener el pronóstico de los próximos días.");
        }

        // 6. Extraer los datos meteorológicos actuales
        const actual = datosClima.current;

        // 7. Interpretar el código meteorológico
        const condicion = describirClima(actual.weather_code);

        // 8. Mostrar los datos en los elementos HTML
        document.querySelector("#ubicacion").textContent =
            [lugar.name, lugar.admin1, lugar.country]
            .filter(Boolean).join(", ");

        document.querySelector("#icono").textContent =
            condicion.icono;

        document.querySelector("#temperatura").textContent =
            actual.temperature_2m.toFixed(1) + " °C";

        document.querySelector("#descripcion").textContent =
            condicion.texto;

        document.querySelector("#humedad").textContent =
            actual.relative_humidity_2m + " %";

        document.querySelector("#sensacion").textContent =
            actual.apparent_temperature.toFixed(1) + " °C";

        document.querySelector("#viento").textContent =
            actual.wind_speed_10m + " km/h";

        mostrarPronostico(datosClima.daily, actual.time.slice(0, 10));

        document.querySelector("#actualizacion").textContent =
            "Datos para " + actual.time.replace("T", " ") +
            " (hora local).";

        // Mostrar el resultado
        document.body.dataset.clima = obtenerTemaClima(actual.weather_code);
        resultado.hidden = false;
        estado.textContent = "Consulta completada.";

    } catch (error) {

        // Mostrar un mensaje si ocurre algún problema
        estado.textContent = error.message;
        console.error(error);
    }
}


function mostrarPronostico(pronostico, fechaActual) {
    const contenedorDias = document.querySelector("#dias-pronostico");
    const formatoFecha = new Intl.DateTimeFormat("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "short",
        timeZone: "UTC"
    });

    contenedorDias.replaceChildren();

    pronostico.time
        .map((fecha, indice) => ({
            fecha,
            codigo: pronostico.weather_code[indice],
            maxima: pronostico.temperature_2m_max[indice],
            minima: pronostico.temperature_2m_min[indice]
        }))
        .filter(dia => dia.fecha > fechaActual)
        .slice(0, 3)
        .forEach(dia => {
            const tarjeta = document.createElement("article");
            tarjeta.className = "pronostico-dia";
            tarjeta.dataset.clima = obtenerTemaClima(dia.codigo);

            const fecha = document.createElement("h4");
            const textoFecha = formatoFecha.format(
                new Date(dia.fecha + "T00:00:00Z")
            );
            fecha.textContent =
                textoFecha.charAt(0).toLocaleUpperCase("es-MX") +
                textoFecha.slice(1);

            const condicion = describirClima(dia.codigo);
            const icono = document.createElement("span");
            icono.className = "pronostico-icono";
            icono.textContent = condicion.icono;
            icono.setAttribute("aria-hidden", "true");

            const descripcion = document.createElement("p");
            descripcion.className = "pronostico-descripcion";
            descripcion.textContent = condicion.texto;

            const temperaturas = document.createElement("p");
            temperaturas.className = "pronostico-temperaturas";
            temperaturas.textContent =
                dia.maxima.toFixed(1) + " °C / " + dia.minima.toFixed(1) + " °C";

            tarjeta.append(fecha, icono, descripcion, temperaturas);
            contenedorDias.append(tarjeta);
        });
}


function obtenerTemaClima(codigo) {
    if (codigo === 0) {
        return "soleado";
    }

    if ([1, 2, 3].includes(codigo)) {
        return "nublado";
    }

    if ([45, 48].includes(codigo)) {
        return "niebla";
    }

    if ([71, 73, 75, 77, 85, 86].includes(codigo)) {
        return "nieve";
    }

    if ([95, 96, 99].includes(codigo)) {
        return "tormenta";
    }

    if ((codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) {
        return "lluvia";
    }

    return "predeterminado";
}


// 9. Función para traducir los códigos meteorológicos
function describirClima(codigo) {

    const condiciones = {
        0:  { texto: "Despejado", icono: "☀️" },
        1:  { texto: "Principalmente despejado", icono: "🌤️" },
        2:  { texto: "Parcialmente nublado", icono: "⛅" },
        3:  { texto: "Nublado", icono: "☁️" },
        45: { texto: "Niebla", icono: "🌫️" },
        48: { texto: "Niebla", icono: "🌫️" },
        51: { texto: "Llovizna", icono: "🌦️" },
        53: { texto: "Llovizna", icono: "🌦️" },
        55: { texto: "Llovizna intensa", icono: "🌧️" },
        56: { texto: "Llovizna engelante", icono: "🌧️" },
        57: { texto: "Llovizna engelante intensa", icono: "🌧️" },
        61: { texto: "Lluvia ligera", icono: "🌧️" },
        63: { texto: "Lluvia moderada", icono: "🌧️" },
        65: { texto: "Lluvia intensa", icono: "🌧️" },
        66: { texto: "Lluvia engelante ligera", icono: "🌧️" },
        67: { texto: "Lluvia engelante intensa", icono: "🌧️" },
        71: { texto: "Nevada ligera", icono: "❄️" },
        73: { texto: "Nevada moderada", icono: "❄️" },
        75: { texto: "Nevada intensa", icono: "❄️" },
        77: { texto: "Granos de nieve", icono: "❄️" },
        80: { texto: "Chubascos", icono: "🌦️" },
        81: { texto: "Chubascos moderados", icono: "🌧️" },
        82: { texto: "Chubascos intensos", icono: "🌧️" },
        85: { texto: "Chubascos de nieve ligeros", icono: "❄️" },
        86: { texto: "Chubascos de nieve intensos", icono: "❄️" },
        95: { texto: "Tormenta eléctrica", icono: "⛈️" },
        96: { texto: "Tormenta con granizo", icono: "⛈️" },
        99: { texto: "Tormenta intensa con granizo", icono: "⛈️" }
    };

    return condiciones[codigo] || {
        texto: "Condición meteorológica variable",
        icono: "🌡️"
    };
}
