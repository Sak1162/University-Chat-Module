require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, "../Frontend")));

// Serve index.html for the root route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../Frontend/index.html"));
});

// MySQL connection pool
const db = mysql.createPool({
    host: process.env.DB_HOST || "caboose.proxy.rlwy.net",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "sak1162", // User: Change this to the password from your Railway Connect tab!
    database: process.env.DB_NAME || "railway",
    port: process.env.DB_PORT || 40025,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection and tables
db.getConnection((err, connection) => {
    if (err) {
        console.error("CRITICAL: Database connection failed:", err.message);
    } else {
        console.log("MySQL Connected to italk_db via Pool");
        connection.query("SHOW TABLES LIKE 'users'", (err, results) => {
            if (err) console.error("Error checking tables:", err.message);
            else if (results.length === 0) {
                console.warn("WARNING: 'users' table not found! Please run DATABASE.sql on your database.");
            } else {
                console.log("Database table 'users' verified.");
            }
            connection.release();
        });
    }
});

// --- Auth APIs ---
app.post("/signup", async (req, res) => {
    const { prn, password, full_name, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query("INSERT INTO users (prn, password, full_name, role) VALUES (?, ?, ?, ?)", [prn, hashedPassword, full_name, role], (err) => {
            if (err) {
                console.error("Signup Database Error:", err.message, "| Code:", err.code);
                return res.status(500).json({ message: `Signup failed: ${err.message || 'Unknown Error'}` });
            }
            res.json({ message: "Signup successful" });
        });
    } catch (e) {
        console.error("Signup Server Error:", e);
        res.status(500).json({ message: "Server error during encryption" });
    }
});

app.post("/login", (req, res) => {
    const { prn, password } = req.body;
    db.query("SELECT * FROM users WHERE prn=?", [prn], async (err, result) => {
        if (err) {
            console.error("Login Database Error:", err.message, "| Code:", err.code);
            return res.status(500).json({ message: "Database error during login: " + err.message });
        }
        if (result.length === 0) return res.status(401).json({ message: "Invalid user: Account does not exist" });

        const user = result[0];
        try {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) res.json({ message: "Success", user: { id: user.id, name: user.full_name, role: user.role, class_code: user.class_code } });
            else res.status(401).json({ message: "Invalid password" });
        } catch (e) {
            console.error("Login Bcrypt Error:", e);
            res.status(500).json({ message: "Server error during auth" });
        }
    });
});

// --- Chat & Joining APIs ---
app.post("/create-class", (req, res) => {
    const { professorId, name } = req.body;
    // Generate a unique 6-digit code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    db.query("INSERT INTO classrooms (name, code, professor_id) VALUES (?, ?, ?)", [name, code, professorId], (err, result) => {
        if (err) {
            console.error("Create Class Error:", err.message);
            return res.status(500).json({ message: "Failed to create class" });
        }
        res.json({ message: "Class created!", classId: result.insertId, code: code });
    });
});

app.post("/join-class", (req, res) => {
    const { userId, classCode } = req.body;
    const normalizedInput = (classCode || "").trim().toUpperCase();
    console.log(`Join request: User ${userId} joining with input ${normalizedInput}`);
    db.query("SELECT * FROM classrooms WHERE UPPER(code) = ? OR UPPER(name) = ?", [normalizedInput, normalizedInput], (err, result) => {
        if (result && result.length > 0) {
            const classroom = result[0];
            db.query("UPDATE users SET class_code = ? WHERE id = ?", [classroom.code, userId], (err) => {
                if (err) console.error("Join update error:", err);
                console.log(`User ${userId} successfully updated with class_code ${classroom.code}`);
                res.json({ message: "Joined!", classroom: classroom });
            });
        } else {
            console.warn(`Class code ${normalizedCode} not found`);
            res.status(404).json({ message: "Invalid class code" });
        }
    });
});

app.get("/chats/:userId", (req, res) => {
    const userId = req.params.userId;
    console.log(`Fetching chats for user: ${userId}`);
    db.query("SELECT * FROM users WHERE id = CAST(? AS UNSIGNED)", [userId], (err, userResult) => {
        if (err || !userResult || userResult.length === 0) {
            console.error(`Chat list fetch failed: User ${userId} not found in DB`, err);
            return res.status(404).json({ message: "User not found" });
        }
        const user = userResult[0];
        const normalizedCode = (user.class_code || "").trim().toUpperCase();
        console.log(`User ${userId} role: ${user.role}, normalized class_code: ${normalizedCode}`);

        const results = [{ id: 0, name: "Global Hub", type: "global", icon: "globe" }];

        // 1. Get Classrooms (for Professors)
        const getClasses = new Promise((resolve) => {
            if (user.role === 'professor') {
                db.query("SELECT id, name, code, 'group' as type FROM classrooms WHERE professor_id = CAST(? AS UNSIGNED)", [userId], (err, classes) => {
                    if (err) console.error("Classes query error:", err);
                    resolve(classes || []);
                });
            } else {
                resolve([]);
            }
        });

        // 2. Get Professor Link (for Students)
        const getProfLink = new Promise((resolve) => {
            if (user.role === 'student' && normalizedCode) {
                db.query(`
                    SELECT c.id as class_id, c.name as class_name, u.id as professor_id, u.full_name as name 
                    FROM classrooms c 
                    JOIN users u ON c.professor_id = u.id 
                    WHERE UPPER(c.code) = ?
                `, [normalizedCode], (err, profResult) => {
                    if (profResult && profResult.length > 0) {
                        const prof = profResult[0];
                        resolve([{ 
                            id: prof.professor_id, 
                            name: `${prof.name} (${prof.class_name})`, 
                            type: 'private', 
                            classroom_id: prof.class_id,
                            icon: 'user-tie',
                            profile_pic: prof.profile_pic
                        }]);
                    } else {
                        resolve([]);
                    }
                });
            } else {
                resolve([]);
            }
        });

        // 3. Get Historical Private Chats
        const getHistorical = new Promise((resolve) => {
            const sql = `
                SELECT DISTINCT u.id, u.full_name as name, u.role, 'private' as type, u.profile_pic
                FROM messages m
                JOIN users u ON (m.sender_id = u.id OR m.receiver_id = u.id)
                WHERE (m.sender_id = ? OR m.receiver_id = ?) 
                AND u.id != CAST(? AS UNSIGNED)
                AND m.message_type = 'private'
            `;
            const uid = Number(userId);
            db.query(sql, [uid, uid, uid], (err, histResults) => {
                if (err) console.error("Historical query error:", err);
                console.log(`User ${userId} historical hits: ${histResults ? histResults.length : 0}`);
                resolve(histResults || []);
            });
        });

        Promise.all([getClasses, getProfLink, getHistorical]).then(([classes, profs, hist]) => {
            console.log(`Sync results for ${userId}: Classes:${classes.length}, Proffers:${profs.length}, Hist:${hist.length}`);
            // Combine all and ensure uniqueness (priority: Classes > Proffers > Historical)
            const seen = new Set();
            seen.add(0); // Global hub id
            seen.add(Number(userId));

            const finalChats = [...results];

            classes.forEach(c => {
                finalChats.push(c);
                seen.add(c.id);
            });

            profs.forEach(p => {
                finalChats.push(p);
                seen.add(p.id);
            });

            hist.forEach(h => {
                if (!seen.has(h.id)) {
                    finalChats.push(h);
                    seen.add(h.id);
                }
            });

            console.log(`Total chats for ${userId}: ${finalChats.length}`);
            res.json(finalChats);
        });
    });
});

app.get("/messages/:chatId", (req, res) => {
    const chatId = parseInt(req.params.chatId);
    const { userId, type, classroomId } = req.query;
    let sql, params;

    if (type === 'global' || chatId === 0) {
        sql = "SELECT * FROM messages WHERE classroom_id IS NULL AND receiver_id IS NULL ORDER BY sent_at ASC";
        params = [];
    } else if (type === 'group' || type === 'professor_classroom') {
        // Professor view of classroom hub
        sql = `
            SELECT m.*, u.full_name as sender_name, u.profile_pic as sender_pic 
            FROM messages m 
            JOIN users u ON m.sender_id = u.id 
            WHERE m.classroom_id = ? 
            ORDER BY sent_at ASC
        `;
        params = [chatId];
    } else {
        // Student view of professor chat (asymmetric classroom context)
        sql = `
            SELECT m.*, u.full_name as sender_name, u.profile_pic as sender_pic 
            FROM messages m 
            JOIN users u ON m.sender_id = u.id 
            WHERE (m.classroom_id = ? AND m.message_type = 'broadcast')
               OR (m.classroom_id = ? AND (
                   (m.sender_id = CAST(? AS UNSIGNED) AND m.receiver_id = CAST(? AS UNSIGNED)) OR 
                   (m.sender_id = CAST(? AS UNSIGNED) AND m.receiver_id = CAST(? AS UNSIGNED))
               ))
            ORDER BY m.sent_at ASC
        `;
        params = [classroomId, classroomId, userId, chatId, chatId, userId];
    }
    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ message: "Error fetch" });
        res.json(result || []);
    });
});

app.get("/search-users", (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);
    const sql = "SELECT id, full_name as name, role, profile_pic, 'private' as type FROM users WHERE full_name LIKE ? LIMIT 10";
    db.query(sql, [`%${query}%`], (err, results) => {
        if (err) return res.status(500).json({ message: "Search failed" });
        res.json(results || []);
    });
});

app.post("/update-profile", (req, res) => {
    const { userId, full_name, contact_number, email, profile_pic, course, year, class_incharge } = req.body;
    console.log("Profile Update Request for User:", userId);
    
    const sql = `
        UPDATE users 
        SET full_name = ?, contact_number = ?, email = ?, profile_pic = ?, course = ?, year = ?, class_incharge = ?
        WHERE id = CAST(? AS UNSIGNED)
    `;
    db.query(sql, [full_name, contact_number, email, profile_pic, course, year, class_incharge, userId], (err) => {
        if (err) {
            console.error("Profile update error:", err);
            return res.status(500).json({ message: "Update failed: " + err.message });
        }
        db.query("SELECT * FROM users WHERE id = CAST(? AS UNSIGNED)", [userId], (err, result) => {
            if (err || result.length === 0) return res.status(500).json({ message: "Update confirmed but failed to reload" });
            res.json({ message: "Profile updated successfully!", user: result[0] });
        });
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
            if (err) return;
            // Routing:
            // 1. If classroom_id is present, emit to the classroom room (Prof gets it here)
            // 2. emit to receiver_id (Student gets it here if it's a DM from prof)
            if (classroom_id) {
                io.to(`class_${classroom_id}`).emit("receive-message", { ...data, id: res.insertId, sent_at: new Date() });
            }
            if (receiver_id) {
                io.to(`user_${receiver_id}`).emit("receive-message", { ...data, id: res.insertId, sent_at: new Date() });
            }
            // Emit back to sender
            socket.emit("receive-message", { ...data, id: res.insertId, sent_at: new Date() });
        });
    });

    socket.on("broadcast", (data) => {
        const { sender_id, classroom_id, message_text } = data;
        db.query("INSERT INTO messages (classroom_id, sender_id, message_text, message_type) VALUES (?, ?, ?, 'broadcast')", [classroom_id, sender_id, message_text], (err, res) => {
            if (err) return;
            io.to(`class_${classroom_id}`).emit("receive-message", { ...data, id: res.insertId, sent_at: new Date(), message_type: 'broadcast' });
        });
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});