const mysql = require('mysql2');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: 'c:/Users/parte/OneDrive/Documents/University chat module/Backend/.env' });

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

db.connect();

const status = {};

db.query("SELECT id, full_name, role, class_code FROM users", (err, users) => {
    if (err) {
        console.error("Users query error:", err);
        db.end();
        return;
    }
    status.users = users;
    db.query("SELECT * FROM classrooms", (err, classrooms) => {
        if (err) {
            console.error("Classrooms query error:", err);
            db.end();
            return;
        }
        status.classrooms = classrooms;
        db.query("SELECT COUNT(*) as count, message_type, classroom_id FROM messages GROUP BY message_type, classroom_id", (err, msgs) => {
            if (err) {
                console.error("Messages query error:", err);
                db.end();
                return;
            }
            status.messages_summary = msgs;
            fs.writeFileSync('db_status.json', JSON.stringify(status, null, 2));
            console.log("Status written to db_status.json");
            db.end();
        });
    });
});
