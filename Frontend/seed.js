const mysql = require('C:/Users/parte/backend/node_modules/mysql2');
const db = mysql.createConnection({ host: 'localhost', user: 'root', password: 'sak1162', database: 'italk_db' });

const sql1 = 'CREATE TABLE IF NOT EXISTS materials (id INT AUTO_INCREMENT PRIMARY KEY, subject_id INT, title VARCHAR(150), file_url TEXT, uploaded_by INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);';

db.query(sql1, (err) => {
    if (err) console.error(err);
    else {
        console.log('Materials table created');
        db.query('SELECT * FROM users LIMIT 1', (err, users) => {
            if (users && users.length > 0) {
                const uid = users[0].id;
                const sql2 = 'INSERT INTO subjects (user_id, name, semester, grade) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)';
                const vals = [
                    uid, 'Data Structures', 'current', null,
                    uid, 'Operating Systems', 'current', null,
                    uid, 'Computer Networks', 'current', null,
                    uid, 'Software Engineering', 'current', null,
                    uid, 'Database Systems', 'current', null,
                    uid, 'Microprocessors', 'last', 'A',
                    uid, 'Mathematics III', 'last', 'B+'
                ];
                db.query(sql2, vals, (err2) => {
                    console.log(err2 || 'Subjects seeded');
                    process.exit();
                });
            } else {
                console.log('No user found');
                process.exit();
            }
        });
    }
});
