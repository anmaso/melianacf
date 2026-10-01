'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.PORT || 8080;
const COD_CLUB = process.env.COD_CLUB || '2621'; // Meliana C.F.
const BASE = 'https://ffcv.es/competiciones/api';
const PUBLIC_DIR = path.join(__dirname, 'public');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json, */*',
  Referer: 'https://ffcv.es/competiciones/',
};

// ---- Caché en memoria con TTL ------------------------------------------
const cache = new Map();
async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await loader();
  cache.set(key, { value, exp: Date.now() + ttlMs });
  return value;
}
const MIN = 60 * 1000;

async function ffcv(p, params) {
  const url = `${BASE}/${p}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`FFCV ${res.status} en ${p}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no válida de FFCV en ${p}`);
  }
}

const str = (v) => (v == null ? '' : String(v).trim());
const escudo = (u) => (u ? `https://appwebffcv.novanet.es${u}` : '');
const num = (v) => parseInt(v || '0', 10) || 0;

// "dd/mm/yyyy" -> "yyyy-mm-dd" (ordenable)
function isoFecha(f) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(f || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

// ---- Lógica de negocio -----------------------------------------------------
async function getEquipos() {
  return cached('equipos', 60 * MIN, async () => {
    const d = await ffcv('clubes/ajax_club_equipos.php', { codigo_club: COD_CLUB });
    return (d.equipos || [])
      .filter((e) => e.en_competicion === '1')
      .map((e) => ({
        id: str(e.codequipo),
        nombre: str(e.nombre_equipo),
        categoria: str(e.categoria),
        escudo: escudo(e.escudo),
      }));
  });
}

// Competiciones/grupos de la temporada actual para un equipo
async function getCompeticiones(codEquipo) {
  return cached(`comp:${codEquipo}`, 30 * MIN, async () => {
    const d = await ffcv('equipos/vis_competiciones_equipo.php', { codequipo: codEquipo });
    const todas = d.competiciones || [];
    const maxTemp = Math.max(0, ...todas.map((c) => num(c.codigo_temporada)));
    return todas
      .filter((c) => num(c.codigo_temporada) === maxTemp && c.cogido_grupo)
      .map((c) => ({
        codCompeticion: str(c.codigo_competicion),
        codGrupo: str(c.cogido_grupo),
        competicion: str(c.competicion),
        grupo: str(c.grupo),
        temporada: str(c.temporada),
        posicion: str(c.posicion),
        puntos: str(c.puntos),
      }));
  });
}

async function getJornadas(codGrupo) {
  return cached(`jor:${codGrupo}`, 30 * MIN, async () => {
    const d = await ffcv('filtros/jornadas_fetch.php', { cod_grupo: codGrupo });
    return (d.jornadas || []).map((j) => ({
      cod: str(j.codjornada),
      nombre: str(j.nombre),
      fecha: str(j.fecha_jornada), // dd-mm-yyyy
    }));
  });
}

async function getClasificacion(codGrupo) {
  return cached(`clas:${codGrupo}`, 3 * MIN, async () => {
    const jornadas = await getJornadas(codGrupo);
    const ultima = jornadas.length ? jornadas[jornadas.length - 1].cod : '1';
    // Con una jornada futura la API devuelve la clasificación de la última disputada.
    const d = await ffcv('clasificaciones/clasificaciones_ajax.php', {
      cod_grupo: codGrupo,
      cod_jornada: ultima,
    });
    return {
      competicion: str(d.competicion),
      grupo: str(d.grupo),
      equipos: (d.clasificacion || []).map((r) => ({
        posicion: num(r.posicion),
        codEquipo: str(r.codequipo),
        nombre: str(r.nombre),
        escudo: escudo(r.url_img),
        pj: num(r.jugados),
        pg: num(r.ganados),
        pe: num(r.empatados),
        pp: num(r.perdidos),
        gf: num(r.goles_a_favor),
        gc: num(r.goles_en_contra),
        puntos: num(r.puntos),
        color: str(r.color),
        racha: (r.racha_partidos || []).map((x) => str(x.tipo)),
      })),
      promociones: (d.promociones || []).map((p) => ({
        orden: num(p.orden),
        nombre: str(p.nombre_promocion),
        color: str(p.color_promocion),
      })),
    };
  });
}

function mapPartido(p) {
  const res = str(p.resultado);
  const jugado = /^\d+\s*-\s*\d+$/.test(res);
  return {
    fecha: str(p.fecha),
    fechaIso: isoFecha(p.fecha),
    hora: str(p.hora),
    campo: str(p.campo),
    codLocal: str(p.cod_equipo_local),
    codVisitante: str(p.cod_equipo_visitante),
    local: str(p.local),
    visitante: str(p.visitante),
    escudoLocal: escudo(p.escudo_local),
    escudoVisitante: escudo(p.escudo_visitante),
    resultado: jugado ? res.replace(/\s/g, '') : '',
    jugado,
    suspendido: str(p.motivo_estado) !== '' && !jugado,
    motivo: str(p.motivo_estado),
  };
}

async function getPartidosJornada(codCompeticion, codGrupo, codJornada) {
  return cached(`pj:${codGrupo}:${codJornada}`, 3 * MIN, async () => {
    const d = await ffcv('partidos/resultados_por_grupo_jornada_data.php', {
      cod_competicion: codCompeticion,
      cod_grupo: codGrupo,
      cod_jornada: codJornada,
    });
    const partidos = (d.partidos || []).map(mapPartido);
    partidos.sort((a, b) => (a.fechaIso + a.hora).localeCompare(b.fechaIso + b.hora));
    return partidos;
  });
}

// Todos los partidos del equipo en un grupo (jugados y pendientes), recorriendo las jornadas
async function getCalendario(codEquipo, codGrupo) {
  const comp = (await getCompeticiones(codEquipo)).find((c) => c.codGrupo === codGrupo);
  if (!comp) return [];
  const jornadas = await getJornadas(codGrupo);
  const porJornada = await Promise.all(
    jornadas.map(async (j) => {
      const partidos = await getPartidosJornada(comp.codCompeticion, codGrupo, j.cod);
      return partidos
        .filter((p) => p.codLocal === codEquipo || p.codVisitante === codEquipo)
        .map((p) => ({ ...p, jornada: j.nombre, codJornada: j.cod }));
    })
  );
  return porJornada.flat().sort((a, b) => (a.fechaIso + a.hora).localeCompare(b.fechaIso + b.hora));
}

// ---- HTTP -------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60',
  });
  res.end(JSON.stringify(body));
}

const digits = (v) => (/^\d{1,12}$/.test(v || '') ? v : null);

async function handleApi(url, res) {
  const q = url.searchParams;
  const route = url.pathname;
  try {
    if (route === '/api/equipos') return sendJson(res, 200, await getEquipos());

    if (route === '/api/competiciones') {
      const e = digits(q.get('equipo'));
      if (!e) return sendJson(res, 400, { error: 'equipo inválido' });
      return sendJson(res, 200, await getCompeticiones(e));
    }
    if (route === '/api/jornadas') {
      const g = digits(q.get('grupo'));
      if (!g) return sendJson(res, 400, { error: 'grupo inválido' });
      return sendJson(res, 200, await getJornadas(g));
    }
    if (route === '/api/clasificacion') {
      const g = digits(q.get('grupo'));
      if (!g) return sendJson(res, 400, { error: 'grupo inválido' });
      return sendJson(res, 200, await getClasificacion(g));
    }
    if (route === '/api/jornada') {
      const c = digits(q.get('competicion'));
      const g = digits(q.get('grupo'));
      const j = digits(q.get('jornada'));
      if (!c || !g || !j) return sendJson(res, 400, { error: 'parámetros inválidos' });
      return sendJson(res, 200, await getPartidosJornada(c, g, j));
    }
    if (route === '/api/calendario') {
      const e = digits(q.get('equipo'));
      const g = digits(q.get('grupo'));
      if (!e || !g) return sendJson(res, 400, { error: 'parámetros inválidos' });
      return sendJson(res, 200, await getCalendario(e, g));
    }
    return sendJson(res, 404, { error: 'No encontrado' });
  } catch (err) {
    console.error(route, err.message);
    return sendJson(res, 502, { error: 'No se pudo obtener los datos de la FFCV' });
  }
}

function serveStatic(url, res) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('No encontrado');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': rel === '/index.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET') return res.writeHead(405).end();
    if (url.pathname.startsWith('/api/')) return handleApi(url, res);
    return serveStatic(url, res);
  })
  .listen(PORT, () => console.log(`Escuchando en http://localhost:${PORT}`));
