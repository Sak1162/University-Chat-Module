require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // You may want to restrict this to your frontend URL in production
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// MySQL connection using Environment Variables (.env) for Cloud Deployment
// Fallbacks to localhost provided for local development testing
const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "sak1162",
    database: process.env.DB_NAME || "italk_db",
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) {
        console.log("Database connection failed:", err);
    } else {
        console.log("MySQL Connected to:", process.env.DB_NAME || "italk_db");
    }
});

// --- Authentication APIs ---

// Signup API
app.post("/signup", async (req, res) => {
    const { prn, password, full_name, role } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = "INSERT INTO users (prn, password, full_name, role) VALUES (?, ?, ?, ?)";

        db.query(sql, [prn, hashedPassword, full_name, role], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: "PRN already registered" });
                }
                console.error("Signup error:", err);
                return res.status(500).json({ message: "Database error" });
            }
            res.json({ message: "Signup successful", userId: result.insertId });
        });
    } catch (error) {
        res.status(500).json({ message: "Server error during signup" });
    }
});

// Login API
app.post("/login", (req, res) => {
    const { prn, password } = req.body;

    const sql = "SELECT * FROM users WHERE prn=?";
    db.query(sql, [prn], async (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });

        if (result.length > 0) {
            const user = result[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                // Return full user profile for frontend session
                res.json({
                    message: "Login successful",
                    user: {
                        id: user.id,
                        prn: user.prn,
                        name: user.full_name,
                        role: user.role,
                        course: user.course,
                        year: user.year,
                        class_code: user.class_code
                    }
                });
            } else {
                res.status(401).json({ message: "Invalid credentials" });
            }
        } else {
            res.status(404).json({ message: "User not found" });
        }
    });
});

// --- Real-Time Messaging (Socket.io) ---

io.on("connection", (socket) => {
    console.log("User Connected:", socket.id);

    // Join a specific classroom or personal room
    socket.on("join-room", (roomName) => {
        socket.join(roomName);
        console.log(`User ${socket.id} joined room: ${roomName}`);
    });

    // Send generic message (Private or Classroom)
    socket.on("send-message", (data) => {
        const { classroom_id, sender_id, receiver_id, message_text, message_type } = data;

        // Save to DB
        const sql = "INSERT INTO messages (classroom_id, sender_id, receiver_id, message_text, message_type) VALUES (?, ?, ?, ?, ?)";
        db.query(sql, [classroom_id, sender_id, receiver_id, message_text, message_type], (err, result) => {
            if (err) return console.error("Message save error:", err);

            // Emit to specific receiver or entire classroom
            const target = classroom_id ? `class_${classroom_id}` : `user_${receiver_id}`;
            const msgPayload = { ...data, id: result.insertId, sent_at: new Date() };

            io.to(target).emit("receive-message", msgPayload);
            // Also notify sender for sync across devices
            socket.emit("receive-message", msgPayload);
        });
    });

    // Broadcast (Professor only logic is enforced by frontend, but could be double checked here)
    socket.on("broadcast", (data) => {
        const { sender_id, classroom_id, message_text } = data;

        const sql = "INSERT INTO messages (classroom_id, sender_id, message_text, message_type) VALUES (?, ?, ?, 'broadcast')";
        db.query(sql, [classroom_id, sender_id, message_text], (err, result) => {
            if (err) return console.error("Broadcast error:", err);

            const msgPayload = { ...data, id: result.insertId, sent_at: new Date(), message_type: 'broadcast' };
            io.to(`class_${classroom_id}`).emit("receive-message", msgPayload);
        });
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected:", socket.id);
    });
});

app.get("/", (req, res) => {
    res.send("ITALK Backend running with Socket.io");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`ITALK Server running on port ${PORT}`);
});