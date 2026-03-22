const mysql = require('C:/Users/parte/backend/node_modules/mysql2');
const db = mysql.createConnection({ host: 'localhost', user: 'root', password: 'sak1162', database: 'italk_db' });

const sql1 = `
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT DEFAULT NULL,
    sender_id INT NOT NULL,
    receiver_id INT DEFAULT NULL,
    message_text TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'private',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const setupDummyData = async () => {
    try {
        await db.promise().query(sql1);

        // Ensure dummy users exist
        const [users] = await db.promise().query("SELECT id FROM users LIMIT 1");
        if (users.length === 0) {
            console.log("No base user found. Seed users first via signup.");
            process.exit();
        }
        const currentUserId = users[0].id;

        // Add dummy professors and students
        const insertUser = "INSERT INTO users (full_name, prn, password, role) VALUES (?, ?, 'dummy', ?)";
        await db.promise().query(insertUser, ["Prof. Sharma", "prof_sharma", "professor"]).catch(() => { });
        await db.promise().query(insertUser, ["Student Council", "council_1", "student"]).catch(() => { });

        const [profRows] = await db.promise().query("SELECT id FROM users WHERE full_name='Prof. Sharma' LIMIT 1");
        const profId = profRows.length ? profRows[0].id : 2;

        const [councilRows] = await db.promise().query("SELECT id FROM users WHERE full_name='Student Council' LIMIT 1");
        const councilId = councilRows.length ? councilRows[0].id : 3;

        const msgInsert = "INSERT INTO messages (sender_id, receiver_id, classroom_id, message_text, message_type) VALUES (?, ?, ?, ?, ?)";

        // 1 private DM with Prof Sharma
        await db.promise().query(msgInsert, [profId, currentUserId, null, "Don't forget the assignment.", "private"]);
        await db.promise().query(msgInsert, [currentUserId, profId, null, "Yes Professor, I will submit it today.", "private"]);

        // 1 private DM with Student Council
        await db.promise().query(msgInsert, [councilId, currentUserId, null, "Are we meeting tomorrow?", "private"]);

        // Global Broadcast message (classroom_id = null, receiver = null)
        await db.promise().query(msgInsert, [profId, null, null, "Exam schedule released.", "broadcast"]);

        console.log("Dummy messages and chats seeded successfully.");
        process.exit();
    } catch (e) {
        console.error(e);
        process.exit();
    }
};

setupDummyData();
