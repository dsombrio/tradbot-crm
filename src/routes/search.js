const express = require('express');
const router = express.Router();
const pool = require('../db');

// Search across companies, contacts, and deals
router.get('/', async (req, res) => {
  try {
    const { q, type } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ companies: [], contacts: [], deals: [] });
    }
    
    const searchTerm = `%${q}%`;
    const results = {};
    
    // Search companies
    if (!type || type === 'companies') {
      const companies = await pool.query(
        `SELECT id, name, type, city, metro_area, phone, 'company' as result_type
         FROM companies 
         WHERE name ILIKE $1 OR address ILIKE $1 OR city ILIKE $1
         ORDER BY name LIMIT 20`,
        [searchTerm]
      );
      results.companies = companies.rows;
    }
    
    // Search contacts
    if (!type || type === 'contacts') {
      const contacts = await pool.query(
        `SELECT c.id, c.first_name, c.last_name, c.position, c.email, c.cell_phone, co.name as company_name, 'contact' as result_type
         FROM contacts c
         LEFT JOIN companies co ON c.company_id = co.id
         WHERE c.first_name ILIKE $1 OR c.last_name ILIKE $1 OR c.email ILIKE $1 OR co.name ILIKE $1
         ORDER BY c.last_name, c.first_name LIMIT 20`,
        [searchTerm]
      );
      results.contacts = contacts.rows;
    }
    
    // Search deals
    if (!type || type === 'deals') {
      const deals = await pool.query(
        `SELECT d.id, d.name, d.value, d.stage, d.status, co.name as company_name, 'deal' as result_type
         FROM deals d
         LEFT JOIN companies co ON d.company_id = co.id
         WHERE d.name ILIKE $1 OR co.name ILIKE $1
         ORDER BY d.value DESC LIMIT 20`,
        [searchTerm]
      );
      results.deals = deals.rows;
    }
    
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
