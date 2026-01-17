const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// URLs de FFCV
const URLS = {
  clasificacion: 'https://resultadosffcv.isquad.es/clasificacion.php?id_temp=21&id_modalidad=33345&id_competicion=29509572&id_torneo=905019319',
  jornada: 'https://resultadosffcv.isquad.es/total_partidos.php?id_temp=21&id_modalidad=33345&id_competicion=29509572&id_torneo=905019319',
  calendario: 'https://resultadosffcv.isquad.es/equipo_calendario.php?id_temp=21&id_modalidad=33345&id_competicion=29509572&id_equipo=15228&torneo_equipo=905019319&id_torneo=905019319'
};

// Función para hacer scraping de la clasificación
async function getClasificacion() {
  try {
    const response = await axios.get(URLS.clasificacion, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const equipos = [];

    // Helper para limpiar números (extraer solo el primer bloque numérico)
    const cleanNumber = (td) => {
      // Obtenemos el texto pero solo del primer nodo de texto para evitar porcentajes u otros datos
      const text = $(td).contents().first().text().trim();
      if (!text) return '0';
      // Por si acaso, nos quedamos con el primer bloque de dígitos
      const match = text.match(/^-?\d+/);
      return match ? match[0] : '0';
    };

    // Buscar la tabla de clasificación
    $('table tr').each((index, element) => {
      const tds = $(element).find('td');
      
      // Solo procesar filas que tengan al menos 11 celdas (formato oficial de FFCV)
      if (tds.length >= 11 && !$(tds[0]).attr('colspan')) {
        const equipo = {
          posicion: $(tds[1]).text().trim(),
          nombre: $(tds[2]).text().trim(),
          partidosJugados: cleanNumber(tds[3]),
          ganados: cleanNumber(tds[4]),
          empatados: cleanNumber(tds[5]),
          perdidos: cleanNumber(tds[6]),
          golesFavor: cleanNumber(tds[7]),
          golesContra: cleanNumber(tds[8]),
          diferencia: cleanNumber(tds[9]),
          puntos: cleanNumber(tds[10]),
          esMeliana: $(tds[2]).text().toLowerCase().includes('meliana')
        };
        
        // Validar que tenemos un nombre de equipo y que no es la cabecera
        if (equipo.nombre && equipo.nombre !== 'Club' && !isNaN(parseInt(equipo.posicion))) {
          equipos.push(equipo);
        }
      }
    });

    return equipos;
  } catch (error) {
    console.error('Error al obtener clasificación:', error.message);
    throw error;
  }
}

// Función para hacer scraping de la jornada actual
async function getJornadaActual() {
  try {
    const response = await axios.get(URLS.jornada, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const partidos = [];

    // Buscar partidos - estructura de 8 columnas de FFCV
    $('table tr').each((index, element) => {
      const tds = $(element).find('td');

      // Estructura de 8 columnas: Local - Vacío - Resultado/Hora - Vacío - Visitante - Campo - Vacío - Historial
      if (tds.length === 8) {
        const local = $(tds[0]).text().trim();
        const resultadoRaw = $(tds[2]).text().trim();
        const visitante = $(tds[4]).text().trim();
        const campo = $(tds[5]).text().trim();

        // Validar que tenemos datos de equipos válidos
        if (local && visitante && local.length > 2 && visitante.length > 2) {
          let resultado = '';
          let hora = '';

          // Determinar si es un resultado o una hora
          if (resultadoRaw.includes(':')) {
            // Es una hora (ej: "09:30")
            hora = resultadoRaw;
            resultado = 'vs';
          } else if (resultadoRaw.match(/^\d{2}$/)) {
            // Es un resultado sin guión (ej: "43" = "4-3")
            resultado = resultadoRaw.charAt(0) + '-' + resultadoRaw.charAt(1);
          } else if (resultadoRaw) {
            // Cualquier otro formato de resultado
            resultado = resultadoRaw;
          } else {
            // Sin información
            resultado = 'vs';
          }

          const partido = {
            local,
            visitante,
            resultado,
            fecha: '',
            hora,
            campo,
            esMeliana: local.toLowerCase().includes('meliana') || visitante.toLowerCase().includes('meliana')
          };
          partidos.push(partido);
        }
      }
    });

    return partidos;
  } catch (error) {
    console.error('Error al obtener jornada actual:', error.message);
    throw error;
  }
}

// Función para hacer scraping del calendario
async function getCalendario() {
  try {
    const response = await axios.get(URLS.calendario, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const jornadas = [];
    let currentJornada = null;

    // Buscar en la tabla principal
    $('table tr').each((index, element) => {
      const tds = $(element).find('td');

      // Si es una fila de título de jornada (normalmente tiene 1 solo td o el texto contiene JORNADA)
      const text = $(element).text().trim().toUpperCase();
      if (tds.length === 1 && text.includes('JORNADA')) {
        currentJornada = {
          nombre: text,
          partidos: []
        };
        jornadas.push(currentJornada);
      } 
      // Si es una fila de partido (en equipo_calendario.php tiene 6 columnas)
      else if (tds.length === 6 && currentJornada) {
        // [2] Equipos (Local - Visitante)
        const equiposRaw = $(tds[2]).text().trim();
        const parts = equiposRaw.split(/\s+-\s+/);
        
        if (parts.length >= 2) {
          const local = parts[0].trim();
          const visitante = parts[1].trim();
          
          // [3] Resultado
          let resultado = $(tds[3]).text().trim();
          if (!resultado || resultado === '-') resultado = 'vs';
          
          // [4] Fecha/Hora
          const fechaHoraRaw = $(tds[4]).text().trim();
          let fecha = '';
          let hora = '';
          
          if (fechaHoraRaw) {
            const dtParts = fechaHoraRaw.split(/\s+/);
            fecha = dtParts[0] || '';
            hora = dtParts[1] || '';
          }

          // [5] Campo
          const campo = $(tds[5]).text().trim();

          currentJornada.partidos.push({
            local,
            visitante,
            resultado,
            fecha,
            hora,
            campo,
            esMeliana: local.toLowerCase().includes('meliana') || visitante.toLowerCase().includes('meliana')
          });
        }
      }
    });

    return jornadas;
  } catch (error) {
    console.error('Error al obtener calendario:', error.message);
    throw error;
  }
}

// Endpoints API
app.get('/api/clasificacion', async (req, res) => {
  try {
    const data = await getClasificacion();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la clasificación' });
  }
});

app.get('/api/jornada', async (req, res) => {
  try {
    const data = await getJornadaActual();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la jornada actual' });
  }
});

app.get('/api/calendario', async (req, res) => {
  try {
    const data = await getCalendario();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el calendario' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
