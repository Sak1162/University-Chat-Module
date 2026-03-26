const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/parte/OneDrive/Documents/University chat module/Backend/.env' });

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

db.connect();

console.log("Syncing classrooms from users table...");

db.query("SELECT DISTINCT class_code FROM users WHERE class_code IS NOT NULL", (err, codes) => {
    if (err) throw err;
    
    // Default professor for old classes (Prof. Sharma ID 1)
    const defaultProfId = 1;

    let pending = codes.length;
    if (pending === 0) {
        console.log("No class codes found in users.");
        process.exit();
    }

    codes.forEach(row => {
        const code = row.class_code;
        db.query("SELECT * FROM classrooms WHERE code = ?", [code], (err, exists) => {
            if (exists.length === 0) {
                console.log(`Creating missing classroom: ${code}`);
                db.query("INSERT INTO classrooms (name, code, professor_id) VALUES (?, ?, ?)", 
                    [`Class ${code}`, code, defaultProfId], (err) => {
                        pending--;
                        if (pending === 0) {
                            console.log("Sync complete.");
                            db.end();
                        }
                    }
                );
            } else {
                pending--;
                if (pending === 0) {
                    console.log("No new classes needed.");
                    db.end();
                }
            }
        });
    });
});
