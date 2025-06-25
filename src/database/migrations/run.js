const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Only load .env in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  console.log('📊 Environment:', process.env.NODE_ENV);
  console.log('🔗 Database URL exists:', !!process.env.DATABASE_URL);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Check if migrations were already run by checking if users table exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (checkResult.rows[0].exists) {
      console.log('✅ Database already migrated - skipping migrations');
      return;
    }

    // Get all migration files
    const migrationsDir = __dirname;
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      
      const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await pool.query(migrationSQL);
      
      console.log(`✅ Completed migration: ${file}`);
    }

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations; 