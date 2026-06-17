const openAuth = document.getElementById('open-auth');
const authModal = document.getElementById('auth-modal');
const closeAuth = document.getElementById('close-auth');
const authTabs = Array.from(document.querySelectorAll('.auth-tab'));
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const dashboardSection = document.getElementById('dashboard-section');
const authStatus = document.getElementById('auth-status');
const heroStatus = document.getElementById('hero-status');
const dashboardUser = document.getElementById('dashboard-user');
const dashboardRole = document.getElementById('dashboard-role');
const dashboardMessage = document.getElementById('dashboard-message');
const adminPanel = document.getElementById('admin-panel');
const userList = document.getElementById('user-list');
const ownerPanel = document.getElementById('owner-panel');
const ownerCreateForm = document.getElementById('owner-create-form');
const ownerCreateMessage = document.getElementById('owner-create-message');

const HYDRA_EMAIL = 'elhydrapapaya@gmail.com';
const HYDRA_PASSWORD = 'Papaya747';
const API_SERVER_REQUIRED = window.location.protocol === 'file:';

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
  } catch (_) { return null; }
}

function setSessionLocal(session) {
  // update UI based on session
  renderHeroStatus(session);
}

function clearSessionLocal() {
  renderHeroStatus(null);
}

function logActionClient(action, details) {
  api('/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, details }) }).catch(() => {});
}

function showAuthModal() {
  authModal.classList.remove('hidden');
  authModal.setAttribute('aria-hidden', 'false');
}

function hideAuthModal() {
  authModal.classList.add('hidden');
  authModal.setAttribute('aria-hidden', 'true');
}

function isHydraUser(user) {
  return Boolean(user && user.isHydra === true && user.email === HYDRA_EMAIL);
}

function setActiveTab(tab) {
  authTabs.forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  loginSection.classList.toggle('active', tab === 'login');
  registerSection.classList.toggle('active', tab === 'register');
  dashboardSection.classList.add('hidden');
  authStatus.textContent = '';
}

function renderHeroStatus(session) {
  if (!session) {
    heroStatus.textContent = 'Inicia sesión para ver el panel';
    return;
  }

  let roleText;
  if (session.isHydra) {
    roleText = 'HydraPapaya';
  } else if (session.role === 'owner') {
    roleText = 'Owner';
  } else if (session.role === 'staff') {
    roleText = 'Staff';
  } else {
    roleText = 'Usuario';
  }
  heroStatus.textContent = `Sesión activa: ${session.name} (${roleText}).`;
}

async function getCurrentUser() {
  return await getSession();
}

async function renderUserList(currentEmail, isHydra, isStaff) {
  try {
    const { users } = await api('/api/users');
    userList.innerHTML = users.map(user => {
      let roleLabel;
      if (user.role === 'owner') roleLabel = 'Owner';
      else if (user.role === 'staff') roleLabel = 'Staff';
      else roleLabel = 'Usuario corriente';

      const canModify = user.email !== currentEmail;
      let actionButtons = '';

      if (isHydra) {
        actionButtons = `
          <button class="btn btn-secondary" data-action="toggle-role" data-email="${user.email}">${user.role === 'owner' ? 'Hacer usuario' : user.role === 'staff' ? 'Hacer usuario' : 'Hacer staff'}</button>
          <button class="btn btn-secondary" data-action="delete-user" data-email="${user.email}" ${canModify ? '' : 'disabled'}>Eliminar</button>
        `;
      } else if (isStaff) {
        actionButtons = `
          <button class="btn btn-secondary" data-action="delete-user" data-email="${user.email}" ${canModify ? '' : 'disabled'}>Eliminar</button>
        `;
      } else {
        actionButtons = '<span class="user-note">No tienes permisos de administración.</span>';
      }

      return `
        <tr>
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td>${roleLabel}</td>
          <td class="user-actions">${actionButtons}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    userList.innerHTML = '<tr><td colspan="4">Error al cargar usuarios</td></tr>';
  }
}

async function updateDashboard() {
  const user = await getCurrentUser();
  if (!user) {
    dashboardSection.classList.add('hidden');
    adminPanel.classList.add('hidden');
    ownerPanel.classList.add('hidden');
    return;
  }

  const isHydra = isHydraUser(user);
  const isStaff = user.role === 'staff';
  let roleText;
  if (isHydra) {
    roleText = 'HydraPapaya';
  } else if (user.role === 'owner') {
    roleText = 'Owner';
  } else if (user.role === 'staff') {
    roleText = 'Staff';
  } else {
    roleText = 'Usuario';
  }

  dashboardUser.textContent = user.name;
  dashboardRole.textContent = `Rol: ${roleText}`;
  authStatus.textContent = 'Has iniciado sesión correctamente.';

  if (isHydra) {
    adminPanel.classList.remove('hidden');
    ownerPanel.classList.remove('hidden');
    await renderUserList(user.email, true, false);
    dashboardMessage.textContent = 'Bienvenido creador';
  } else if (isStaff) {
    adminPanel.classList.remove('hidden');
    ownerPanel.classList.remove('hidden');
    await renderUserList(user.email, false, true);
    dashboardMessage.textContent = 'Bienvenido Staff. Puedes crear usuarios y eliminar usuarios.';
  } else if (user.role === 'owner') {
    adminPanel.classList.remove('hidden');
    ownerPanel.classList.remove('hidden');
    await renderUserList(user.email, false, false);
    dashboardMessage.textContent = 'Bienvenido Owner.';
  } else {
    adminPanel.classList.add('hidden');
    ownerPanel.classList.add('hidden');
    dashboardMessage.textContent = 'No tienes permisos de administración.';
  }

  dashboardSection.classList.remove('hidden');
  loginSection.classList.remove('active');
  registerSection.classList.remove('active');
}

function showMessage(message, isError = false) {
  authStatus.textContent = message;
  authStatus.style.color = isError ? '#ffb3bf' : '#a1e3ff';
}

function showOwnerMessage(message, isError = false) {
  if (!ownerCreateMessage) return;
  ownerCreateMessage.textContent = message;
  ownerCreateMessage.style.color = isError ? '#ffb3bf' : '#a1e3ff';
}

async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim().toLowerCase();
  const password = document.getElementById('register-password').value;
  if (!name || !email || !password) return showMessage('Completa todos los campos para registrarte.', true);
  if (password.length < 6) return showMessage('La contraseña debe tener al menos 6 caracteres.', true);
  try {
    const { user } = await api('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
    setSessionLocal(user);
    logActionClient('register', `Registrado ${email}`);
    updateDashboard();
    showMessage('Registro exitoso. Ya has iniciado sesión.');
    setActiveTab('login');
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  try {
    const { user } = await api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    setSessionLocal(user);
    logActionClient('login', `Inicio ${email}`);
    updateDashboard();
    showMessage('Inicio de sesión correcto. Bienvenido.');
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function handleLogout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (_) {}
  clearSessionLocal();
  hideAuthModal();
  dashboardSection.classList.add('hidden');
  adminPanel.classList.add('hidden');
  ownerPanel.classList.add('hidden');
  showMessage('Has cerrado sesión.');
}

async function handleOwnerCreate(event) {
  event.preventDefault();
  const name = document.getElementById('owner-name').value.trim();
  const email = document.getElementById('owner-email').value.trim().toLowerCase();
  const password = document.getElementById('owner-password').value;
  const role = document.getElementById('owner-role').value;
  const currentUser = await getCurrentUser();
  if (!name || !email || !password) return showOwnerMessage('Completa todos los campos para crear un usuario.', true);
  if (password.length < 6) return showOwnerMessage('La contraseña debe tener al menos 6 caracteres.', true);
  if (email === HYDRA_EMAIL) return showOwnerMessage('No se juega a ser dios', true);

  const isHydra = isHydraUser(currentUser);
  const isStaff = currentUser && currentUser.role === 'staff';

  if (role === 'owner' && !isHydra) return showOwnerMessage('Solo HydraPapaya puede crear usuarios Owner.', true);

  try {
    await api('/api/users/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, role }) });
    renderUserList(currentUser.email, isHydra, isStaff);
    showOwnerMessage('Usuario creado con éxito.');
    ownerCreateForm.reset();
    logActionClient('create_user', `Creó ${email} rol:${role}`);
  } catch (err) {
    showOwnerMessage(err.message, true);
  }
}

async function handleUserAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const email = button.dataset.email;
  const currentUser = await getCurrentUser();
  if (!currentUser) return showMessage('Debes iniciar sesión.', true);
  const isHydra = isHydraUser(currentUser);
  const isStaff = currentUser.role === 'staff';

  if (action === 'toggle-role') {
    if (!isHydra) return showMessage('Solo HydraPapaya puede cambiar roles.', true);
    try {
      await api('/api/users/toggle-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      updateDashboard();
      showMessage('Rol actualizado con éxito.');
      logActionClient('toggle_role', `Cambiado rol ${email}`);
    } catch (err) { showMessage(err.message, true); }
  }

  if (action === 'delete-user') {
    if (!isHydra && !isStaff) return showMessage('No tienes permisos para eliminar usuarios.', true);
    if (email === HYDRA_EMAIL) return showMessage('No puedes eliminar a HydraPapaya.', true);
    try {
      await api('/api/users/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      updateDashboard();
      showMessage('Usuario eliminado.');
      logActionClient('delete_user', `Eliminado ${email}`);
    } catch (err) { showMessage(err.message, true); }
  }
}

async function initializeAuth() {
  openAuth.addEventListener('click', async () => {
    showAuthModal();
    const session = await getSession();
    if (session) {
      await updateDashboard();
    } else {
      setActiveTab('login');
    }
  });

  closeAuth.addEventListener('click', hideAuthModal);
  authModal.addEventListener('click', event => {
    if (event.target === authModal) hideAuthModal();
  });

  authTabs.forEach(button => {
    button.addEventListener('click', () => {
      setActiveTab(button.dataset.tab);
    });
  });

  document.getElementById('register-form').addEventListener('submit', handleRegister);
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-button').addEventListener('click', handleLogout);
  if (ownerCreateForm) ownerCreateForm.addEventListener('submit', handleOwnerCreate);
  authModal.addEventListener('click', handleUserAction);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !authModal.classList.contains('hidden')) {
      hideAuthModal();
    }
  });

  const currentSession = await getSession();
  renderHeroStatus(currentSession);
  if (currentSession) await updateDashboard();
}

initializeAuth();
