// Initialize database
import { initDatabase } from './init-db.js';

let KV_BINDING;
let DB;
let isInitialized = false;

const banPath = [
  'login', 'admin', '__total_count',
  // static files
  'admin.html',
  // 'login.html',
  'daisyui@5.css', 'tailwindcss@4.js',
  'qr-code-styling.js', 'zxing.js',
  'robots.txt', 'wechat.svg',
  'favicon.svg',
];

// Cookie related functions
function verifyAuthCookie(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const authToken = cookie.split(';').find(c => c.trim().startsWith('token='));
  if (!authToken) return false;
  return authToken.split('=')[1].trim() === env.PASSWORD;
}

function setAuthCookie(password) {
  return {
    'Set-Cookie': `token=${password}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
    'Content-Type': 'application/json'
  };
}

function clearAuthCookie() {
  return {
    'Set-Cookie': 'token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
    'Content-Type': 'application/json'
  };
}

// Database operation functions
async function listMappings(page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;
  
  // Use a single query to get paginated data and total count
  const results = await DB.prepare(`
    WITH filtered_mappings AS (
      SELECT * FROM mappings 
      WHERE path NOT IN (${banPath.map(() => '?').join(',')})
    )
    SELECT 
      filtered.*,
      (SELECT COUNT(*) FROM filtered_mappings) as total_count
    FROM filtered_mappings as filtered
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...banPath, pageSize, offset).all();

  if (!results.results || results.results.length === 0) {
    return {
      mappings: {},
      total: 0,
      page,
      pageSize,
      totalPages: 0
    };
  }

  const total = results.results[0].total_count;
  const mappings = {};

  for (const row of results.results) {
    mappings[row.path] = {
      target: row.target,
      name: row.name,
      expiry: row.expiry,
      enabled: row.enabled === 1,
      isWechat: row.isWechat === 1,
      qrCodeData: row.qrCodeData
    };
  }

  return {
    mappings,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

async function createMapping(path, target, name, expiry, enabled = true, isWechat = false, qrCodeData = null) {
  if (!path || !target || typeof path !== 'string' || typeof target !== 'string') {
    throw new Error('Invalid input');
  }

  // 检查短链名是否在禁用列表中
  if (banPath.includes(path)) {
    throw new Error('该短链名已被系统保留，请使用其他名称');
  }

  if (expiry && isNaN(Date.parse(expiry))) {
    throw new Error('Invalid expiry date');
  }

  // 如果是微信二维码，必须提供二维码数据
  if (isWechat && !qrCodeData) {
    throw new Error('微信二维码必须提供原始二维码数据');
  }

  await DB.prepare(`
    INSERT INTO mappings (path, target, name, expiry, enabled, isWechat, qrCodeData)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    path,
    target,
    name || null,
    expiry || null,
    enabled ? 1 : 0,
    isWechat ? 1 : 0,
    qrCodeData
  ).run();
}

async function deleteMapping(path) {
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid input');
  }

  // 检查是否在禁用列表中
  if (banPath.includes(path)) {
    throw new Error('系统保留的短链名无法删除');
  }

  await DB.prepare('DELETE FROM mappings WHERE path = ?').bind(path).run();
}

async function updateMapping(originalPath, newPath, target, name, expiry, enabled = true, isWechat = false, qrCodeData = null) {
  if (!originalPath || !newPath || !target) {
    throw new Error('Invalid input');
  }

  // 检查新短链名是否在禁用列表中
  if (banPath.includes(newPath)) {
    throw new Error('该短链名已被系统保留，请使用其他名称');
  }

  if (expiry && isNaN(Date.parse(expiry))) {
    throw new Error('Invalid expiry date');
  }

  // 如果没有提供新的二维码数据，获取原有的二维码数据
  if (!qrCodeData && isWechat) {
    const existingMapping = await DB.prepare(`
      SELECT qrCodeData
      FROM mappings
      WHERE path = ?
    `).bind(originalPath).first();

    if (existingMapping) {
      qrCodeData = existingMapping.qrCodeData;
    }
  }

  // 如果是微信二维码，必须有二维码数据
  if (isWechat && !qrCodeData) {
    throw new Error('微信二维码必须提供原始二维码数据');
  }

  const stmt = DB.prepare(`
    UPDATE mappings 
    SET path = ?, target = ?, name = ?, expiry = ?, enabled = ?, isWechat = ?, qrCodeData = ?
    WHERE path = ?
  `);

  await stmt.bind(
    newPath,
    target,
    name || null,
    expiry || null,
    enabled ? 1 : 0,
    isWechat ? 1 : 0,
    qrCodeData,
    originalPath
  ).run();
}

async function getExpiringMappings(userId) {
  // 获取当前时间（使用本地时间）
  const now = new Date();
  console.log('当前时间:', now.toISOString());

  // 获取今天的开始时间（00:00:00）
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  console.log('今天开始时间:', todayStart.toISOString());

  // 获取3天后的结束时间（23:59:59）
  const threeDaysLater = new Date(todayStart);
  threeDaysLater.setDate(todayStart.getDate() + 3);
  threeDaysLater.setHours(23, 59, 59, 999);
  console.log('3天后结束时间:', threeDaysLater.toISOString());

  // 先检查用户是否存在
  const userCheck = await DB.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(userId).first();
  
  console.log('用户检查结果:', userCheck);

  if (!userCheck) {
    throw new Error('用户不存在');
  }

  // 使用单个查询获取所有过期和即将过期的映射
  const query = `
    WITH categorized_mappings AS (
      SELECT 
        path, name, target, expiry, enabled, is_wechat, qr_code_data,
        CASE 
          WHEN datetime(expiry) < datetime(?) THEN 'expired'
          WHEN datetime(expiry) <= datetime(?) THEN 'expiring'
        END as status
      FROM mappings 
      WHERE expiry IS NOT NULL 
        AND datetime(expiry) <= datetime(?) 
        AND enabled = 1
        AND user_id = ?
    )
    SELECT * FROM categorized_mappings
    ORDER BY expiry ASC
  `;

  console.log('SQL查询:', query);
  console.log('查询参数:', [
    todayStart.toISOString(),
    threeDaysLater.toISOString(),
    threeDaysLater.toISOString(),
    userId
  ]);

  const results = await DB.prepare(query).bind(
    todayStart.toISOString(),
    threeDaysLater.toISOString(),
    threeDaysLater.toISOString(),
    userId
  ).all();

  console.log('查询结果:', results);

  const mappings = {
    expiring: [],
    expired: []
  };
  
  if (results.results) {
    for (const row of results.results) {
      const mapping = {
        path: row.path,
        name: row.name,
        target: row.target,
        expiry: row.expiry,
        enabled: row.enabled === 1,
        isWechat: row.is_wechat === 1,
        qrCodeData: row.qr_code_data
      };

      // 打印每个映射的过期时间和状态
      console.log('映射:', {
        path: mapping.path,
        expiry: mapping.expiry,
        status: row.status,
        isExpired: new Date(mapping.expiry) < todayStart
      });

      if (row.status === 'expired') {
        mappings.expired.push(mapping);
      } else {
        mappings.expiring.push(mapping);
      }
    }
  }

  console.log('处理后的映射:', mappings);
  
  // 确保返回正确的数据格式
  const response = {
    expiring: mappings.expiring || [],
    expired: mappings.expired || []
  };
  
  return response;
}

// 添加新的批量清理过期映射的函数
async function cleanupExpiredMappings(batchSize = 100) {
  const now = new Date().toISOString();
  
  while (true) {
    // 获取一批过期的映射
    const batch = await DB.prepare(`
      SELECT path 
      FROM mappings 
      WHERE expiry IS NOT NULL 
        AND expiry < ? 
      LIMIT ?
    `).bind(now, batchSize).all();

    if (!batch.results || batch.results.length === 0) {
      break;
    }

    // 批量删除这些映射
    const paths = batch.results.map(row => row.path);
    const placeholders = paths.map(() => '?').join(',');
    await DB.prepare(`
      DELETE FROM mappings 
      WHERE path IN (${placeholders})
    `).bind(...paths).run();

    // 如果获取的数量小于 batchSize，说明已经处理完所有过期映射
    if (batch.results.length < batchSize) {
      break;
    }
  }
}

// 数据迁移函数
async function migrateFromKV() {
  let cursor = null;
  do {
    const listResult = await KV_BINDING.list({ cursor, limit: 1000 });
    
    for (const key of listResult.keys) {
      if (!banPath.includes(key.name)) {
        const value = await KV_BINDING.get(key.name, { type: "json" });
        if (value) {
          try {
            await createMapping(
              key.name,
              value.target,
              value.name,
              value.expiry,
              value.enabled,
              value.isWechat,
              value.qrCodeData
            );
          } catch (e) {
            console.error(`Failed to migrate ${key.name}:`, e);
          }
        }
      }
    }
    
    cursor = listResult.cursor;
  } while (cursor);
}

// 浏览器指纹相关函数
async function getOrCreateUser(fingerprint, env) {
  try {
    console.log('开始查找/创建用户，指纹:', fingerprint);
    
    // 先查找用户
    const { results } = await env.DB.prepare(
      'SELECT id FROM users WHERE fingerprint = ?'
    ).bind(fingerprint).all();
    
    console.log('查询结果:', results);
    
    if (results && results.length > 0) {
      console.log('找到已存在的用户，ID:', results[0].id);
      return results[0].id;
    }
    
    console.log('未找到用户，开始创建新用户');
    
    // 创建新用户
    const { success, error } = await env.DB.prepare(
      'INSERT INTO users (fingerprint) VALUES (?)'
    ).bind(fingerprint).run();
    
    if (!success) {
      console.error('创建用户失败:', error);
      throw new Error('Failed to create user');
    }
    
    // 获取新创建的用户ID
    const { results: newUser } = await env.DB.prepare(
      'SELECT id FROM users WHERE fingerprint = ?'
    ).bind(fingerprint).all();
    
    if (!newUser || newUser.length === 0) {
      throw new Error('Failed to get new user ID');
    }
    
    console.log('创建新用户成功，ID:', newUser[0].id);
    return newUser[0].id;
  } catch (error) {
    console.error('用户操作失败:', error);
    throw error;
  }
}

// 修改API路由处理
export default {
  async fetch(request, env) {
    KV_BINDING = env.KV_BINDING;
    DB = env.DB;
    
    // 只在第一次运行时初始化数据库
    if (!isInitialized) {
      await initDatabase(env);
      isInitialized = true;
    }
    
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    // 根目录直接跳转到管理后台
    if (path === '') {
      const response = await env.ASSETS.fetch(new Request(url.origin + '/admin.html'));
      return response;
    }

    // API 路由处理
    if (path.startsWith('api/')) {
      // 获取浏览器指纹
      const fingerprint = request.headers.get('X-Fingerprint');
      if (!fingerprint) {
        return new Response('Fingerprint required', { status: 400 });
      }

      // 清理指纹值，移除可能的重复和空格
      const cleanFingerprint = fingerprint.split(',')[0].trim();
      console.log('清理后的指纹:', cleanFingerprint);

      // 获取或创建用户
      const userId = await getOrCreateUser(cleanFingerprint, env);
      console.log('当前用户ID:', userId);

      // 获取映射列表
      if (path === 'api/mappings' && request.method === 'GET') {
        try {
          // 获取该用户的映射列表
          const { results } = await env.DB.prepare(
            'SELECT * FROM mappings WHERE user_id = ? ORDER BY created_at DESC'
          ).bind(userId).all();
          
          console.log('查询结果:', results);
          
          // 转换数据格式
          const mappings = {};
          for (const row of results) {
            mappings[row.path] = {
              target: row.target,
              name: row.name,
              expiry: row.expiry,
              enabled: row.enabled === 1,
              isWechat: row.is_wechat === 1,
              qrCodeData: row.qr_code_data
            };
          }
          
          return new Response(JSON.stringify({ mappings }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('获取映射列表失败:', error);
          return new Response(JSON.stringify({ 
            error: '获取映射列表失败' 
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 获取单个映射
      if (path === 'api/mapping' && request.method === 'GET') {
        try {
          const url = new URL(request.url);
          const mappingPath = url.searchParams.get('path');
          
          if (!mappingPath) {
            return new Response(JSON.stringify({ 
              error: '缺少映射路径参数' 
            }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // 获取浏览器指纹
          const fingerprint = request.headers.get('X-Fingerprint');
          if (!fingerprint) {
            return new Response('Fingerprint required', { status: 400 });
          }

          // 清理指纹值
          const cleanFingerprint = fingerprint.split(',')[0].trim();
          
          // 获取用户ID
          const userId = await getOrCreateUser(cleanFingerprint, env);
          console.log('当前用户ID:', userId);

          // 获取映射
          const { results } = await env.DB.prepare(
            'SELECT * FROM mappings WHERE path = ? AND user_id = ?'
          ).bind(mappingPath, userId).all();

          if (!results || results.length === 0) {
            return new Response(JSON.stringify({ 
              error: '映射不存在或不属于当前用户' 
            }), { 
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const mapping = results[0];
          return new Response(JSON.stringify({
            path: mapping.path,
            target: mapping.target,
            name: mapping.name,
            expiry: mapping.expiry,
            enabled: mapping.enabled === 1,
            isWechat: mapping.is_wechat === 1,
            qrCodeData: mapping.qr_code_data
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('获取映射失败:', error);
          return new Response(JSON.stringify({ 
            error: '获取映射失败' 
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 添加映射
      if (path === 'api/mapping' && request.method === 'POST') {
        try {
          const mapping = await request.json();
          
          // 检查短链名是否在禁用列表中
          if (banPath.includes(mapping.path)) {
            return new Response(JSON.stringify({ 
              error: '该短链名已被系统保留，请使用其他名称' 
            }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // 检查短链名是否已存在
          const existing = await env.DB.prepare(
            'SELECT path FROM mappings WHERE path = ?'
          ).bind(mapping.path).first();

          if (existing) {
            return new Response(JSON.stringify({ 
              error: '该短链名已被使用，请使用其他名称' 
            }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const { success, error } = await env.DB.prepare(
            'INSERT INTO mappings (path, target, name, expiry, enabled, is_wechat, qr_code_data, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            mapping.path,
            mapping.target,
            mapping.name || null,
            mapping.expiry || null,
            mapping.enabled ? 1 : 0,
            mapping.isWechat ? 1 : 0,
            mapping.qrCodeData || null,
            userId
          ).run();

          if (!success) {
            console.error('数据库错误:', error);
            return new Response(JSON.stringify({ 
              error: '添加失败，请重试' 
            }), { 
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('添加映射失败:', error);
          return new Response(JSON.stringify({ 
            error: '添加失败，请检查输入数据是否正确' 
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 更新映射
      if (path === 'api/mapping' && request.method === 'PUT') {
        try {
          const mapping = await request.json();
          console.log('更新映射请求数据:', mapping);

          // 获取浏览器指纹
          const fingerprint = request.headers.get('X-Fingerprint');
          if (!fingerprint) {
            return new Response('Fingerprint required', { status: 400 });
          }

          // 清理指纹值
          const cleanFingerprint = fingerprint.split(',')[0].trim();
          
          // 获取用户ID
          const userId = await getOrCreateUser(cleanFingerprint, env);
          console.log('当前用户ID:', userId);

          // 检查映射是否存在且属于当前用户
          const { results: existingMapping } = await env.DB.prepare(
            'SELECT * FROM mappings WHERE path = ? AND user_id = ?'
          ).bind(mapping.path, userId).all();

          if (!existingMapping || existingMapping.length === 0) {
            return new Response(JSON.stringify({ 
              error: '映射不存在或不属于当前用户' 
            }), { 
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // 更新映射
          const { success, error } = await env.DB.prepare(
            'UPDATE mappings SET target = ?, name = ?, expiry = ?, enabled = ?, is_wechat = ?, qr_code_data = ? WHERE path = ? AND user_id = ?'
          ).bind(
            mapping.target,
            mapping.name || null,
            mapping.expiry || null,
            mapping.enabled ? 1 : 0,
            mapping.isWechat ? 1 : 0,
            mapping.qrCodeData || null,
            mapping.path,
            userId
          ).run();

          if (!success) {
            console.error('更新映射失败:', error);
            return new Response(JSON.stringify({ 
              error: '更新失败，请重试' 
            }), { 
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('更新映射失败:', error);
          return new Response(JSON.stringify({ 
            error: '更新失败，请检查输入数据是否正确' 
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 删除映射
      if (path === 'api/mapping' && request.method === 'DELETE') {
        const { path: mappingPath } = await request.json();
        const { success } = await env.DB.prepare(
          'DELETE FROM mappings WHERE path = ? AND user_id = ?'
        ).bind(mappingPath, userId).run();

        if (!success) {
          return new Response('Failed to delete mapping', { status: 500 });
        }

        return new Response(JSON.stringify({ success: true }));
      }

      // 获取过期和即将过期的映射
      if (path === 'api/expiring-mappings' && request.method === 'GET') {
        try {
          console.log('开始获取过期映射，用户ID:', userId);
          
          // 获取当前时间（使用本地时间）
          const now = new Date();
          console.log('当前时间:', now.toISOString());

          // 获取今天的开始时间（00:00:00）
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          console.log('今天开始时间:', todayStart.toISOString());

          // 获取3天后的结束时间（23:59:59）
          const threeDaysLater = new Date(todayStart);
          threeDaysLater.setDate(todayStart.getDate() + 3);
          threeDaysLater.setHours(23, 59, 59, 999);
          console.log('3天后结束时间:', threeDaysLater.toISOString());

          // 先检查用户是否存在
          const userCheck = await DB.prepare(
            'SELECT id FROM users WHERE id = ?'
          ).bind(userId).first();
          
          console.log('用户检查结果:', userCheck);

          if (!userCheck) {
            throw new Error('用户不存在');
          }

          // 使用单个查询获取所有过期和即将过期的映射
          const query = `
            WITH categorized_mappings AS (
              SELECT 
                path, name, target, expiry, enabled, is_wechat, qr_code_data,
                CASE 
                  WHEN datetime(expiry) < datetime(?) THEN 'expired'
                  WHEN datetime(expiry) <= datetime(?) THEN 'expiring'
                END as status
              FROM mappings 
              WHERE expiry IS NOT NULL 
                AND datetime(expiry) <= datetime(?) 
                AND enabled = 1
                AND user_id = ?
            )
            SELECT * FROM categorized_mappings
            ORDER BY expiry ASC
          `;

          console.log('SQL查询:', query);
          console.log('查询参数:', [
            todayStart.toISOString(),
            threeDaysLater.toISOString(),
            threeDaysLater.toISOString(),
            userId
          ]);

          const results = await DB.prepare(query).bind(
            todayStart.toISOString(),
            threeDaysLater.toISOString(),
            threeDaysLater.toISOString(),
            userId
          ).all();

          console.log('查询结果:', results);

          const mappings = {
            expiring: [],
            expired: []
          };
          
          if (results.results) {
            for (const row of results.results) {
              const mapping = {
                path: row.path,
                name: row.name,
                target: row.target,
                expiry: row.expiry,
                enabled: row.enabled === 1,
                isWechat: row.is_wechat === 1,
                qrCodeData: row.qr_code_data
              };

              // 打印每个映射的过期时间和状态
              console.log('映射:', {
                path: mapping.path,
                expiry: mapping.expiry,
                status: row.status,
                isExpired: new Date(mapping.expiry) < todayStart
              });

              if (row.status === 'expired') {
                mappings.expired.push(mapping);
              } else {
                mappings.expiring.push(mapping);
              }
            }
          }

          console.log('处理后的映射:', mappings);
          
          // 确保返回正确的数据格式
          const response = {
            expiring: mappings.expiring || [],
            expired: mappings.expired || []
          };
          
          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('获取过期映射失败:', error);
          // 返回更详细的错误信息
          return new Response(JSON.stringify({ 
            error: '获取过期映射失败',
            details: error.message,
            stack: error.stack,
            expiring: [],
            expired: []
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Handle static files
    if (path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.js')) {
      return env.ASSETS.fetch(request);
    }

    // Handle short link redirection
    const { results } = await env.DB.prepare(
      'SELECT * FROM mappings WHERE path = ? AND enabled = true'
    ).bind(path).all();

    if (results.length > 0) {
      const mapping = results[0];
      if (mapping.expiry && new Date(mapping.expiry) < new Date()) {
        return new Response('Link expired', { status: 410 });
      }
      return Response.redirect(mapping.target, 302);
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(controller, env, ctx) {
    KV_BINDING = env.KV_BINDING;
    DB = env.DB;
    
    // 初始化数据库
    await initDatabase(env);
        
    // 获取过期和即将过期的映射报告
    const result = await getExpiringMappings();

    console.log(`Cron job report: Found ${result.expired.length} expired mappings`);
    if (result.expired.length > 0) {
      console.log('Expired mappings:', JSON.stringify(result.expired, null, 2));
    }

    console.log(`Found ${result.expiring.length} mappings expiring in 2 days`);
    if (result.expiring.length > 0) {
      console.log('Expiring soon mappings:', JSON.stringify(result.expiring, null, 2));
    }
  },

};