const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all deals
router.get('/', async (req, res) => {
  try {
    const { company_id, stage, status, product_id, min_value, max_value } = req.query;
    let query = `
      SELECT d.*, co.name as company_name,
        array_agg(json_build_object('id', p.id, 'name', p.name, 'quantity', dp.quantity)) as products
      FROM deals d
      LEFT JOIN companies co ON d.company_id = co.id
      LEFT JOIN deal_products dp ON d.id = dp.deal_id
      LEFT JOIN products p ON dp.product_id = p.id
      WHERE 1=1`;
    const params = [];
    
    if (company_id) {
      params.push(company_id);
      query += ` AND d.company_id = $${params.length}`;
    }
    
    if (stage) {
      params.push(stage);
      query += ` AND d.stage = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND d.status = $${params.length}`;
    }
    
    if (min_value) {
      params.push(min_value);
      query += ` AND d.value >= $${params.length}`;
    }
    
    if (max_value) {
      params.push(max_value);
      query += ` AND d.value <= $${params.length}`;
    }
    
    query += ' GROUP BY d.id ORDER BY d.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// Get deal by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, co.name as company_name 
       FROM deals d 
       LEFT JOIN companies co ON d.company_id = co.id 
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    // Get products for this deal
    const products = await pool.query(
      `SELECT dp.*, p.name as product_name 
       FROM deal_products dp 
       LEFT JOIN products p ON dp.product_id = p.id 
       WHERE dp.deal_id = $1`,
      [req.params.id]
    );
    
    const deal = result.rows[0];
    deal.products = products.rows;
    res.json(deal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

// Create deal
router.post('/', async (req, res) => {
  try {
    const { company_id, name, value, stage, status, probability, expected_close, notes, products } = req.body;
    
    const result = await pool.query(
      `INSERT INTO deals (company_id, name, value, stage, status, probability, expected_close, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [company_id, name, value || 0, stage || 'prospect', status || 'active', probability || 0, expected_close, notes, req.user?.id]
    );
    
    const deal = result.rows[0];
    
    // Add products if provided
    if (products && products.length > 0) {
      for (const p of products) {
        await pool.query(
          `INSERT INTO deal_products (deal_id, product_id, product_other_text, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [deal.id, p.product_id, p.product_other_text, p.quantity || 1, p.unit_price || 0, p.total_price || 0]
        );
      }
    }
    
    res.status(201).json(deal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// Update deal
router.put('/:id', async (req, res) => {
  try {
    const { name, value, stage, status, probability, expected_close, notes, closed_at } = req.body;
    
    const result = await pool.query(
      `UPDATE deals 
       SET name = $1, value = $2, stage = $3, status = $4, probability = $5,
           expected_close = $6, notes = $7, closed_at = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [name, value, stage, status, probability, expected_close, notes, closed_at, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

// Update deal products
router.put('/:id/products', async (req, res) => {
  try {
    const { products } = req.body;
    
    // Delete existing products
    await pool.query('DELETE FROM deal_products WHERE deal_id = $1', [req.params.id]);
    
    // Add new products
    if (products && products.length > 0) {
      for (const p of products) {
        await pool.query(
          `INSERT INTO deal_products (deal_id, product_id, product_other_text, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.params.id, p.product_id, p.product_other_text, p.quantity || 1, p.unit_price || 0, p.total_price || 0]
        );
      }
    }
    
    res.json({ message: 'Products updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update products' });
  }
});

// Delete deal
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM deals WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deal deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

module.exports = router;
