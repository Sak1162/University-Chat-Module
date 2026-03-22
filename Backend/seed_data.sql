-- ITALK Dummy Data Seed Script
USE italk_db;

-- Clear old data for a clean test (Be careful in production!)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE messages;
TRUNCATE TABLE subjects;
TRUNCATE TABLE classrooms;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Insert Professors (Password is 'pass123' hashed via bcrypt: $2b$10$7Z7o4Yy5...)
-- For simplicity, use the backend signup to hash passwords, or just use these mock values
-- I'll use raw passwords here for the user to copy-paste easily, but they should use Sign Up
INSERT INTO users (prn, password, full_name, role) VALUES 
('P101', '$2b$10$7Z7o4Yy5X9k9b8zX8zX8zX8zX8zX8zX8zX8zX8zX8zX8zX8z', 'Prof. Sharma (Physics)', 'professor'),
('P102', '$2b$10$7Z7o4Yy5X9k9b8zX8zX8zX8zX8zX8zX8zX8zX8zX8zX8zX8z', 'Dr. Verma (Maths)', 'professor');

-- 2. Insert Students
INSERT INTO users (prn, password, full_name, role, course, year) VALUES 
('S201', '$2b$10$7Z7o4Yy5X9k9b8zX8zX8zX8zX8zX8zX8zX8zX8zX8zX8zX8z', 'Student Rahul', 'student', 'B.Tech CS', '3rd Year'),
('S202', '$2b$10$7Z7o4Yy5X9k9b8zX8zX8zX8zX8zX8zX8zX8zX8zX8zX8zX8z', 'Anjali Singh', 'student', 'B.Tech IT', '2nd Year');

-- 3. Insert Classes
INSERT INTO classrooms (name, code, professor_id) VALUES 
('Advanced Physics B3', 'PHYS301', 1),
('Mathematics IV', 'MATH401', 2);

-- 4. Initial Messages (Seeding chat list)
-- Prof Sharma to Rahul (Private)
INSERT INTO messages (sender_id, receiver_id, message_text, message_type) VALUES 
(1, 3, 'Make sure to submit the lab report by Friday.', 'private');

-- Anjali to Rahul (Private)
INSERT INTO messages (sender_id, receiver_id, message_text, message_type) VALUES 
(4, 3, 'Hey, did you get the notes for Cloud Computing?', 'private');

-- 5. Academic Subjects for User S201 (Rahul)
INSERT INTO subjects (user_id, name, semester) VALUES 
(3, 'Advanced Algorithms', 'current'),
(3, 'Database Management', 'current'),
(3, 'Web Technology', 'current'),
(3, 'Machine Learning', 'current');

INSERT INTO subjects (user_id, name, semester, grade) VALUES 
(3, 'Data Structures', 'last', 'A+'),
(3, 'Computer Networks', 'last', 'O'),
(3, 'Operating Systems', 'last', 'A');

-- 6. Pre-existing classes to test Join Option
INSERT INTO classrooms (name, code) VALUES 
('Cyber Security Club', 'CYBER101'),
('Placement Hub 2024', 'PLACE24');
