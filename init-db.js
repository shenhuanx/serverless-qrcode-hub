// Initialize database
export async function initDatabase(env) {
  try {
    // Create users table
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fingerprint TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create mappings table
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS mappings (
        path TEXT PRIMARY KEY,
        target TEXT NOT NULL,
        name TEXT,
        expiry DATETIME,
        enabled BOOLEAN DEFAULT true,
        is_wechat BOOLEAN DEFAULT false,
        qr_code_data TEXT,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `).run();

    // Create indexes
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_mappings_user_id ON mappings(user_id);
      CREATE INDEX IF NOT EXISTS idx_mappings_expiry ON mappings(expiry);
      CREATE INDEX IF NOT EXISTS idx_mappings_enabled ON mappings(enabled);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_fingerprint ON users(fingerprint);
    `).run();

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
} 