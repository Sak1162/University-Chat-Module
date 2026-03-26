require("dotenv").config();
const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

const sqlFile = path.join(__dirname, "../DATABASE.sql");
const sqlContent = fs.readFileSync(sqlFile, "utf8");

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    multipleStatements: true // Crucial for running multiple SQL commands
});

console.log("Connecting to Railway MySQL...");

db.connect((err) => {
    if (err) {
        console.error("Connection failed:", err.message);
        process.exit(1);
    }
    console.log("Connected Successfully! Importing tables...");

    db.query(sqlContent, (err, results) => {
        if (err) {
            console.error("Import failed:", err.message);
        } else {
            console.log("Migration Successful! All tables created.");
        }
        db.end();
        process.exit();
    });
});
