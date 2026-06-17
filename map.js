const API_SERVER_REQUIRED = window.location.protocol === 'file:';
let map = null;
let markers = [];
let currentUser = null;

async function api(path, opts = {}) {
  if (API_SERVER_REQUIRED) {
    throw new Error('Necesitas ejecutar la app con el servidor Node.js. Usa npm install && npm start y abre http://localhost:3000');
  }

  let res;
  try {
    res = await fetch(path, opts);
  } catch (err) {
    throw new Error('No se puede conectar al backend. Asegúrate de que el servidor esté corriendo.');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'API error');
  return json;
}

async function getSession() {
  try {
    const { user } = await api('/api/session');
    return user;
  } catch (_) {
    return null;
  }
}

function showUserModal() {
  document.getElementById('user-modal').classList.remove('hidden');
}

function hideUserModal() {
  document.getElementById('user-modal').classList.add('hidden');
  document.getElementById('password-form-status').textContent = '';
  document.getElementById('change-password-form').reset();
}

function showPointModal() {
  document.getElementById('point-modal').classList.remove('hidden');
}

function hidePointModal() {
  document.getElementById('point-modal').classList.add('hidden');
  document.getElementById('point-form-status').textContent = '';
  document.getElementById('add-point-form').reset();
}

function updateUserPanel(session) {
  const addPointButton = document.getElementById('open-add-point');
  const userName = document.getElementById('user-name');
  const userEmail = document.getElementById('user-email');
  const userRoleText = document.getElementById('user-role-text');

  if (!session) {
    addPointButton.classList.add('hidden');
    userName.textContent = 'Invitado';
    userEmail.textContent = 'No has iniciado sesión';
    userRoleText.textContent = 'N/A';
    return;
  }

  const role = session.isHydra ? 'HydraPapaya' : session.role === 'owner' ? 'Owner' : session.role === 'staff' ? 'Staff' : 'Usuario';
  userName.textContent = session.name;
  userEmail.textContent = session.email;
  userRoleText.textContent = role;

  const canCreate = session.isHydra || session.role === 'owner' || session.role === 'staff';
  addPointButton.classList.toggle('hidden', !canCreate);
}

function buildGoogleMapsLink(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
}

function createPointCard(point, marker) {
  const card = document.createElement('article');
  card.className = 'point-card';
  card.dataset.pointId = point.id;

  card.innerHTML = `
    <div class="point-card-header">
      <div>
        <strong>${point.title}</strong>
        <span>${point.location || 'Ubicación desconocida'}</span>
      </div>
      <a href="${buildGoogleMapsLink(point.lat, point.lng)}" target="_blank" rel="noreferrer noopener" class="link-button">Google Maps</a>
    </div>
    <p>${point.description || 'Sin descripción'}</p>
    ${point.photo_url ? `<img src="${point.photo_url}" alt="Foto de ${point.title}" class="point-photo" />` : ''}
    <div class="point-card-footer">
      <span>Coordenadas: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}</span>
      <span>Creado por: ${point.created_by || 'Anónimo'}</span>
    </div>
  `;

  card.addEventListener('click', () => {
    map.setView([point.lat, point.lng], 15, { animate: true });
    if (marker) marker.openPopup();
    document.querySelectorAll('.point-card.active').forEach(item => item.classList.remove('active'));
    card.classList.add('active');
  });

  if (marker) {
    marker.on('click', () => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.querySelectorAll('.point-card.active').forEach(item => item.classList.remove('active'));
      card.classList.add('active');
    });
  }

  return card;
}

function clearMarkers() {
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
}

async function loadPoints() {
  const list = document.getElementById('point-list');
  list.innerHTML = '<p class="empty-state">Cargando puntos...</p>';

  try {
    const { points } = await api('/api/map/points');
    if (!points || !points.length) {
      list.innerHTML = '<p class="empty-state">No hay puntos añadidos todavía.</p>';
      return;
    }

    clearMarkers();
    list.innerHTML = '';

    points.forEach(point => {
      const marker = L.marker([point.lat, point.lng], { title: point.title })
        .addTo(map)
        .bindPopup(`<strong>${point.title}</strong><br>${point.location || ''}`);
      markers.push(marker);
      const card = createPointCard(point, marker);
      list.appendChild(card);
    });
  } catch (err) {
    list.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

async function handleAddPointSubmit(event) {
  event.preventDefault();
  const title = document.getElementById('point-title').value.trim();
  const location = document.getElementById('point-location').value.trim();
  const description = document.getElementById('point-description').value.trim();
  const photo = document.getElementById('point-photo').value.trim();
  const lat = parseFloat(document.getElementById('point-lat').value);
  const lng = parseFloat(document.getElementById('point-lng').value);
  const status = document.getElementById('point-form-status');

  if (!title || !location || !description || Number.isNaN(lat) || Number.isNaN(lng)) {
    status.textContent = 'Completa todos los campos correctamente.';
    status.style.color = '#ffb3bf';
    return;
  }

  try {
    await api('/api/map/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, location, description, photoUrl: photo, lat, lng })
    });
    status.textContent = 'Punto creado con éxito.';
    status.style.color = '#a1e3ff';
    await loadPoints();
    setTimeout(hidePointModal, 900);
  } catch (err) {
    status.textContent = err.message;
    status.style.color = '#ffb3bf';
  }
}

async function handleChangePasswordSubmit(event) {
  event.preventDefault();
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const status = document.getElementById('password-form-status');

  if (!currentPassword || !newPassword || !confirmPassword) {
    status.textContent = 'Completa todos los campos.';
    status.style.color = '#ffb3bf';
    return;
  }
  if (newPassword !== confirmPassword) {
    status.textContent = 'Las contraseñas nuevas no coinciden.';
    status.style.color = '#ffb3bf';
    return;
  }

  try {
    await api('/api/users/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    status.textContent = 'Contraseña actualizada con éxito.';
    status.style.color = '#a1e3ff';
    document.getElementById('change-password-form').reset();
  } catch (err) {
    status.textContent = err.message;
    status.style.color = '#ffb3bf';
  }
}

async function handleLogout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (_) {
  }
  window.location.href = '/';
}

function initMap() {
  map = L.map('map', {
    center: [40.4168, -3.7038],
    zoom: 12,
    minZoom: 10,
    maxZoom: 18
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
}

async function initialize() {
  currentUser = await getSession();
  updateUserPanel(currentUser);
  initMap();
  await loadPoints();

  document.getElementById('open-user-panel').addEventListener('click', () => {
    if (!currentUser) {
      window.location.href = '/';
      return;
    }
    showUserModal();
  });
  document.getElementById('logout-button').addEventListener('click', handleLogout);
  document.getElementById('close-user-modal').addEventListener('click', hideUserModal);
  document.getElementById('user-modal').addEventListener('click', event => {
    if (event.target.id === 'user-modal') hideUserModal();
  });
  document.getElementById('change-password-form').addEventListener('submit', handleChangePasswordSubmit);
  document.getElementById('open-add-point').addEventListener('click', showPointModal);
  document.getElementById('close-point-modal').addEventListener('click', hidePointModal);
  document.getElementById('point-modal').addEventListener('click', event => {
    if (event.target.id === 'point-modal') hidePointModal();
  });
  document.getElementById('add-point-form').addEventListener('submit', handleAddPointSubmit);
}

initialize();
