const pg = require('pg');

const client = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'code_companion',
  user: 'postgres',
  password: 'postgres',
});

async function fixPermissions() {
  try {
    await client.connect();
    console.log('Connected to database...');

    const queries = [
      'GRANT ALL PRIVILEGES ON SCHEMA public TO code_user;',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO code_user;',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO code_user;',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO code_user;',
    ];

    for (const query of queries) {
      try {
        await client.query(query);
        console.log('✓ ' + query);
      } catch (err) {
        console.log('⚠ ' + query);
        console.log('  Error: ' + err.message);
      }
    }

    console.log('\nPermissions fixed! Now run:');
    console.log('$env:DATABASE_URL="postgresql://code_user:secure123@localhost:5432/code_companion"');
    console.log('pnpm --filter @workspace/db run push');

    await client.end();
  } catch (err) {
    console.error('Connection failed:', err.message);
    console.error('\nMake sure PostgreSQL is running with postgres user password set to "postgres"');
    process.exit(1);
  }
}

fixPermissions();
