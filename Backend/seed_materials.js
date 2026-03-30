require("dotenv").config();
const mysql = require("mysql2");

const db = mysql.createConnection({
    host: process.env.DB_HOST || "caboose.proxy.rlwy.net",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "sak1162",
    database: process.env.DB_NAME || "railway",
    port: process.env.DB_PORT || 40025
});

db.connect((err) => {
    if (err) {
        console.error("Connection failed:", err.message);
        process.exit(1);
    }
    console.log("Connected to database.");

    // 1. Ensure Professor exists (ID 1)
    db.query("SELECT * FROM users WHERE id = 1", (err, users) => {
        if (err || users.length === 0) {
            console.warn("WARNING: Professor with ID 1 not found. Using the first professor available.");
            db.query("SELECT id FROM users WHERE role = 'professor' LIMIT 1", (err, proms) => {
                const profId = (proms && proms.length > 0) ? proms[0].id : 1; 
                seedData(profId);
            });
        } else {
            seedData(1);
        }
    });
});

function seedData(profId) {
    console.log(`Seeding data for Professor ID: ${profId}`);

    // Delete existing study materials if any for "Data Structures" to avoid duplicates
    // But since the table is empty based on my check, I'll just skip delete and try insert.

    const subjects = [
        { id: 1, name: 'Data Structures' },
        { id: 2, name: 'Operating Systems' },
        { id: 3, name: 'Computer Networks' },
        { id: 4, name: 'Software Engineering' },
        { id: 5, name: 'Database Systems' }
    ];

    const insertSubjects = subjects.map(s => {
        return new Promise((resolve) => {
            db.query("INSERT IGNORE INTO subjects (id, user_id, name) VALUES (?, ?, ?)", [s.id, profId, s.name], (err) => {
                if (err) console.error(`Error inserting subject ${s.name}:`, err.message);
                else console.log(`Subject ${s.name} ensured (ID: ${s.id})`);
                resolve();
            });
        });
    });

    Promise.all(insertSubjects).then(() => {
        const materials = [
            { subject_id: 1, title: 'Data Structure Lab Scale (PDF)', file_url: '/materials/labscale (1).pdf', uploaded_by: profId },
            { subject_id: 1, title: 'Data Structure Lab Scale (DOCX)', file_url: '/materials/labscale (1).docx', uploaded_by: profId }
        ];

        const insertMaterials = materials.map(m => {
            return new Promise((resolve) => {
                db.query("INSERT INTO materials (subject_id, title, file_url, uploaded_by) VALUES (?, ?, ?, ?)", [m.subject_id, m.title, m.file_url, m.uploaded_by], (err) => {
                    if (err) console.error(`Error inserting material ${m.title}:`, err.message);
                    else console.log(`Material ${m.title} inserted.`);
                    resolve();
                });
            });
        });

        Promise.all(insertMaterials).then(() => {
            console.log("Seeding complete!");
            db.end();
        });
    });
}
