const pool = require('./index');

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query(`
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Companies table
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        type TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        metro_area TEXT,
        metro_radius INTEGER DEFAULT 50,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        phone TEXT,
        website TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_visited TIMESTAMP,
        user_id UUID REFERENCES users(id)
      );
      
      -- Contacts table
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        first_name TEXT,
        last_name TEXT,
        position TEXT,
        cell_phone TEXT,
        email TEXT,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Products table
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        category TEXT,
        is_active BOOLEAN DEFAULT true,
        is_other BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Deals table
      CREATE TABLE IF NOT EXISTS deals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        value DECIMAL(12, 2) DEFAULT 0,
        stage TEXT DEFAULT 'prospect',
        status TEXT DEFAULT 'active',
        probability INTEGER DEFAULT 0,
        expected_close DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP,
        user_id UUID REFERENCES users(id)
      );
      
      -- Deal products (junction table)
      CREATE TABLE IF NOT EXISTS deal_products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        product_other_text TEXT,
        quantity INTEGER DEFAULT 1,
        unit_price DECIMAL(10, 2) DEFAULT 0,
        total_price DECIMAL(12, 2) DEFAULT 0
      );
      
      -- Interactions table
      CREATE TABLE IF NOT EXISTS interactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
        type TEXT NOT NULL,
        subject TEXT,
        notes TEXT,
        follow_up_required BOOLEAN DEFAULT false,
        follow_up_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id UUID REFERENCES users(id)
      );
      
      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
        deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        due_date TIMESTAMP,
        completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id UUID REFERENCES users(id)
      );
      
      -- Business cards table
      CREATE TABLE IF NOT EXISTS business_cards (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
        image_url TEXT,
        raw_text TEXT,
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id UUID REFERENCES users(id)
      );
      
      -- Sync queue for offline support
      CREATE TABLE IF NOT EXISTS sync_queue (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        table_name TEXT NOT NULL,
        record_id UUID NOT NULL,
        action TEXT NOT NULL,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        synced_at TIMESTAMP
      );
      
      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
      CREATE INDEX IF NOT EXISTS idx_companies_metro ON companies(metro_area);
      CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
      CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
      CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
      CREATE INDEX IF NOT EXISTS idx_interactions_company ON interactions(company_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
      
      -- Insert default products
      INSERT INTO products (name, category, is_active, is_other) VALUES
        ('Single-Family Windows', 'windows', true, false),
        ('Multi-Family Windows', 'windows', true, false),
        ('Luxury Windows', 'windows', true, false),
        ('Door Parts', 'door_parts', true, false),
        ('Doors', 'doors', true, false),
        ('Door Hardware', 'hardware', true, false),
        ('Closets/Shelving', 'closets', true, false),
        ('Residential Doors', 'doors', true, false),
        ('Commercial Doors', 'doors', true, false),
        ('Other', 'other', true, true)
      ON CONFLICT DO NOTHING;
      
      SELECT 'Migration completed successfully' AS result;
    `);
    
    console.log('Database migrated successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

migrate();
