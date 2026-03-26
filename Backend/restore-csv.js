require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    multipleStatements: true
};

async function readCSV(filePath) {
    const results = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on("data", (data) => results.push(data))
            .on("end", () => resolve(results))
            .on("error", (err) => reject(err));
    });
}

async function restore() {
    const connection = await mysql.createConnection(dbConfig);
    console.log("Connected to Railway MySQL!");

    try {
        console.log("Applying schema from DATABASE.sql (clearing old tables)...");
        const schemaSql = fs.readFileSync(path.join(__dirname, "../DATABASE.sql"), "utf8");
        await connection.query(schemaSql);
        console.log("Schema applied.");

        // 1. Restore Users
        console.log("Restoring Users...");
        const users = await readCSV(path.join(__dirname, "../MySQL_files/userdata.csv"));
        for (const u of users) {
            const values = [u.id, u.prn, u.password, u.full_name, u.role, u.course, u.year, u.class_incharge, u.class_code, u.contact_number, u.email, u.profile_pic, u.created_at].map(v => v === "NULL" || v === "" ? null : v);
            await connection.execute(
                "INSERT INTO users (id, prn, password, full_name, role, course, year, class_incharge, class_code, contact_number, email, profile_pic, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                values
            );
        }
        console.log(`${users.length} users restored.`);

        // 2. Restore Placements
        console.log("Restoring Placements...");
        const placements = await readCSV(path.join(__dirname, "../MySQL_files/placementform.csv"));
        for (const p of placements) {
            const values = [p.id, p.user_id, p.domain, p.cgpa, p.skills, p.resume_link, p.linkedin_link, p.applied_at].map(v => v === "NULL" || v === "" ? null : v);
            await connection.execute(
                "INSERT INTO placements (id, user_id, domain, cgpa, skills, resume_link, linkedin_link, applied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                values
            );
        }
        console.log(`${placements.length} placements restored.`);

        // 3. Restore Messages
        console.log("Restoring Messages...");
        const messages = await readCSV(path.join(__dirname, "../MySQL_files/messagedata.csv"));
        for (const m of messages) {
            const values = [m.id, m.classroom_id, m.sender_id, m.receiver_id, m.message_text, m.message_type, m.sent_at].map(v => v === "NULL" || v === "" ? null : v);
            await connection.execute(
                "INSERT INTO messages (id, classroom_id, sender_id, receiver_id, message_text, message_type, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                values
            );
        }
        console.log(`${messages.length} messages restored.`);

        console.log("\nSUCCESS: All data from CSV files has been restored to Railway.");
    } catch (err) {
        console.error("Restoration failed:", err.message);
    } finally {
        await connection.end();
    }
}

restore();
