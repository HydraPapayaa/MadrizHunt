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

const USER_STORAGE_KEY = 'madrizUsers';
const SESSION_STORAGE_KEY = 'madrizSession';
const HYDRA_EMAIL = 'elhydrapapaya@gmail.com';
const HYDRA_PASSWORD = 'Papaya747';

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY));
  } catch {
    return null;
  }
}

function setSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
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

function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  const users = getUsers();
  return users.find(user => user.email === session.email) || null;
}

function renderUserList(currentEmail, isHydra, isStaff) {
  const users = getUsers();
  userList.innerHTML = users.map(user => {
    let roleLabel;
    if (user.role === 'owner') {
      roleLabel = 'Owner';
    } else if (user.role === 'staff') {
      roleLabel = 'Staff';
    } else {
      roleLabel = 'Usuario';
    }
    
    const canModify = user.email !== currentEmail;
    let actionButtons;
    
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
}

function updateDashboard() {
  const user = getCurrentUser();
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
    renderUserList(user.email, true, false);
    dashboardMessage.textContent = 'Bienvenido creador';
  } else if (isStaff) {
    adminPanel.classList.remove('hidden');
    ownerPanel.classList.remove('hidden');
    renderUserList(user.email, false, true);
    dashboardMessage.textContent = 'Bienvenido Staff. Puedes crear usuarios corrientes y staff, y eliminar usuarios.';
  } else {
    adminPanel.classList.add('hidden');
    ownerPanel.classList.add('hidden');
    dashboardMessage.textContent = 'No tienes permisos de administración. Solo HydraPapaya, Owner y Staff pueden administrar usuarios.';
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

function handleRegister(event) {
  event.preventDefault();

  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim().toLowerCase();
  const password = document.getElementById('register-password').value;

  if (!name || !email || !password) {
    showMessage('Completa todos los campos para registrarte.', true);
    return;
  }

  if (password.length < 6) {
    showMessage('La contraseña debe tener al menos 6 caracteres.', true);
    return;
  }

  if (email === HYDRA_EMAIL) {
    showMessage('No se juega a ser dios', true);
    return;
  }

  const users = getUsers();
  if (users.some(user => user.email === email)) {
    showMessage('Ya existe un usuario con ese correo.', true);
    return;
  }

  users.push({ id: Date.now(), name, email, password, role: 'user', isHydra: false });
  saveUsers(users);
  setSession({ name, email, role: 'user', isHydra: false });
  renderHeroStatus({ name, email, role: 'user', isHydra: false });
  updateDashboard();
  showMessage('Registro exitoso. Ya has iniciado sesión.');
  setActiveTab('login');
}

function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const users = getUsers();
  const user = users.find(item => item.email === email && item.password === password);
  const isHydra = email === HYDRA_EMAIL && password === HYDRA_PASSWORD;

  if (!user && !isHydra) {
    showMessage('Correo o contraseña incorrectos.', true);
    return;
  }

  let currentUser = user;
  let role = user ? user.role : 'owner';

  if (isHydra) {
    role = 'owner';
    if (!currentUser) {
      currentUser = { id: Date.now(), name: 'HydraPapaya', email, password, role, isHydra: true };
      users.push(currentUser);
      saveUsers(users);
    } else {
      const updatedUsers = users.map(item => item.email === email ? { ...item, role, isHydra: true } : item);
      saveUsers(updatedUsers);
    }
  }

  setSession({ name: currentUser.name, email: currentUser.email, role, isHydra });
  renderHeroStatus({ name: currentUser.name, email: currentUser.email, role, isHydra });
  updateDashboard();
  showMessage('Inicio de sesión correcto. Bienvenido.');
}

function handleLogout() {
  clearSession();
  hideAuthModal();
  renderHeroStatus(null);
  dashboardSection.classList.add('hidden');
  adminPanel.classList.add('hidden');
  ownerPanel.classList.add('hidden');
  showMessage('Has cerrado sesión.');
}

function handleOwnerCreate(event) {
  event.preventDefault();

  const name = document.getElementById('owner-name').value.trim();
  const email = document.getElementById('owner-email').value.trim().toLowerCase();
  const password = document.getElementById('owner-password').value;
  const role = document.getElementById('owner-role').value;
  const currentUser = getCurrentUser();

  if (!name || !email || !password) {
    showOwnerMessage('Completa todos los campos para crear un usuario.', true);
    return;
  }

  if (password.length < 6) {
    showOwnerMessage('La contraseña debe tener al menos 6 caracteres.', true);
    return;
  }

  if (email === HYDRA_EMAIL) {
    showOwnerMessage('No se juega a ser dios', true);
    return;
  }

  const isHydra = isHydraUser(currentUser);
  const isStaff = currentUser.role === 'staff';

  // Solo HydraPapaya puede crear owners
  if (role === 'owner' && !isHydra) {
    showOwnerMessage('Solo HydraPapaya puede crear usuarios Owner.', true);
    return;
  }

  // Staff solo puede crear usuarios corrientes y staff
  if (isStaff && (role === 'owner' || role === 'staff')) {
    showOwnerMessage('Solo puedes crear usuarios corrientes.', true);
    return;
  }

  const users = getUsers();
  if (users.some(user => user.email === email)) {
    showOwnerMessage('Ya existe un usuario con ese correo.', true);
    return;
  }

  users.push({ id: Date.now(), name, email, password, role, isHydra: false });
  saveUsers(users);
  renderUserList(currentUser.email, isHydra, isStaff);
  showOwnerMessage('Usuario creado con éxito.');
  ownerCreateForm.reset();
}

function handleUserAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const email = button.dataset.email;
  const currentUser = getCurrentUser();

  if (!currentUser) {
    showMessage('Debes iniciar sesión.', true);
    return;
  }

  const isHydra = isHydraUser(currentUser);
  const isStaff = currentUser.role === 'staff';

  if (action === 'toggle-role') {
    if (!isHydra) {
      showMessage('Solo HydraPapaya puede cambiar roles.', true);
      return;
    }

    const users = getUsers();
    const updated = users.map(user => {
      if (user.email !== email) return user;
      // HydraPapaya puede cambiar entre user, staff y owner
      if (user.role === 'owner') return { ...user, role: 'staff' };
      if (user.role === 'staff') return { ...user, role: 'user' };
      return { ...user, role: 'staff' };
    });
    saveUsers(updated);
    updateDashboard();
    showMessage('Rol actualizado con éxito.');
  }

  if (action === 'delete-user') {
    if (!isHydra && !isStaff) {
      showMessage('No tienes permisos para eliminar usuarios.', true);
      return;
    }

    if (email === HYDRA_EMAIL) {
      showMessage('No puedes eliminar a HydraPapaya.', true);
      return;
    }

    const users = getUsers().filter(user => user.email !== email);
    saveUsers(users);
    updateDashboard();
    showMessage('Usuario eliminado.');
  }
}

function initializeAuth() {
  openAuth.addEventListener('click', () => {
    showAuthModal();
    const session = getSession();
    if (session) {
      updateDashboard();
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

  const currentSession = getSession();
  renderHeroStatus(currentSession);
  if (currentSession) {
    updateDashboard();
  }
}

initializeAuth();
