

CREATE DATABASE IF NOT EXISTS italk_db;
USE italk_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prn VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('student', 'professor', 'admin') NOT NULL,
    course VARCHAR(100),
    year VARCHAR(20),
    class_incharge VARCHAR(100),
    class_code VARCHAR(50),
    contact_number VARCHAR(20),
    email VARCHAR(100),
    profile_pic LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Classrooms Table
CREATE TABLE IF NOT EXISTS classrooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    professor_id INT,
    FOREIGN KEY (professor_id) REFERENCES users(id)
);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT DEFAULT NULL,
    sender_id INT NOT NULL,
    receiver_id INT DEFAULT NULL,
    message_text TEXT NOT NULL,
    message_type ENUM('private', 'broadcast', 'global') NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- 4. Stories Table
CREATE TABLE IF NOT EXISTS stories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    content TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Placements Table
CREATE TABLE IF NOT EXISTS placements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    domain VARCHAR(50) NOT NULL,
    cgpa DECIMAL(3,2) NOT NULL,
    skills TEXT,
    resume_link TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Mock Data for Testing
-- (Optional: Uncomment to seed the database)

INSERT INTO users (prn, password, full_name, role) VALUES ('12345', 'pass123', 'Prof. Sharma', 'professor');
INSERT INTO users (prn, password, full_name, role) VALUES ('67890', 'pass123', 'Student One', 'student');
INSERT INTO classrooms (name, code, professor_id) VALUES ('CS-B3', 'CSB3', 1);



SELECT* FROM USERS;



CREATE DATABASE IF NOT EXISTS italk_db;
USE italk_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prn VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('student', 'professor', 'admin') NOT NULL,
    course VARCHAR(100),
    year VARCHAR(20),
    class_incharge VARCHAR(100),
    class_code VARCHAR(50),
    contact_number VARCHAR(20),
    email VARCHAR(100),
    profile_pic LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Classrooms Table
CREATE TABLE IF NOT EXISTS classrooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    professor_id INT,
    FOREIGN KEY (professor_id) REFERENCES users(id)
);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT DEFAULT NULL,
    sender_id INT NOT NULL,
    receiver_id INT DEFAULT NULL,
    message_text TEXT NOT NULL,
    message_type ENUM('private', 'broadcast', 'global') NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- 4. Stories Table
CREATE TABLE IF NOT EXISTS stories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    content TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Placements Table
CREATE TABLE IF NOT EXISTS placements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    domain VARCHAR(50) NOT NULL,
    cgpa DECIMAL(3,2) NOT NULL,
    skills TEXT,
    resume_link TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. Subjects Table (NEW)
CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    semester ENUM('current', 'last') NOT NULL,
    grade VARCHAR(5), -- Only for last sem
    FOREIGN KEY (user_id) REFERENCES users(id)
);

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
('P101', '$2b$10$7Z7oEME9M9cSy9FvfHvcx2gMPkp1H5Dj4YaKufPRsAyon8Tf', 'Prof. Sharma (Physics)', 'professor'),
('P102', '$2b$10$7Z7oEME9M9cSy9FvfHvcx2gMPkp1H5Dj4YaKufPRsAyon8Tf', 'Dr. Verma (Maths)', 'professor');

-- 2. Insert Students
INSERT INTO users (prn, password, full_name, role, course, year) VALUES 
('S201', '$2b$10$7Z7oEME9M9cSy9FvfHvcx2gMPkp1H5Dj4YaKufPRsAyon8Tf', 'Student Rahul', 'student', 'B.Tech CS', '3rd Year'),
('S202', '$2b$10$7Z7oEME9M9cSy9FvfHvcx2gMPkp1H5Dj4YaKufPRsAyon8Tf', 'Anjali Singh', 'student', 'B.Tech IT', '2nd Year');

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

-- 0987654321 pass= prof123
-- 1234567890 pass=test123

USE italk_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prn VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('student', 'professor', 'admin') NOT NULL,
    course VARCHAR(100),
    year VARCHAR(20),
    class_incharge VARCHAR(100),
    class_code VARCHAR(50),
    contact_number VARCHAR(20),
    email VARCHAR(100),
    profile_pic LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Classrooms Table
CREATE TABLE IF NOT EXISTS classrooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    professor_id INT,
    FOREIGN KEY (professor_id) REFERENCES users(id)
);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroom_id INT DEFAULT NULL,
    sender_id INT NOT NULL,
    receiver_id INT DEFAULT NULL,
    message_text TEXT NOT NULL,
    message_type ENUM('private', 'broadcast', 'global') NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- 4. Stories Table
CREATE TABLE IF NOT EXISTS stories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    content TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Placements Table
CREATE TABLE IF NOT EXISTS placements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    domain VARCHAR(50) NOT NULL,
    cgpa DECIMAL(3,2) NOT NULL,
    skills TEXT,
    resume_link TEXT,
    linkedin_link TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. Subjects Table (NEW)
CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    semester ENUM('current', 'last') NOT NULL,
    grade VARCHAR(5), -- Only for last sem
    FOREIGN KEY (user_id) REFERENCES users(id)
);

SELECT* FROM USERS;

SELECT* FROM PLACEMENTS;



