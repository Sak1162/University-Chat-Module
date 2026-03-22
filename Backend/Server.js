const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// MySQL connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "sak1162",
    database: "italk_db",
    port: 3306
});

db.connect((err) => {
    if (err) console.log("Database connection failed:", err);
    else console.log("MySQL Connected to italk_db");
});

// --- Auth APIs ---
app.post("/signup", async (req, res) => {
    const { prn, password, full_name, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query("INSERT INTO users (prn, password, full_name, role) VALUES (?, ?, ?, ?)", [prn, hashedPassword, full_name, role], (err) => {
            if (err) return res.status(500).json({ message: "Signup failed" });
            res.json({ message: "Signup successful" });
        });
    } catch (e) { res.status(500).json({ message: "Server error" }); }
});

app.post("/login", (req, res) => {
    const { prn, password } = req.body;
    db.query("SELECT * FROM users WHERE prn=?", [prn], async (err, result) => {
        if (err || result.length === 0) return res.status(401).json({ message: "Invalid user" });
        const user = result[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) res.json({ message: "Success", user: { id: user.id, name: user.full_name, role: user.role, class_code: user.class_code } });
        else res.status(401).json({ message: "Invalid password" });
    });
});

// --- Chat & Joining APIs ---
app.post("/join-class", (req, res) => {
    const { userId, classCode } = req.body;
    db.query("SELECT * FROM classrooms WHERE code = ?", [classCode], (err, result) => {
        if (result.length > 0) {
            db.query("UPDATE users SET class_code = ? WHERE id = ?", [classCode, userId], () => res.json({ message: "Joined!", classroom: result[0] }));
        } else {
            db.query("INSERT INTO classrooms (name, code) VALUES (?, ?)", [`Class ${classCode}`, classCode], (err, res2) => {
                db.query("UPDATE users SET class_code = ? WHERE id = ?", [classCode, userId], () => res.json({ message: "Created and Joined!", classroom: { id: res2.insertId, name: `Class ${classCode}`, code: classCode } }));
            });
        }
    });
});

app.get("/chats/:userId", (req, res) => {
    const userId = req.params.userId;
    db.query("SELECT c.*, 'group' as type FROM classrooms c JOIN users u ON u.id = ? AND u.class_code = c.code", [userId], (err, classes) => {
        const dmSql = `
            SELECT u.id, u.full_name as name, u.role as type, MAX(m.sent_at) as last_activity 
            FROM users u 
            LEFT JOIN messages m ON (m.sender_id = u.id AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = u.id) 
            WHERE u.id != ? 
            GROUP BY u.id 
            ORDER BY last_activity IS NULL, last_activity DESC 
            LIMIT 15
        `;
        db.query(dmSql, [userId, userId, userId], (err, dms) => res.json([{ id: 0, name: "Global Hub", type: "global", icon: "globe" }, ...(classes || []), ...(dms || [])]));
    });
});

app.get("/messages/:chatId", (req, res) => {
    const chatId = parseInt(req.params.chatId);
    const { userId, type } = req.query;
    let sql, params;
    if (type === 'global' || chatId === 0) {
        sql = "SELECT * FROM messages WHERE classroom_id IS NULL AND receiver_id IS NULL ORDER BY sent_at ASC";
        params = [];
    } else if (type === 'group') {
        sql = "SELECT * FROM messages WHERE classroom_id = ? ORDER BY sent_at ASC";
        params = [chatId];
    } else {
        sql = "SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY sent_at ASC";
        params = [userId, chatId, chatId, userId];
    }
    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ message: "Error fetch" });
        res.json(result || []);
    });
});

// --- Academic & Placement APIs (NEW) ---

app.get("/subjects/:userId", (req, res) => {
    db.query("SELECT * FROM subjects WHERE user_id = ?", [req.params.userId], (err, result) => {
        if (err) return res.status(500).json({ message: "Error fetching subjects" });
        res.json(result);
    });
});

app.get("/professor/classes/:profId", (req, res) => {
    db.query("SELECT * FROM classrooms WHERE professor_id = ?", [req.params.profId], (err, result) => {
        if (err) return res.status(500).json({ message: "Error fetching professor classes" });
        res.json(result);
    });
});

app.post("/placement-apply", (req, res) => {
    const { userId, domain, cgpa, skills, resumeLink, linkedinLink } = req.body;
    const sql = "INSERT INTO placements (user_id, domain, cgpa, skills, resume_link, linkedin_link) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(sql, [userId, domain, cgpa, skills, resumeLink, linkedinLink], (err) => {
        if (err) return res.status(500).json({ message: "Application failed" });
        res.json({ message: "Placement application submitted successfully!" });
    });
});

app.get("/placements", (req, res) => {
    const sql = "SELECT p.*, u.full_name as name, u.prn, u.class_code FROM placements p JOIN users u ON p.user_id = u.id ORDER BY p.applied_at DESC";
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json({ message: "Error fetching placements" });
        res.json(result);
    });
});

app.get("/materials/:subjectId", (req, res) => {
    db.query("SELECT * FROM materials WHERE subject_id = ? ORDER BY created_at DESC", [req.params.subjectId], (err, result) => {
        if (err) return res.status(500).json({ message: "Error fetching materials" });
        res.json(result);
    });
});

app.post("/materials", (req, res) => {
    const { subjectId, title, fileUrl, uploadedBy } = req.body;
    db.query("INSERT INTO materials (subject_id, title, file_url, uploaded_by) VALUES (?, ?, ?, ?)", [subjectId, title, fileUrl, uploadedBy], (err) => {
        if (err) return res.status(500).json({ message: "Error uploading material" });
        res.json({ message: "Material uploaded successfully!" });
    });
});

app.delete("/materials/:id", (req, res) => {
    db.query("DELETE FROM materials WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ message: "Error deleting material" });
        res.json({ message: "Material deleted" });
    });
});

// --- Sockets ---
io.on("connection", (socket) => {
    socket.on("join-room", (room) => socket.join(room));
    socket.on("send-message", (data) => {
        const { classroom_id, sender_id, receiver_id, message_text, message_type } = data;
        db.query("INSERT INTO messages (classroom_id, sender_id, receiver_id, message_text, message_type) VALUES (?, ?, ?, ?, ?)", [classroom_id, sender_id, receiver_id, message_text, message_type], (err, res) => {
            const target = classroom_id ? `class_${classroom_id}` : `user_${receiver_id}`;
            io.to(target).emit("receive-message", { ...data, id: res.insertId, sent_at: new Date() });
            socket.emit("receive-message", { ...data, id: res.insertId, sent_at: new Date() });
        });
    });
    socket.on("broadcast", (data) => {
        const { sender_id, classroom_id, message_text } = data;
        db.query("INSERT INTO messages (classroom_id, sender_id, message_text, message_type) VALUES (?, ?, NULL, ?, 'broadcast')", [classroom_id, sender_id, message_text], (err, res) => {
            io.to(`class_${classroom_id}`).emit("receive-message", { ...data, id: res.insertId, sent_at: new Date(), message_type: 'broadcast' });
        });
    });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`ITALK Server on ${PORT}`));