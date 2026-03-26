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
const targetPRN = '1234567890';

db.query("SELECT id, full_name, role, class_code, prn FROM users WHERE prn = ?", [targetPRN], (err, users) => {
    status.target_user = users[0];
    db.query("SELECT * FROM classrooms", (err, classrooms) => {
        status.classrooms = classrooms;
        if (status.target_user && status.target_user.class_code) {
             db.query("SELECT * FROM classrooms WHERE code = ?", [status.target_user.class_code], (err, targetClass) => {
                 status.target_class = targetClass;
                 finish();
             });
        } else {
            finish();
        }
    });
});

function finish() {
    fs.writeFileSync('db_target_check.json', JSON.stringify(status, null, 2));
    console.log("Status written to db_target_check.json");
    db.end();
}
