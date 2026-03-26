const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all interactions
router.get('/', async (req, res) => {
  try {
    const { company_id, contact_id, type } = req.query;
    let query = `
      SELECT i.*, co.name as company_name, c.first_name, c.last_name
      FROM interactions i
      LEFT JOIN companies co ON i.company_id = co.id
      LEFT JOIN contacts c ON i.contact_id = c.id
      WHERE 1=1`;
    const params = [];
    
    if (company_id) {
      params.push(company_id);
      query += ` AND i.company_id = $${params.length}`;
    }
    
    if (contact_id) {
      params.push(contact_id);
      query += ` AND i.contact_id = $${params.length}`;
    }
    
    if (type) {
      params.push(type);
      query += ` AND i.type = $${params.length}`;
    }
    
    query += ' ORDER BY i.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch interactions' });
  }
});

// Get interaction by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, co.name as company_name, c.first_name, c.last_name
       FROM interactions i
       LEFT JOIN companies co ON i.company_id = co.id
       LEFT JOIN contacts c ON i.contact_id = c.id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interaction not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch interaction' });
  }
});

// Create interaction
router.post('/', async (req, res) => {
  try {
    const { company_id, contact_id, type, subject, notes, follow_up_required, follow_up_date } = req.body;
    
    const result = await pool.query(
      `INSERT INTO interactions (company_id, contact_id, type, subject, notes, follow_up_required, follow_up_date, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [company_id, contact_id, type, subject, notes, follow_up_required || false, follow_up_date, req.user?.id]
    );
    
    // If follow-up required, create a task
    if (follow_up_required && follow_up_date) {
      await pool.query(
        `INSERT INTO tasks (company_id, contact_id, title, description, due_date, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [company_id, contact_id, `Follow up: ${subject || type}`, notes, follow_up_date, req.user?.id]
      );
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create interaction' });
  }
});

// Update interaction
router.put('/:id', async (req, res) => {
  try {
    const { type, subject, notes, follow_up_required, follow_up_date } = req.body;
    
    const result = await pool.query(
      `UPDATE interactions 
       SET type = $1, subject = $2, notes = $3, follow_up_required = $4, follow_up_date = $5
       WHERE id = $6
       RETURNING *`,
      [type, subject, notes, follow_up_required, follow_up_date, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interaction not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update interaction' });
  }
});

// Delete interaction
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM interactions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Interaction deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete interaction' });
  }
});

module.exports = router;
