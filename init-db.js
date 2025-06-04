// Initialize database
export async function initDatabase(env) {
  try {
    console.log('开始初始化数据库...');

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
        enabled INTEGER DEFAULT 1,
        is_wechat INTEGER DEFAULT 0,
        qr_code_data TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `).run();

    // Create ads table
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        position TEXT NOT NULL,
        content TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create indexes
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_mappings_user_id ON mappings(user_id);
      CREATE INDEX IF NOT EXISTS idx_mappings_expiry ON mappings(expiry);
      CREATE INDEX IF NOT EXISTS idx_mappings_enabled ON mappings(enabled);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_fingerprint ON users(fingerprint);
      CREATE INDEX IF NOT EXISTS idx_ads_position ON ads(position);
      CREATE INDEX IF NOT EXISTS idx_ads_enabled ON ads(enabled);
    `).run();

    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
} 