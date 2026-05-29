const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const BASE = 'https://ffcv.es/competiciones';
const COD_COMPETICION = '29509572';
const COD_GRUPO = '905019319';
const COD_EQUIPO_MELIANA = '15228';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Referer': 'https://ffcv.es/competiciones/'
};

async function apiGet(path) {
  const response = await axios.get(BASE + path, { headers: HEADERS });
  return response.data;
}

async function getJornadasList() {
  const data = await apiGet(`/api/filtros/jornadas_fetch.php?cod_grupo=${COD_GRUPO}`);
  return Array.isArray(data?.jornadas) ? data.jornadas : [];
}

async function getPartidosByJornada(codJornada) {
  const qs = new URLSearchParams({
    cod_competicion: COD_COMPETICION,
    cod_grupo: COD_GRUPO,
    cod_jornada: String(codJornada)
  });
  const data = await apiGet(`/api/partidos/resultados_por_grupo_jornada_data.php?${qs}`);
  return Array.isArray(data?.partidos) ? data.partidos : [];
}

function normalizeResultado(raw) {
  if (!raw || raw === '0') return 'vs';
  if (raw.includes('-')) return raw.trim();
  return raw.trim() || 'vs';
}

function mapPartido(p) {
  return {
    local: p.local || '',
    visitante: p.visitante || '',
    resultado: normalizeResultado(p.resultado),
    fecha: p.fecha || '',
    hora: p.hora || '',
    campo: p.campo || '',
    esMeliana:
      String(p.cod_equipo_local) === COD_EQUIPO_MELIANA ||
      String(p.cod_equipo_visitante) === COD_EQUIPO_MELIANA
  };
}

async function getClasificacion() {
  const jornadas = await getJornadasList();
  const lastJornada = jornadas[jornadas.length - 1];
  const codJornada = lastJornada?.codjornada || '18';

  const data = await apiGet(
    `/api/clasificaciones/clasificaciones_ajax.php?cod_grupo=${COD_GRUPO}&cod_jornada=${codJornada}`
  );

  const list = Array.isArray(data?.clasificacion) ? data.clasificacion : [];

  return list.map(row => {
    const gf = parseInt(row.goles_a_favor || '0', 10);
    const gc = parseInt(row.goles_en_contra || '0', 10);
    const diff = gf - gc;
    return {
      posicion: row.posicion || '',
      nombre: row.nombre || '',
      partidosJugados: row.jugados || '0',
      ganados: row.ganados || '0',
      empatados: row.empatados || '0',
      perdidos: row.perdidos || '0',
      golesFavor: row.goles_a_favor || '0',
      golesContra: row.goles_en_contra || '0',
      diferencia: diff >= 0 ? `+${diff}` : String(diff),
      puntos: row.puntos || '0',
      esMeliana: String(row.codequipo) === COD_EQUIPO_MELIANA
    };
  });
}

async function getJornadaActual() {
  const jornadas = await getJornadasList();

  // Find the current jornada: the last one with played results, or the next upcoming
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentJornada = jornadas[0];
  for (const j of jornadas) {
    // fecha_jornada format: "DD-MM-YYYY"
    const parts = (j.fecha_jornada || '').split('-');
    if (parts.length === 3) {
      const jDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (jDate <= today) {
        currentJornada = j;
      }
    }
  }

  const partidos = await getPartidosByJornada(currentJornada.codjornada);
  return partidos.map(mapPartido);
}

async function getCalendario() {
  const jornadas = await getJornadasList();

  const results = await Promise.all(
    jornadas.map(async j => {
      const partidos = await getPartidosByJornada(j.codjornada);
      const meliana = partidos.filter(
        p =>
          String(p.cod_equipo_local) === COD_EQUIPO_MELIANA ||
          String(p.cod_equipo_visitante) === COD_EQUIPO_MELIANA
      );
      return {
        nombre: `JORNADA ${j.nombre}`,
        partidos: meliana.map(mapPartido)
      };
    })
  );

  return results.filter(j => j.partidos.length > 0);
}

app.get('/api/clasificacion', async (req, res) => {
  try {
    res.json(await getClasificacion());
  } catch (error) {
    console.error('Error clasificación:', error.message);
    res.status(500).json({ error: 'Error al obtener la clasificación' });
  }
});

app.get('/api/jornada', async (req, res) => {
  try {
    res.json(await getJornadaActual());
  } catch (error) {
    console.error('Error jornada:', error.message);
    res.status(500).json({ error: 'Error al obtener la jornada actual' });
  }
});

app.get('/api/calendario', async (req, res) => {
  try {
    res.json(await getCalendario());
  } catch (error) {
    console.error('Error calendario:', error.message);
    res.status(500).json({ error: 'Error al obtener el calendario' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
