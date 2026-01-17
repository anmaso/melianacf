// Estado de la aplicación
let currentTab = 'clasificacion';

// Elementos del DOM
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    loadCurrentTab();
});

// Configurar tabs
function setupTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
}

// Cambiar de tab
function switchTab(tabName) {
    currentTab = tabName;

    // Actualizar tabs activos
    tabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Actualizar contenido activo
    tabContents.forEach(content => {
        if (content.id === tabName) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    loadCurrentTab();
}

// Cargar datos del tab actual
async function loadCurrentTab() {
    showLoading();
    hideError();

    try {
        switch (currentTab) {
            case 'clasificacion':
                await loadClasificacion();
                break;
            case 'jornada':
                await loadJornada();
                break;
            case 'calendario':
                await loadCalendario();
                break;
        }
        hideLoading();
    } catch (error) {
        console.error('Error:', error);
        hideLoading();
        showError();
    }
}

// Cargar clasificación
async function loadClasificacion() {
    const response = await fetch('/api/clasificacion');
    if (!response.ok) throw new Error('Error al cargar clasificación');

    const equipos = await response.json();
    const tbody = document.querySelector('#tabla-clasificacion tbody');
    tbody.innerHTML = '';

    equipos.forEach(equipo => {
        const tr = document.createElement('tr');
        if (equipo.esMeliana) {
            tr.classList.add('meliana-row');
        }

        tr.innerHTML = `
            <td>${equipo.posicion}</td>
            <td style="text-align: left; padding-left: 0.75rem;">${equipo.nombre}</td>
            <td><strong>${equipo.puntos}</strong></td>
            <td>${equipo.partidosJugados}</td>
            <td>${equipo.ganados}</td>
            <td>${equipo.empatados}</td>
            <td>${equipo.perdidos}</td>
            <td>${equipo.golesFavor}</td>
            <td>${equipo.golesContra}</td>
            <td>${equipo.diferencia}</td>
        `;

        tbody.appendChild(tr);
    });
}

// Cargar jornada actual
async function loadJornada() {
    const response = await fetch('/api/jornada');
    if (!response.ok) throw new Error('Error al cargar jornada');

    const partidos = await response.json();
    const container = document.getElementById('partidos-jornada');
    container.innerHTML = '';

    if (partidos.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: #6b7280;">No hay partidos disponibles</p>';
        return;
    }

    partidos.forEach(partido => {
        const card = createPartidoCard(partido);
        container.appendChild(card);
    });
}

// Cargar calendario
async function loadCalendario() {
    const response = await fetch('/api/calendario');
    if (!response.ok) throw new Error('Error al cargar calendario');

    const jornadas = await response.json();
    const container = document.getElementById('calendario-jornadas');
    container.innerHTML = '';

    if (jornadas.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: #6b7280;">No hay calendario disponible</p>';
        return;
    }

    jornadas.forEach(jornada => {
        if (jornada.partidos.length > 0) {
            const jornadaDiv = document.createElement('div');
            jornadaDiv.className = 'jornada-group';

            const title = document.createElement('div');
            title.className = 'jornada-title';
            title.textContent = jornada.nombre;
            jornadaDiv.appendChild(title);

            jornada.partidos.forEach(partido => {
                const card = createPartidoCard(partido);
                jornadaDiv.appendChild(card);
            });

            container.appendChild(jornadaDiv);
        }
    });
}

// Crear tarjeta de partido
function createPartidoCard(partido) {
    const card = document.createElement('div');
    card.className = 'partido-card';

    if (partido.esMeliana) {
        card.classList.add('meliana-partido');
    }

    const header = document.createElement('div');
    header.className = 'partido-header';

    let headerContent = '';
    if (partido.fecha) {
        headerContent += `<span>${partido.fecha}</span>`;
    }
    if (partido.hora) {
        headerContent += `<span>${partido.hora}</span>`;
    }
    header.innerHTML = headerContent;

    const equipos = document.createElement('div');
    equipos.className = 'partido-equipos';

    const local = document.createElement('div');
    local.className = 'equipo local';
    local.textContent = partido.local;

    const resultado = document.createElement('div');
    resultado.className = 'resultado';
    if (partido.resultado && partido.resultado.includes('-')) {
        resultado.textContent = partido.resultado;
    } else if (partido.resultado === 'vs') {
        resultado.textContent = 'vs';
        resultado.classList.add('pendiente');
    } else {
        resultado.textContent = partido.resultado || 'vs';
        resultado.classList.add('pendiente');
    }

    const visitante = document.createElement('div');
    visitante.className = 'equipo visitante';
    visitante.textContent = partido.visitante;

    equipos.appendChild(local);
    equipos.appendChild(resultado);
    equipos.appendChild(visitante);

    if (headerContent) {
        card.appendChild(header);
    }
    card.appendChild(equipos);

    // Añadir información del campo si existe
    if (partido.campo) {
        const campoDiv = document.createElement('div');
        campoDiv.className = 'partido-campo';
        campoDiv.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="display: inline-block; margin-right: 4px; vertical-align: middle;"><path d="M6 1C3.5 1 1.5 3 1.5 5.5C1.5 8.5 6 11 6 11C6 11 10.5 8.5 10.5 5.5C10.5 3 8.5 1 6 1Z" stroke="currentColor" stroke-width="1" fill="none"/><circle cx="6" cy="5.5" r="1.5" fill="currentColor"/></svg>${partido.campo}`;
        card.appendChild(campoDiv);
    }

    return card;
}

// Mostrar/ocultar loading
function showLoading() {
    loading.style.display = 'block';
}

function hideLoading() {
    loading.style.display = 'none';
}

// Mostrar/ocultar error
function showError() {
    errorDiv.style.display = 'block';
}

function hideError() {
    errorDiv.style.display = 'none';
}
