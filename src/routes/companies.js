const express = require('express');
const router = express.Router();
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');

// Get all companies
router.get('/', async (req, res) => {
  try {
    const { metro, status, search } = req.query;
    let query = 'SELECT * FROM companies WHERE 1=1';
    const params = [];
    
    if (metro) {
      params.push(metro);
      query += ` AND metro_area = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR address ILIKE $${params.length})`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get company by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM companies WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Create company
router.post('/', async (req, res) => {
  try {
    const {
      name, type, address, city, state, zip, metro_area,
      phone, website, notes, latitude, longitude
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO companies (name, type, address, city, state, zip, metro_area, phone, website, notes, latitude, longitude, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [name, type, address, city, state, zip, metro_area, phone, website, notes, latitude, longitude, req.user?.id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Update company
router.put('/:id', async (req, res) => {
  try {
    const {
      name, type, address, city, state, zip, metro_area,
      phone, website, notes, latitude, longitude, last_visited
    } = req.body;
    
    const result = await pool.query(
      `UPDATE companies 
       SET name = $1, type = $2, address = $3, city = $4, state = $5, zip = $6,
           metro_area = $7, phone = $8, website = $9, notes = $10,
           latitude = $11, longitude = $12, last_visited = $13, updated_at = CURRENT_TIMESTAMP
       WHERE id = $14
       RETURNING *`,
      [name, type, address, city, state, zip, metro_area, phone, website, notes, 
       latitude, longitude, last_visited, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
    res.json({ message: 'Company deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

module.exports = router;
