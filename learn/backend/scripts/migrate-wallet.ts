
import fs from 'fs';
import path from 'path';
import pool from '../src/config/db.js';

async function migrate() {
    try {
        const sqlPath = path.join(process.cwd(), 'sql', 'wallet.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon to run multiple statements
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

        console.log(`Found ${statements.length} statements to execute.`);

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            for (const stmt of statements) {
                if (stmt.trim()) {
                    await connection.query(stmt);
                    console.log('Executed statement successfully.');
                }
            }

            await connection.commit();
            console.log('Migration completed successfully.');
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
