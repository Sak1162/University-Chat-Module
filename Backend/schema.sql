-- ITALK University Chat Database Initialization Script (Expanded)
-- Database Name: italk_db

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
