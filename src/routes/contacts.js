const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all contacts
router.get('/', async (req, res) => {
  try {
    const { company_id, search } = req.query;
    let query = `
      SELECT c.*, co.name as company_name 
      FROM contacts c 
      LEFT JOIN companies co ON c.company_id = co.id 
      WHERE 1=1`;
    const params = [];
    
    if (company_id) {
      params.push(company_id);
      query += ` AND c.company_id = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.email ILIKE $${params.length})`;
    }
    
    query += ' ORDER BY c.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Get contact by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT c.*, co.name as company_name FROM contacts c LEFT JOIN companies co ON c.company_id = co.id WHERE c.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// Create contact
router.post('/', async (req, res) => {
  try {
    const { company_id, first_name, last_name, position, cell_phone, email, is_primary } = req.body;
    
    // If this is primary, unset other primaries for this company
    if (is_primary) {
      await pool.query('UPDATE contacts SET is_primary = false WHERE company_id = $1', [company_id]);
    }
    
    const result = await pool.query(
      `INSERT INTO contacts (company_id, first_name, last_name, position, cell_phone, email, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [company_id, first_name, last_name, position, cell_phone, email, is_primary]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// Update contact
router.put('/:id', async (req, res) => {
  try {
    const { company_id, first_name, last_name, position, cell_phone, email, is_primary } = req.body;
    
    if (is_primary) {
      await pool.query('UPDATE contacts SET is_primary = false WHERE company_id = $1 AND id != $2', 
        [company_id, req.params.id]);
    }
    
    const result = await pool.query(
      `UPDATE contacts 
       SET company_id = $1, first_name = $2, last_name = $3, position = $4, 
           cell_phone = $5, email = $6, is_primary = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [company_id, first_name, last_name, position, cell_phone, email, is_primary, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Delete contact
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Contact deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router;
