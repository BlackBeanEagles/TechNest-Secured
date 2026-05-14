// Automated database setup script
// Run with: node setup-database.js <mysql_password>
// Example:  node setup-database.js root1234

// Use mysql2 from backend's node_modules
const mysql = require('./backend/node_modules/mysql2/promise');
const fs    = require('fs');
const path  = require('path');

const password = process.argv[2] || '';
const host     = process.argv[3] || 'localhost';

async function setup() {
    console.log('\n🔧 TechNest Database Setup\n');

    let conn;
    try {
        console.log('1️⃣  Connecting to MySQL...');
        conn = await mysql.createConnection({
            host,
            port:     3306,
            user:     'root',
            password,
            multipleStatements: true   // needed for running SQL files
        });
        console.log('   ✅ Connected as root\n');

        // Run schema
        console.log('2️⃣  Creating database & tables...');
        const schema = fs.readFileSync(
            path.join(__dirname, 'database/schema.sql'), 'utf8'
        );
        await conn.query(schema);
        console.log('   ✅ Schema applied\n');

        // Run seed
        console.log('3️⃣  Inserting seed data (products, demo users)...');
        const seed = fs.readFileSync(
            path.join(__dirname, 'database/seed.sql'), 'utf8'
        );
        // Ignore duplicate entry errors (re-running setup)
        try {
            await conn.query(seed);
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') {
                console.log('   ℹ️  Seed data already exists — skipping duplicates');
            } else throw e;
        }
        console.log('   ✅ Seed data inserted\n');

        // Verify
        console.log('4️⃣  Verifying setup...');
        const [users]    = await conn.query('SELECT COUNT(*) as n FROM technest_shop.users');
        const [products] = await conn.query('SELECT COUNT(*) as n FROM technest_shop.products');
        console.log(`   ✅ Users: ${users[0].n} | Products: ${products[0].n}\n`);

        // Write DB password to .env
        console.log('5️⃣  Updating .env file...');
        const envPath = path.join(__dirname, 'backend/.env');
        let env = fs.readFileSync(envPath, 'utf8');
        env = env.replace(/DB_PASSWORD=.*/, `DB_PASSWORD=${password}`);
        fs.writeFileSync(envPath, env);
        console.log('   ✅ .env updated with your MySQL password\n');

        console.log('═══════════════════════════════════════════════');
        console.log('  ✅ DATABASE SETUP COMPLETE!');
        console.log('');
        console.log('  Now start the server:');
        console.log('  cd backend && npm run dev');
        console.log('');
        console.log('  Then open: http://localhost:5000');
        console.log('');
        console.log('  Admin  →  admin   /  Admin@1234');
        console.log('  User   →  johndoe /  User@1234');
        console.log('═══════════════════════════════════════════════\n');

    } catch (err) {
        console.error('\n❌ Setup failed:', err.message);

        if (err.code === 'ECONNREFUSED') {
            console.error('\n  MySQL Server is not running!');
            console.error('  Make sure MySQL Server is installed and started.\n');
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\n  Wrong password!');
            console.error('  Usage: node setup-database.js <your_mysql_root_password>\n');
        }
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

setup();
