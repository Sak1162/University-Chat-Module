const mysql = require('C:/Users/parte/backend/node_modules/mysql2');
const bcrypt = require('C:/Users/parte/backend/node_modules/bcrypt');
const db = mysql.createConnection({ host: 'localhost', user: 'root', password: 'sak1162', database: 'italk_db' });

const run = async () => {
    try {
        const hash = await bcrypt.hash('password123', 10);

        // Add 15 users
        for (let i = 1; i <= 15; i++) {
            const role = i <= 3 ? 'professor' : 'student';
            const name = role === 'professor' ? `Prof. User ${i}` : `Student User ${i}`;
            const prn = `user${i}`;
            const class_code = role === 'student' ? 'CS-101' : null;

            // ignore duplicates
            await db.promise().query(
                "INSERT INTO users (full_name, prn, password, role, class_code) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=id",
                [name, prn, hash, role, class_code]
            ).catch(e => console.log(e));
        }

        // Add 15 dummy chats between User 4 (A student) and others
        const [users] = await db.promise().query("SELECT id FROM users LIMIT 15");
        if (users.length > 5) {
            const mainUser = users[4].id; // The main test student

            for (let i = 0; i < 15; i++) {
                if (i === 4) continue; // Don't chat with self
                const other = users[i].id;

                // Add a message from other to main
                await db.promise().query(
                    "INSERT INTO messages (sender_id, receiver_id, message_text, message_type) VALUES (?, ?, ?, 'private')",
                    [other, mainUser, `Hello! This is an automated test message from user ${other}`]
                );
            }
        }

        console.log("Seeded 15 users and chats successfully. Credentials for all are PRN: 'user1' to 'user15', Password: 'password123'");
        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
