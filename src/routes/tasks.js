const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all tasks
router.get('/', async (req, res) => {
  try {
    const { user_id, completed, due_today, overdue } = req.query;
    let query = `
      SELECT t.*, co.name as company_name, c.first_name, c.last_name, d.name as deal_name
      FROM tasks t
      LEFT JOIN companies co ON t.company_id = co.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN deals d ON t.deal_id = d.id
      WHERE 1=1`;
    const params = [];
    
    if (user_id) {
      params.push(user_id);
      query += ` AND t.user_id = $${params.length}`;
    }
    
    if (completed === 'true') {
      query += ' AND t.completed = true';
    } else if (completed === 'false') {
      query += ' AND t.completed = false';
    }
    
    if (due_today === 'true') {
      query += ` AND DATE(t.due_date) = CURRENT_DATE`;
    }
    
    if (overdue === 'true') {
      query += ` AND t.due_date < CURRENT_TIMESTAMP AND t.completed = false`;
    }
    
    query += ' ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get task by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, co.name as company_name, c.first_name, c.last_name, d.name as deal_name
       FROM tasks t
       LEFT JOIN companies co ON t.company_id = co.id
       LEFT JOIN contacts c ON t.contact_id = c.id
       LEFT JOIN deals d ON t.deal_id = d.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Create task
router.post('/', async (req, res) => {
  try {
    const { company_id, contact_id, deal_id, title, description, due_date } = req.body;
    
    const result = await pool.query(
      `INSERT INTO tasks (company_id, contact_id, deal_id, title, description, due_date, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [company_id, contact_id, deal_id, title, description, due_date, req.user?.id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  try {
    const { title, description, due_date, completed } = req.body;
    
    const completedAt = completed ? 'CURRENT_TIMESTAMP' : 'NULL';
    
    const result = await pool.query(
      `UPDATE tasks 
       SET title = $1, description = $2, due_date = $3, 
           completed = $4, completed_at = ${completed ? 'CURRENT_TIMESTAMP' : 'NULL'},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [title, description, due_date, completed, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Complete task
router.patch('/:id/complete', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE tasks 
       SET completed = true, completed_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
