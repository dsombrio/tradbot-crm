const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tradbot-crm-secret-2026';

// PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database schema
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        first_name TEXT NOT NULL,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        company TEXT,
        type TEXT DEFAULT 'prospect',
        metro TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS deals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        contact_id INTEGER REFERENCES contacts(id),
        title TEXT NOT NULL,
        value REAL DEFAULT 0,
        stage TEXT DEFAULT 'lead',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        contact_id INTEGER REFERENCES contacts(id),
        deal_id INTEGER REFERENCES deals(id),
        title TEXT NOT NULL,
        description TEXT,
        due_date DATE,
        timeframe_minutes INTEGER,
        source TEXT DEFAULT 'manual',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        contact_id INTEGER REFERENCES contacts(id),
        deal_id INTEGER REFERENCES deals(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database initialized');
  } finally {
    client.release();
  }
}

app.use(cors());
app.use(express.json());

// Auth middleware
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ============ AUTH ============

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
      [email, hash, name]
    );
    const userId = result.rows[0].id;
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: userId, email, name } });
  } catch (e) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.userId]);
  res.json(result.rows[0]);
});

// ============ CONTACTS ============

app.get('/api/contacts', authenticate, async (req, res) => {
  const { search, type, metro } = req.query;
  let sql = 'SELECT * FROM contacts WHERE user_id = $1';
  const params = [req.userId];
  
  if (search) {
    sql += ' AND (first_name ILIKE $2 OR last_name ILIKE $2 OR company ILIKE $2 OR email ILIKE $2)';
    params.push(`%${search}%`);
  }
  if (type) {
    sql += ` AND type = $${params.length + 1}`;
    params.push(type);
  }
  if (metro) {
    sql += ` AND metro = $${params.length + 1}`;
    params.push(metro);
  }
  
  sql += ' ORDER BY created_at DESC';
  const result = await pool.query(sql, params);
  res.json(result.rows);
});

app.get('/api/contacts/:id', authenticate, async (req, res) => {
  const result = await pool.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]);
});

app.post('/api/contacts', authenticate, async (req, res) => {
  const { first_name, last_name, email, phone, company, type, metro, notes } = req.body;
  const result = await pool.query(`
    INSERT INTO contacts (user_id, first_name, last_name, email, phone, company, type, metro, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
  `, [req.userId, first_name, last_name, email, phone, company, type || 'prospect', metro, notes]);
  res.json(result.rows[0]);
});

app.put('/api/contacts/:id', authenticate, async (req, res) => {
  const { first_name, last_name, email, phone, company, type, metro, notes } = req.body;
  await pool.query(`
    UPDATE contacts SET first_name=$1, last_name=$2, email=$3, phone=$4, company=$5, type=$6, metro=$7, notes=$8, updated_at=CURRENT_TIMESTAMP
    WHERE id=$9 AND user_id=$10
  `, [first_name, last_name, email, phone, company, type, metro, notes, req.params.id, req.userId]);
  res.json({ id: req.params.id, ...req.body });
});

app.delete('/api/contacts/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM contacts WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ success: true });
});

// ============ DEALS ============

app.get('/api/deals', authenticate, async (req, res) => {
  const { stage } = req.query;
  let sql = 'SELECT d.*, c.first_name, c.last_name, c.company FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id WHERE d.user_id = $1';
  const params = [req.userId];
  
  if (stage) {
    sql += ` AND d.stage = $${params.length + 1}`;
    params.push(stage);
  }
  
  sql += ' ORDER BY d.created_at DESC';
  const result = await pool.query(sql, params);
  res.json(result.rows);
});

app.get('/api/deals/:id', authenticate, async (req, res) => {
  const result = await pool.query(
    'SELECT d.*, c.first_name, c.last_name, c.company FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id WHERE d.id = $1',
    [req.params.id]
  );
  res.json(result.rows[0]);
});

app.post('/api/deals', authenticate, async (req, res) => {
  const { contact_id, title, value, stage, notes } = req.body;
  const result = await pool.query(`
    INSERT INTO deals (user_id, contact_id, title, value, stage, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [req.userId, contact_id, title, value || 0, stage || 'lead', notes]);
  res.json(result.rows[0]);
});

app.put('/api/deals/:id', authenticate, async (req, res) => {
  const { contact_id, title, value, stage, notes } = req.body;
  await pool.query(`
    UPDATE deals SET contact_id=$1, title=$2, value=$3, stage=$4, notes=$5, updated_at=CURRENT_TIMESTAMP
    WHERE id=$6 AND user_id=$7
  `, [contact_id, title, value, stage, notes, req.params.id, req.userId]);
  res.json({ id: req.params.id, ...req.body });
});

app.delete('/api/deals/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM deals WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ success: true });
});

// ============ TASKS ============

app.get('/api/tasks', authenticate, async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT t.*, c.first_name, c.last_name, c.company FROM tasks t LEFT JOIN contacts c ON t.contact_id = c.id WHERE t.user_id = $1';
  const params = [req.userId];
  
  if (status === 'pending') {
    sql += " AND t.status = 'pending'";
  } else if (status === 'completed') {
    sql += " AND t.status = 'completed'";
  }
  
  sql += ' ORDER BY t.created_at DESC';
  const result = await pool.query(sql, params);
  res.json(result.rows);
});

app.post('/api/tasks', authenticate, async (req, res) => {
  const { contact_id, deal_id, title, description, due_date, timeframe_minutes, source } = req.body;
  const result = await pool.query(`
    INSERT INTO tasks (user_id, contact_id, deal_id, title, description, due_date, timeframe_minutes, source)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
  `, [req.userId, contact_id, deal_id, title, description, due_date, timeframe_minutes, source || 'manual']);
  res.json(result.rows[0]);
});

app.put('/api/tasks/:id', authenticate, async (req, res) => {
  const { title, description, due_date, timeframe_minutes, status } = req.body;
  const completed_at = status === 'completed' ? new Date().toISOString() : null;
  await pool.query(`
    UPDATE tasks SET title=$1, description=$2, due_date=$3, timeframe_minutes=$4, status=$5, completed_at=$6
    WHERE id=$7 AND user_id=$8
  `, [title, description, due_date, timeframe_minutes, status, completed_at, req.params.id, req.userId]);
  res.json({ id: req.params.id, ...req.body });
});

app.patch('/api/tasks/:id/complete', authenticate, async (req, res) => {
  await pool.query(`
    UPDATE tasks SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE id=$1 AND user_id=$2
  `, [req.params.id, req.userId]);
  res.json({ success: true });
});

app.delete('/api/tasks/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ success: true });
});

// ============ NOTES ============

app.get('/api/notes', authenticate, async (req, res) => {
  const { contact_id, deal_id } = req.query;
  let sql = 'SELECT n.*, c.first_name, c.last_name, c.company FROM notes n LEFT JOIN contacts c ON n.contact_id = c.id WHERE n.user_id = $1';
  const params = [req.userId];
  
  if (contact_id) {
    sql += ` AND n.contact_id = $${params.length + 1}`;
    params.push(contact_id);
  }
  if (deal_id) {
    sql += ` AND n.deal_id = $${params.length + 1}`;
    params.push(deal_id);
  }
  
  sql += ' ORDER BY n.created_at DESC';
  const result = await pool.query(sql, params);
  res.json(result.rows);
});

app.post('/api/notes', authenticate, async (req, res) => {
  const { contact_id, deal_id, content } = req.body;
  const result = await pool.query(
    'INSERT INTO notes (user_id, contact_id, deal_id, content) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.userId, contact_id, deal_id, content]
  );
  res.json(result.rows[0]);
});

app.delete('/api/notes/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ success: true });
});

// ============ DASHBOARD ============

app.get('/api/dashboard', authenticate, async (req, res) => {
  const tasks = await pool.query(`
    SELECT t.*, c.first_name, c.last_name, c.company 
    FROM tasks t LEFT JOIN contacts c ON t.contact_id = c.id 
    WHERE t.user_id = $1 AND t.status = 'pending' 
    ORDER BY t.created_at DESC LIMIT 10
  `, [req.userId]);
  
  const activeDeals = await pool.query(`
    SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as total 
    FROM deals WHERE user_id = $1 AND stage NOT IN ('won', 'lost')
  `, [req.userId]);
  
  const recentNotes = await pool.query(`
    SELECT n.*, c.first_name, c.last_name, c.company 
    FROM notes n LEFT JOIN contacts c ON n.contact_id = c.id 
    WHERE n.user_id = $1 
    ORDER BY n.created_at DESC LIMIT 5
  `, [req.userId]);
  
  res.json({ 
    tasks: tasks.rows, 
    activeDeals: activeDeals.rows[0], 
    recentNotes: recentNotes.rows 
  });
});

// ============ SEARCH ============

app.get('/api/search', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ contacts: [], deals: [] });
  
  const s = `%${q}%`;
  const contacts = await pool.query(`
    SELECT * FROM contacts WHERE user_id = $1 AND (first_name ILIKE $2 OR last_name ILIKE $2 OR company ILIKE $2 OR email ILIKE $2)
    LIMIT 10
  `, [req.userId, s]);
  
  const deals = await pool.query(`
    SELECT d.*, c.first_name, c.last_name, c.company FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id
    WHERE d.user_id = $1 AND (d.title ILIKE $2 OR c.first_name ILIKE $2 OR c.last_name ILIKE $2)
    LIMIT 10
  `, [req.userId, s]);
  
  res.json({ contacts: contacts.rows, deals: deals.rows });
});

// Start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`CRM API running on port ${PORT}`);
  });
});
