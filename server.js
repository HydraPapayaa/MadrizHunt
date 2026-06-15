const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const HYDRA_EMAIL = 'elhydrapapaya@gmail.com';
const HYDRA_PASSWORD = 'Papaya747';

const app = express();
const dbFile = path.join(__dirname, 'madriz.db');
const db = new sqlite3.Database(dbFile);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));
app.use(session({
  secret: 'madrizhunt-secret-please-change',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Initialize DB
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    isHydra INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY,
    user_email TEXT,
    action TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

function logAction(userEmail, action, details) {
  db.run('INSERT INTO logs (user_email, action, details) VALUES (?, ?, ?)', [userEmail || null, action, details || null]);
}

app.get('/api/session', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  res.json({ user: req.session.user });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (email.toLowerCase() === HYDRA_EMAIL) return res.status(400).json({ error: 'No se juega a ser dios' });

  const hashed = await bcrypt.hash(password, 10);
  const role = 'user';
  db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email.toLowerCase(), hashed, role], function(err) {
    if (err) return res.status(400).json({ error: 'Usuario ya existe o error' });
    req.session.user = { name, email: email.toLowerCase(), role, isHydra: false };
    logAction(email.toLowerCase(), 'register', `Usuario registrado: ${name}`);
    res.json({ user: req.session.user });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const lower = email.toLowerCase();
  // Hydra direct login
  if (lower === HYDRA_EMAIL && password === HYDRA_PASSWORD) {
    const role = 'owner';
    // ensure hydra exists
    db.get('SELECT * FROM users WHERE email = ?', [lower], (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!row) {
        const hashed = bcrypt.hashSync(password, 10);
        db.run('INSERT INTO users (name, email, password, role, isHydra) VALUES (?, ?, ?, ?, 1)', ['HydraPapaya', lower, hashed, role], function(err) {
          req.session.user = { name: 'HydraPapaya', email: lower, role, isHydra: true };
          logAction(lower, 'login', 'Hydra log in (created)');
          return res.json({ user: req.session.user });
        });
      } else {
        db.run('UPDATE users SET role = ?, isHydra = 1 WHERE email = ?', [role, lower], () => {
          req.session.user = { name: row ? row.name : 'HydraPapaya', email: lower, role, isHydra: true };
          logAction(lower, 'login', 'Hydra log in');
          return res.json({ user: req.session.user });
        });
      }
    });
    return;
  }

  db.get('SELECT * FROM users WHERE email = ?', [lower], async (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(400).json({ error: 'Correo o contraseña incorrectos' });
    const match = await bcrypt.compare(password, row.password);
    if (!match) return res.status(400).json({ error: 'Correo o contraseña incorrectos' });
    req.session.user = { name: row.name, email: row.email, role: row.role, isHydra: !!row.isHydra };
    logAction(row.email, 'login', `Usuario ${row.name} inició sesión`);
    res.json({ user: req.session.user });
  });
});

app.post('/api/logout', (req, res) => {
  const user = req.session.user && req.session.user.email;
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Error cerrando sesión' });
    logAction(user, 'logout', 'Usuario cerró sesión');
    res.json({ ok: true });
  });
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'No autorizado' });
  next();
}

app.get('/api/users', requireAuth, (req, res) => {
  const cur = req.session.user;
  if (!cur) return res.status(401).json({ error: 'No autorizado' });
  // only owner, staff or hydra can view
  if (!(cur.isHydra || cur.role === 'owner' || cur.role === 'staff')) return res.status(403).json({ error: 'Permiso denegado' });

  db.all('SELECT id, name, email, role, isHydra FROM users ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ users: rows });
  });
});

app.post('/api/users/create', requireAuth, (req, res) => {
  const cur = req.session.user;
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (email.toLowerCase() === HYDRA_EMAIL) return res.status(400).json({ error: 'No se juega a ser dios' });

  const lower = email.toLowerCase();
  const isHydra = cur.isHydra === true;

  // Only Hydra can create owners
  if (role === 'owner' && !isHydra) return res.status(403).json({ error: 'Solo HydraPapaya puede crear owners' });

  // staff may create staff and user; owners and hydra can create any
  if (cur.role === 'staff' && role === 'owner') return res.status(403).json({ error: 'Staff no puede crear owners' });

  const hashed = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, lower, hashed, role || 'user'], function(err) {
    if (err) return res.status(400).json({ error: 'Usuario ya existe o error' });
    logAction(cur.email, 'create_user', `Creó usuario ${lower} con rol ${role}`);
    res.json({ ok: true });
  });
});

app.post('/api/users/toggle-role', requireAuth, (req, res) => {
  const cur = req.session.user;
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  if (!cur.isHydra) return res.status(403).json({ error: 'Solo HydraPapaya puede cambiar roles' });
  if (email.toLowerCase() === HYDRA_EMAIL) return res.status(400).json({ error: 'No se puede cambiar rol de Hydra' });

  db.get('SELECT role FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Usuario no encontrado' });
    let newRole = row.role === 'owner' ? 'staff' : row.role === 'staff' ? 'user' : 'staff';
    db.run('UPDATE users SET role = ? WHERE email = ?', [newRole, email.toLowerCase()], function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      logAction(cur.email, 'toggle_role', `Cambiado ${email} -> ${newRole}`);
      res.json({ ok: true });
    });
  });
});

app.post('/api/users/delete', requireAuth, (req, res) => {
  const cur = req.session.user;
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  if (email.toLowerCase() === HYDRA_EMAIL) return res.status(403).json({ error: 'No se puede eliminar a HydraPapaya' });

  // only staff/owner/hydra can delete
  if (!(cur.isHydra || cur.role === 'owner' || cur.role === 'staff')) return res.status(403).json({ error: 'Permiso denegado' });

  db.run('DELETE FROM users WHERE email = ?', [email.toLowerCase()], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    logAction(cur.email, 'delete_user', `Eliminado usuario ${email}`);
    res.json({ ok: true });
  });
});

app.post('/api/logs', requireAuth, (req, res) => {
  const cur = req.session.user;
  const { action, details } = req.body;
  logAction(cur.email, action, details);
  res.json({ ok: true });
});

app.get('/api/logs', requireAuth, (req, res) => {
  const cur = req.session.user;
  if (!(cur.isHydra || cur.role === 'owner')) return res.status(403).json({ error: 'Permiso denegado' });
  db.all('SELECT * FROM logs ORDER BY id DESC LIMIT 500', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ logs: rows });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
