const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all products
router.get('/', async (req, res) => {
  try {
    const { active_only } = req.query;
    let query = 'SELECT * FROM products';
    if (active_only === 'true') {
      query += ' WHERE is_active = true';
    }
    query += ' ORDER BY category, name';
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create product
router.post('/', async (req, res) => {
  try {
    const { name, category, is_active, is_other } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, category, is_active, is_other) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, category, is_active !== false, is_other || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    const { name, category, is_active, is_other } = req.body;
    const result = await pool.query(
      'UPDATE products SET name = $1, category = $2, is_active = $3, is_other = $4 WHERE id = $5 RETURNING *',
      [name, category, is_active, is_other, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
