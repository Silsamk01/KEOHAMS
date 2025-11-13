/**
 * Script to create public blog database
 * Run: node scripts/createPublicBlogDb.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function createPublicBlogDatabase() {
  const dbName = process.env.PUBLIC_DB_NAME || 'keohams_public_blog';
  
  const connection = await mysql.createConnection({
    host: process.env.PUBLIC_DB_HOST || process.env.DB_HOST,
    port: parseInt(process.env.PUBLIC_DB_PORT || process.env.DB_PORT || '3306', 10),
    user: process.env.PUBLIC_DB_USER || process.env.DB_USER,
    password: process.env.PUBLIC_DB_PASSWORD || process.env.DB_PASSWORD
  });

  try {
    console.log(`🔄 Creating public blog database: ${dbName}`);
    
    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✓ Database ${dbName} created successfully`);
    
    // Use the database
    await connection.query(`USE \`${dbName}\``);
    
    // Create posts table (public-facing, simplified schema)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        excerpt TEXT,
        content TEXT NOT NULL,
        cover_image VARCHAR(500),
        category VARCHAR(100),
        reading_minutes INT UNSIGNED,
        view_count INT UNSIGNED NOT NULL DEFAULT 0,
        seo_title VARCHAR(255),
        seo_description VARCHAR(300),
        published_at TIMESTAMP,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug),
        INDEX idx_published_at (published_at),
        INDEX idx_category (category),
        INDEX idx_view_count (view_count)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created posts table');
    
    // Create tags table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(60) NOT NULL UNIQUE,
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created tags table');
    
    // Create post_tags junction table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS post_tags (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        post_id INT UNSIGNED NOT NULL,
        tag_id INT UNSIGNED NOT NULL,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        UNIQUE KEY unique_post_tag (post_id, tag_id),
        INDEX idx_tag_id (tag_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created post_tags table');
    
    // Create comments table (optional - for public engagement)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        post_id INT UNSIGNED NOT NULL,
        author_name VARCHAR(255) NOT NULL,
        author_email VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_approved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        INDEX idx_post_id (post_id),
        INDEX idx_approved (is_approved),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created comments table');
    
    // Create sync log table (track what was synced when)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        post_id INT UNSIGNED NOT NULL,
        action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_post_id (post_id),
        INDEX idx_synced_at (synced_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created sync_log table');
    
    console.log('\n✅ Public blog database setup complete!');
    console.log(`Database: ${dbName}`);
    console.log('Tables: posts, tags, post_tags, comments, sync_log');
    
  } catch (error) {
    console.error('❌ Error creating public blog database:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

createPublicBlogDatabase();
