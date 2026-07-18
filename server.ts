import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import pg from 'pg';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const PORT = 3000;

// PostgreSQL Connection Pool
const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: false,
  max: 20,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 30000 // cancel queries taking longer than 30 seconds
});

// Set search_path automatically on every new client connection
pool.on('connect', (client) => {
  client.query('SET search_path TO beechat, public').catch((err) => {
    console.error('Error setting search_path on client connect:', err);
  });
});

// Handle unexpected errors on idle database clients to prevent process crashes
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

// Database initialization
async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Initializing database schemas...');
    
    // Ensure custom schema beechat exists and search path is set
    await client.query('CREATE SCHEMA IF NOT EXISTS beechat AUTHORIZATION beechat');
    await client.query('SET search_path TO beechat, public');
    
    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        avatar TEXT,
        bio TEXT,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(255) UNIQUE,
        is_online BOOLEAN DEFAULT false,
        last_seen TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cover_photo TEXT,
        password_hash VARCHAR(256)
      );
    `);

    // Add password_hash and last_active columns and unique constraints to users table if table already exists
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(256);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `).catch(() => {});
    
    await client.query(`
      ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
    `).catch(() => {});

    await client.query(`
      ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone);
    `).catch(() => {});



    // 2. Chats table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        avatar TEXT,
        is_group BOOLEAN DEFAULT false,
        is_pinned BOOLEAN DEFAULT false,
        is_archived BOOLEAN DEFAULT false,
        type VARCHAR(50) DEFAULT 'direct',
        description TEXT,
        last_message TEXT,
        last_message_time TIMESTAMP
      );
    `);

    // 3. Chat members junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_members (
        chat_id VARCHAR(255) REFERENCES chats(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (chat_id, user_id)
      );
    `);

    // 4. Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        chat_id VARCHAR(255) REFERENCES chats(id) ON DELETE CASCADE,
        sender_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        text TEXT,
        type VARCHAR(50) DEFAULT 'text',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'sent',
        media_url TEXT,
        file_name TEXT,
        file_size TEXT,
        duration INTEGER,
        poll_question TEXT,
        reply_to_id VARCHAR(255),
        reply_to_text TEXT
      );
    `);

    // Migrate messages table schema to support document fields
    await client.query(`
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name TEXT;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size TEXT;
    `);

    // 5. Poll options table
    await client.query(`
      CREATE TABLE IF NOT EXISTS poll_options (
        id VARCHAR(255) PRIMARY KEY,
        message_id VARCHAR(255) REFERENCES messages(id) ON DELETE CASCADE,
        text TEXT NOT NULL
      );
    `);

    // 6. Poll votes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS poll_votes (
        option_id VARCHAR(255) REFERENCES poll_options(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (option_id, user_id)
      );
    `);

    // 7. Message reactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        message_id VARCHAR(255) REFERENCES messages(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(50) NOT NULL,
        PRIMARY KEY (message_id, user_id, emoji)
      );
    `);

    // 8. Call logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        user_name VARCHAR(255),
        avatar TEXT,
        type VARCHAR(50) NOT NULL,
        is_outgoing BOOLEAN DEFAULT false,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) NOT NULL,
        duration VARCHAR(50)
      );
    `);

    // 9. Status updates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS status_updates (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        user_name VARCHAR(255),
        user_avatar TEXT,
        type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        bg_style TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Status views table
    await client.query(`
      CREATE TABLE IF NOT EXISTS status_views (
        status_id VARCHAR(255) REFERENCES status_updates(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (status_id, user_id)
      );
    `);

    // 11. Communities table
    await client.query(`
      CREATE TABLE IF NOT EXISTS communities (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        avatar TEXT,
        group_count INTEGER DEFAULT 0,
        member_count INTEGER DEFAULT 0
      );
    `);

    // 12. Community announcements table
    await client.query(`
      CREATE TABLE IF NOT EXISTS community_announcements (
        id VARCHAR(255) PRIMARY KEY,
        community_id VARCHAR(255) REFERENCES communities(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 13. Stickers table (supporting global and per-user stickers)
    await client.query(`
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        user_id VARCHAR(255),
        label VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default global stickers if empty
    const stickersCheck = await client.query('SELECT COUNT(*) FROM stickers WHERE user_id IS NULL');
    if (parseInt(stickersCheck.rows[0].count) === 0) {
      const defaultStickers = [
        { url: '🐝', label: 'Lebah Madu' },
        { url: '🍯', label: 'Madu Manis' },
        { url: '🌻', label: 'Matahari' },
        { url: '🌸', label: 'Sakura' },
        { url: '👑', label: 'Ratu Lebah' },
        { url: '🧸', label: 'Beruang Madu' },
        { url: '🥞', label: 'Pancake Madu' },
        { url: '🍋', label: 'Lemon Madu' },
        { url: '💖', label: 'Cinta Lebah' }
      ];
      for (const st of defaultStickers) {
        await client.query('INSERT INTO stickers (url, label) VALUES ($1, $2)', [st.url, st.label]);
      }
    }

    // Create indexes for performance on remote database
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_poll_options_message_id ON poll_options(message_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON poll_votes(option_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_status_updates_user_id ON status_updates(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_status_views_status_id ON status_views(status_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_stickers_user_id ON stickers(user_id)');

    console.log('Database schemas successfully initialized.');
  } catch (err) {
    console.error('Error initializing database schemas:', err);
  } finally {
    client.release();
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve uploaded static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Streaming octet-stream upload endpoint to handle large files (up to 5GB) with almost zero memory usage
app.post('/api/upload', (req, res) => {
  const fileName = req.headers['x-file-name'] as string;
  if (!fileName) {
    return res.status(400).json({ error: 'Missing x-file-name header' });
  }

  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  // Generate safe name with a timestamp prefix
  const cleanFileName = Date.now() + '_' + fileName.replace(/[^a-zA-Z0-9.\-_]/g, '');
  const filePath = path.join(uploadsDir, cleanFileName);
  const writeStream = fs.createWriteStream(filePath);

  req.pipe(writeStream);

  writeStream.on('finish', () => {
    res.json({ url: `/uploads/${cleanFileName}`, fileName: fileName });
  });

  writeStream.on('error', (err) => {
    console.error('Upload stream write error:', err);
    res.status(500).json({ error: err.message });
  });
});

// Memory cache to prevent overloading the remote PostgreSQL database with high-frequency polling
const dbCache: {
  status: any | null;
  chats: Record<string, any>;
  messages: Record<string, any>;
} = {
  status: null,
  chats: {},
  messages: {}
};

function invalidateStatusCache() {
  dbCache.status = null;
}
function invalidateChatsCache(userId?: string) {
  if (userId) {
    delete dbCache.chats[userId];
  } else {
    dbCache.chats = {};
  }
}
function invalidateMessagesCache(userId?: string) {
  if (userId) {
    delete dbCache.messages[userId];
  } else {
    dbCache.messages = {};
  }
}

// Initialize Gemini SDK with telemetry headers
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('Gemini AI successfully initialized server-side.');
  } catch (err) {
    console.error('Failed to initialize Gemini AI:', err);
  }
} else {
  console.log('No valid GEMINI_API_KEY found. Server will run with simulation mode for AI actions.');
}

// Reusable content generator with model fallback list
async function generateAiContentWithFallback(prompt: string, responseMimeType?: string) {
  const GEMINI_MODELS = [
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash-lite'
  ];

  if (!ai) return null;

  let lastError: any = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(`Attempting AI generation with model: ${modelName}...`);
      const options: any = {
        model: modelName,
        contents: prompt,
      };
      if (responseMimeType) {
        options.config = { responseMimeType };
      }
      const response = await ai.models.generateContent(options);
      if (response && response.text) {
        console.log(`AI generation successful with model: ${modelName}`);
        return response.text;
      }
    } catch (err: any) {
      console.warn(`Model ${modelName} failed or unavailable:`, err.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error('All models failed to generate content.');
}

// Configure Brevo SMTP transporter
const mailTransporter = nodemailer.createTransport({
  host: process.env.BREVO_EMAIL || 'smtp-relay.brevo.com',
  port: parseInt(process.env.BREVO_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.BREVO_LOGIN,
    pass: process.env.BREVO_KEY,
  },
});

// Helper to send WhatsApp message via Fonnte
async function sendWhatsAppNotification(phone: string, name: string) {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    console.log('FONNTE_TOKEN is not configured in .env. Skipping WhatsApp notification.');
    return;
  }
  
  // Clean/normalize phone number (Fonnte expects target with digits only)
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  
  const welcomeMessage = `Halo ${name}! 🐝 Selamat bergabung di BeeChat (Sarang Lebah Terbuka kami)! Akun Anda telah berhasil terdaftar. Ayo mulai terbang dan sebarkan nektar kebaikan dengan mengobrol bersama koloni lebah pekerja lainnya! 🍯✨`;

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: cleanPhone,
        message: welcomeMessage
      })
    });
    const resData = (await response.json()) as any;
    if (resData.status) {
      console.log(`WhatsApp notification successfully queued to ${cleanPhone}`);
    } else {
      console.error(`Fonnte API returned error:`, resData.reason || resData);
    }
  } catch (err) {
    console.error('Failed to send WhatsApp notification:', err);
  }
}

// Helper to send Email notification via Brevo SMTP
async function sendEmailNotification(email: string, name: string) {
  const login = process.env.BREVO_LOGIN;
  const key = process.env.BREVO_KEY;
  if (!login || !key) {
    console.log('Brevo credentials are not configured in .env. Skipping Email notification.');
    return;
  }

  const welcomeHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fcfbfa;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 40px;">🐝</span>
        <h1 style="color: #d97706; margin: 10px 0 0 0; font-size: 24px;">Selamat Datang di BeeChat!</h1>
      </div>
      <p style="color: #333333; font-size: 16px; line-height: 1.5;">Halo <strong>${name}</strong>,</p>
      <p style="color: #333333; font-size: 16px; line-height: 1.5;">
        Akun Anda telah berhasil terdaftar di <strong>BeeChat (Sarang Lebah Terbuka kami)</strong>! 🍯
      </p>
      <p style="color: #333333; font-size: 16px; line-height: 1.5;">
        Ayo mulai masuk ke aplikasi, buat sarang obrolan baru, dan mulailah terbang bersama seluruh koloni lebah pekerja lainnya.
      </p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
      <p style="color: #777777; font-size: 12px; text-align: center;">
        Pesan otomatis dari BeeChat App v${process.env.APP_VERSION || '1.0'} • Tetap manis dan produktif!
      </p>
    </div>
  `;

  try {
    await mailTransporter.sendMail({
      from: `"${process.env.APP_NAME || 'BeeChat'}" <no-reply@beechat.com>`,
      to: email,
      subject: `Selamat Bergabung di BeeChat, ${name}! 🐝`,
      html: welcomeHtml,
    });
    console.log(`Email notification successfully sent to ${email}`);
  } catch (err) {
    console.error('Failed to send Email notification:', err);
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', apiInitialized: !!ai });
});

// Get app name and version configuration from environment
app.get('/api/config', (req, res) => {
  res.json({
    appName: process.env.APP_NAME || 'BeeChat',
    appVersion: process.env.APP_VERSION || '1.0.0'
  });
});

// --- DATABASE CRUD ROUTES ---

// Sync User
app.post('/api/users/sync', async (req, res) => {
  const { id, name, username, avatar, bio, email, phone, isOnline, lastSeen, coverPhoto } = req.body;
  try {
    // If user has a default mockup ID, seed a default password hash if not set yet
    const defaultMockups = ['user_queen', 'dan', 'buzz', 'bob'];
    const defaultHash = 'f974cf978fbcd58b9f91a27e7d8c1c4e73cc359ee5cc73adfd132b4b455b85a3'; // SHA-256 for 'beechat123'

    await pool.query(`
      INSERT INTO users (id, name, username, avatar, bio, email, phone, is_online, last_seen, cover_photo, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        username = EXCLUDED.username,
        avatar = EXCLUDED.avatar,
        bio = EXCLUDED.bio,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        is_online = EXCLUDED.is_online,
        last_seen = EXCLUDED.last_seen,
        cover_photo = EXCLUDED.cover_photo,
        password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash)
    `, [id, name, username, avatar, bio, email, phone, isOnline, lastSeen ? new Date(lastSeen) : null, coverPhoto, defaultMockups.includes(id) ? defaultHash : null]);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Register User
app.post('/api/users/register', async (req, res) => {
  const { id, name, username, avatar, bio, email, phone, passwordHash } = req.body;
  try {
    // 1. Check Username availability (case-insensitive)
    const usernameCheck = await pool.query(
      'SELECT 1 FROM users WHERE LOWER(username) = $1',
      [username.toLowerCase()]
    );
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username sudah terdaftar bzzzt! Coba username lain. 🐝' });
    }

    // 2. Check Email availability (case-insensitive)
    const emailCheck = await pool.query(
      'SELECT 1 FROM users WHERE LOWER(email) = $1',
      [email.toLowerCase()]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Alamat Email sudah terdaftar bzzzt! Silakan gunakan email lain. 🐝' });
    }

    // 3. Check Phone number availability
    const phoneCheck = await pool.query(
      'SELECT 1 FROM users WHERE phone = $1',
      [phone]
    );
    if (phoneCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Nomor Telepon sudah terdaftar bzzzt! Silakan gunakan nomor lain. 🐝' });
    }

    await pool.query(`
      INSERT INTO users (id, name, username, avatar, bio, email, phone, is_online, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
    `, [id, name, username, avatar, bio, email, phone, passwordHash]);

    // Seed an initial status update for the newly registered user
    const initStatusId = `status_init_${id}`;
    await pool.query(`
      INSERT INTO status_updates (id, user_id, user_name, user_avatar, type, content, bg_style, timestamp)
      VALUES ($1, $2, $3, $4, 'text', 'Halo madu-maduku! Saya baru saja hinggap di sarang BeeChat! 🍯🐝', 'bg-gradient-to-r from-amber-500 to-yellow-500', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [initStatusId, id, name, avatar]);

    // Ensure the AI assistant user exists in the database
    await pool.query(`
      INSERT INTO users (id, name, username, avatar, bio, email, phone, is_online, password_hash)
      VALUES ('queen_ai', 'Queen Bee AI Assistant 👑', 'queen_ai', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=150&auto=format&fit=crop&q=80', 'Ratu AI asisten Anda.', 'ai@queen.sweet', '+62 800-BEE-AI', true, 'no-password')
      ON CONFLICT (id) DO NOTHING
    `);

    // Ensure Queen Bee AI has an initial status update seeded
    await pool.query(`
      INSERT INTO status_updates (id, user_id, user_name, user_avatar, type, content, bg_style, timestamp)
      VALUES ('status_queen_ai', 'queen_ai', 'Queen Bee AI Assistant 👑', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=150&auto=format&fit=crop&q=80', 'text', 'Selamat beraktivitas manis! Jangan lupa minum madu hangat hari ini ya! 🍯🐝', 'bg-gradient-to-r from-amber-600 to-orange-500', NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    // Ensure the default global group chat exists in the database
    await pool.query(`
      INSERT INTO chats (id, name, avatar, is_group, is_pinned, is_archived, type, description, last_message, last_message_time)
      VALUES ('chat_hive_group', 'Sarang Madu Utama 🍯', 'https://images.unsplash.com/photo-1473081556163-2a17de81fc97?w=150&auto=format&fit=crop&q=80', true, false, false, 'group', 'Grup utama koordinasi seluruh lebah pekerja untuk pengumpulan nektar bunga.', 'Selamat bergabung di sarang utama!', NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    // 1. Automatically add new user to the global group chat
    await pool.query(`
      INSERT INTO chat_members (chat_id, user_id)
      VALUES ('chat_hive_group', $1)
      ON CONFLICT DO NOTHING
    `, [id]);

    // 2. Automatically create a private AI chat for this new user
    const aiChatId = `chat_queen_ai_${id}`;
    await pool.query(`
      INSERT INTO chats (id, name, avatar, is_group, is_pinned, is_archived, type, description, last_message, last_message_time)
      VALUES ($1, 'Queen Bee AI Assistant 👑', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=150&auto=format&fit=crop&q=80', false, true, false, 'ai', 'Ratu Lebah AI siap membantumu menulis pesan, menerjemahkan, atau merangkum obrolan! Buzz!', 'Halo manis! 🐝 Ratu Lebah di sini. Ada yang bisa kubantu di sarang hari ini? 🍯', NOW())
      ON CONFLICT DO NOTHING
    `, [aiChatId]);

    // Add memberships for both the new user and queen_ai to this private AI chat
    await pool.query(`
      INSERT INTO chat_members (chat_id, user_id)
      VALUES ($1, $2), ($1, 'queen_ai')
      ON CONFLICT DO NOTHING
    `, [aiChatId, id]);

    // Dispatch background welcome notifications
    if (phone) {
      sendWhatsAppNotification(phone, name).catch(err => console.error('Error in background WA dispatch:', err));
    }
    if (email) {
      sendEmailNotification(email, name).catch(err => console.error('Error in background email dispatch:', err));
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Login User
app.post('/api/users/login', async (req, res) => {
  const { identifier, passwordHash } = req.body;
  try {
    const userRes = await pool.query(
      'SELECT * FROM users WHERE id = $1 OR username = $1 OR email = $1 OR phone = $1',
      [identifier.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan bzzzt! Silakan daftar akun baru. 🐝' });
    }

    const user = userRes.rows[0];

    // If password_hash is not set (null or empty) for mock users, set it to the default 'beechat123' hash
    const defaultHash = 'f974cf978fbcd58b9f91a27e7d8c1c4e73cc359ee5cc73adfd132b4b455b85a3'; // 'beechat123'
    const storedHash = (user.password_hash && user.password_hash.trim() !== '') ? user.password_hash : defaultHash;

    if (storedHash !== passwordHash) {
      return res.status(401).json({ error: 'Kata sandi salah bzzzt! Coba kata sandi default: beechat123 🐝' });
    }

    // Set online status
    await pool.query('UPDATE users SET is_online = true WHERE id = $1', [user.id]);

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        email: user.email,
        phone: user.phone,
        isOnline: true,
        coverPhoto: user.cover_photo
      }
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET user profile
app.get('/api/users/profile', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }
  try {
    // Automatically clean up inactive online users (haven't pinged in 15 seconds)
    await pool.query(`
      UPDATE users 
      SET is_online = false, last_seen = last_active 
      WHERE is_online = true AND last_active < CURRENT_TIMESTAMP - INTERVAL '15 seconds'
    `);

    const userRes = await pool.query(
      'SELECT id, name, username, avatar, bio, email, phone, is_online as "isOnline", last_seen as "lastSeen", cover_photo as "coverPhoto" FROM users WHERE id = $1',
      [String(userId)]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(userRes.rows[0]);
  } catch (err: any) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST user ping (heartbeat)
app.post('/api/users/ping', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }
  try {
    // Automatically clean up inactive online users (haven't pinged in 15 seconds)
    await pool.query(`
      UPDATE users 
      SET is_online = false, last_seen = last_active 
      WHERE is_online = true AND last_active < CURRENT_TIMESTAMP - INTERVAL '15 seconds'
    `);

    await pool.query(
      'UPDATE users SET last_active = CURRENT_TIMESTAMP, is_online = true WHERE id = $1',
      [String(userId)]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error pinging user status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Search Users
app.get('/api/users/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.json([]);
  }
  try {
    const searchVal = `%${q}%`;
    const usersRes = await pool.query(`
      SELECT id, name, username, email, phone, avatar
      FROM users
      WHERE (name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
      LIMIT 20
    `, [searchVal]);
    res.json(usersRes.rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get Chats
app.get('/api/chats', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.json([]);
  }
  const uId = String(userId);
  if (dbCache.chats[uId]) {
    return res.json(dbCache.chats[uId]);
  }
  try {
    const queryText = `
      SELECT DISTINCT c.* FROM chats c
      JOIN chat_members cm ON c.id = cm.chat_id
      WHERE cm.user_id = $1
    `;
    const chatsRes = await pool.query(queryText, [uId]);
    const chats: any[] = [];
    for (const row of chatsRes.rows) {
      const membersRes = await pool.query('SELECT user_id FROM chat_members WHERE chat_id = $1', [row.id]);
      chats.push({
        id: row.id,
        name: row.name,
        avatar: row.avatar,
        isGroup: row.is_group,
        isPinned: row.is_pinned,
        isArchived: row.is_archived,
        type: row.type,
        description: row.description,
        lastMessage: row.last_message,
        lastMessageTime: row.last_message_time ? new Date(row.last_message_time).toISOString() : undefined,
        unreadCount: 0,
        members: membersRes.rows.map((m: any) => m.user_id),
        typingUserIds: []
      });
    }
    dbCache.chats[uId] = chats;
    res.json(chats);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create Chat
app.post('/api/chats', async (req, res) => {
  const { id, name, avatar, isGroup, isPinned, isArchived, type, description, members, lastMessage, lastMessageTime } = req.body;
  try {
    await pool.query(`
      INSERT INTO chats (id, name, avatar, is_group, is_pinned, is_archived, type, description, last_message, last_message_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING
    `, [id, name, avatar, isGroup, isPinned, isArchived, type, description, lastMessage, lastMessageTime ? new Date(lastMessageTime) : null]);
    
    if (members && Array.isArray(members)) {
      for (const userId of members) {
        await pool.query(`
          INSERT INTO users (id, name, username)
          VALUES ($1, $1, $1)
          ON CONFLICT (id) DO NOTHING
        `, [userId]);

        await pool.query(`
          INSERT INTO chat_members (chat_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [id, userId]);
      }
    }
    invalidateChatsCache();
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get Messages
app.get('/api/messages', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.json([]);
  }
  const uId = String(userId);
  if (dbCache.messages[uId]) {
    return res.json(dbCache.messages[uId]);
  }
  try {
    // Check if there are any pending 'sent' messages first to avoid lock contention
    const pendingSent = await pool.query(`
      SELECT 1 FROM messages m
      JOIN chat_members cm ON m.chat_id = cm.chat_id
      WHERE cm.user_id = $1 AND m.sender_id != $1 AND m.status = 'sent'
      LIMIT 1
    `, [uId]);

    if (pendingSent.rows.length > 0) {
      await pool.query(`
        UPDATE messages
        SET status = 'delivered'
        FROM chat_members cm
        WHERE messages.chat_id = cm.chat_id
          AND cm.user_id = $1
          AND messages.sender_id != $1
          AND messages.status = 'sent'
      `, [uId]);
      invalidateMessagesCache();
    }

    const queryText = `
      SELECT DISTINCT m.* FROM messages m
      JOIN chat_members cm ON m.chat_id = cm.chat_id
      WHERE cm.user_id = $1
      ORDER BY m.timestamp ASC
    `;
    const messagesRes = await pool.query(queryText, [uId]);
    
    if (messagesRes.rows.length === 0) {
      dbCache.messages[uId] = [];
      return res.json([]);
    }

    const messageIds = messagesRes.rows.map((r: any) => r.id);

    // Batch fetch all poll_options for these messages in ONE query
    const allOptionsRes = await pool.query(
      'SELECT * FROM poll_options WHERE message_id = ANY($1::text[])',
      [messageIds]
    );

    // Batch fetch all poll_votes in ONE query
    const optionIds = allOptionsRes.rows.map((o: any) => o.id);
    let allVotesMap: Record<string, string[]> = {};
    if (optionIds.length > 0) {
      const allVotesRes = await pool.query(
        'SELECT option_id, user_id FROM poll_votes WHERE option_id = ANY($1::text[])',
        [optionIds]
      );
      for (const v of allVotesRes.rows) {
        if (!allVotesMap[v.option_id]) allVotesMap[v.option_id] = [];
        allVotesMap[v.option_id].push(v.user_id);
      }
    }

    // Batch fetch all reactions in ONE query
    const allReactionsRes = await pool.query(`
      SELECT message_id, emoji, ARRAY_AGG(user_id) as user_ids
      FROM message_reactions
      WHERE message_id = ANY($1::text[])
      GROUP BY message_id, emoji
    `, [messageIds]);

    // Build lookup maps
    const optionsMap: Record<string, any[]> = {};
    for (const opt of allOptionsRes.rows) {
      if (!optionsMap[opt.message_id]) optionsMap[opt.message_id] = [];
      optionsMap[opt.message_id].push({
        id: opt.id,
        text: opt.text,
        votes: allVotesMap[opt.id] || []
      });
    }

    const reactionsMap: Record<string, any[]> = {};
    for (const r of allReactionsRes.rows) {
      if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
      reactionsMap[r.message_id].push({ emoji: r.emoji, userIds: r.user_ids });
    }

    // Assemble messages
    const messages: any[] = messagesRes.rows.map((row: any) => ({
      id: row.id,
      chatId: row.chat_id,
      senderId: row.sender_id,
      text: row.text,
      type: row.type,
      timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : '',
      status: row.status,
      mediaUrl: row.media_url || undefined,
      fileName: row.file_name || undefined,
      fileSize: row.file_size || undefined,
      duration: row.duration || undefined,
      pollQuestion: row.poll_question || undefined,
      pollOptions: optionsMap[row.id] || undefined,
      reactions: reactionsMap[row.id] || [],
      replyToId: row.reply_to_id || undefined,
      replyToText: row.reply_to_text || undefined
    }));

    dbCache.messages[uId] = messages;
    res.json(messages);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Send Message
app.post('/api/messages', async (req, res) => {
  const { id, chatId, senderId, text, type, timestamp, status, mediaUrl, fileName, fileSize, duration, pollQuestion, pollOptions, replyToId, replyToText } = req.body;
  try {
    await pool.query(`
      INSERT INTO users (id, name, username)
      VALUES ($1, $1, $1)
      ON CONFLICT (id) DO NOTHING
    `, [senderId]);

    await pool.query(`
      INSERT INTO messages (id, chat_id, sender_id, text, type, timestamp, status, media_url, file_name, file_size, duration, poll_question, reply_to_id, reply_to_text)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [id, chatId, senderId, text, type, timestamp ? new Date(timestamp) : new Date(), status, mediaUrl, fileName, fileSize, duration, pollQuestion, replyToId, replyToText]);

    let displayLastMsg = text;
    if (type === 'poll') displayLastMsg = `📊 Jajak Pendapat: ${pollQuestion}`;
    if (type === 'image') displayLastMsg = '📷 Foto baru';
    if (type === 'voice') displayLastMsg = '🎤 Pesan suara';
    if (type === 'sticker') displayLastMsg = '🐝 Stiker';

    await pool.query(`
      UPDATE chats 
      SET last_message = $1, last_message_time = $2 
      WHERE id = $3
    `, [displayLastMsg, timestamp ? new Date(timestamp) : new Date(), chatId]);

    if (pollOptions && Array.isArray(pollOptions)) {
      for (const opt of pollOptions) {
        await pool.query(`
          INSERT INTO poll_options (id, message_id, text)
          VALUES ($1, $2, $3)
        `, [opt.id, id, opt.text]);
      }
    }
    invalidateMessagesCache();
    invalidateChatsCache();
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST mark messages as read
app.post('/api/messages/read', async (req, res) => {
  const { chatId, userId } = req.body;
  if (!chatId || !userId) {
    return res.status(400).json({ error: 'Missing chatId or userId parameter' });
  }
  try {
    const pendingRead = await pool.query(`
      SELECT 1 FROM messages
      WHERE chat_id = $1 AND sender_id != $2 AND status IN ('sent', 'delivered')
      LIMIT 1
    `, [chatId, userId]);

    if (pendingRead.rows.length > 0) {
      const updateRes = await pool.query(`
        UPDATE messages
        SET status = 'read'
        WHERE chat_id = $1
          AND sender_id != $2
          AND status IN ('sent', 'delivered')
        RETURNING id
      `, [chatId, userId]);

      if (updateRes.rows.length > 0) {
        invalidateMessagesCache();
        invalidateChatsCache();
      }
      return res.json({ success: true, count: updateRes.rows.length });
    }
    
    res.json({ success: true, count: 0 });
  } catch (err: any) {
    console.error('Error marking messages as read:', err);
    res.status(500).json({ error: err.message });
  }
});

// Toggle Vote
app.post('/api/messages/:messageId/vote', async (req, res) => {
  const { optionId, userId } = req.body;
  try {
    await pool.query(`
      INSERT INTO users (id, name, username)
      VALUES ($1, $1, $1)
      ON CONFLICT (id) DO NOTHING
    `, [userId]);

    const checkRes = await pool.query('SELECT 1 FROM poll_votes WHERE option_id = $1 AND user_id = $2', [optionId, userId]);
    if (checkRes.rows.length > 0) {
      await pool.query('DELETE FROM poll_votes WHERE option_id = $1 AND user_id = $2', [optionId, userId]);
    } else {
      await pool.query('INSERT INTO poll_votes (option_id, user_id) VALUES ($1, $2)', [optionId, userId]);
    }
    invalidateMessagesCache();
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Toggle Reaction
app.post('/api/messages/:messageId/react', async (req, res) => {
  const { messageId } = req.params;
  const { emoji, userId } = req.body;
  try {
    await pool.query(`
      INSERT INTO users (id, name, username)
      VALUES ($1, $1, $1)
      ON CONFLICT (id) DO NOTHING
    `, [userId]);

    const checkRes = await pool.query('SELECT 1 FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3', [messageId, userId, emoji]);
    if (checkRes.rows.length > 0) {
      await pool.query('DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3', [messageId, userId, emoji]);
    } else {
      await pool.query('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)', [messageId, userId, emoji]);
    }
    invalidateMessagesCache();
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET stickers (global + personal)
app.get('/api/stickers', async (req, res) => {
  const { userId } = req.query;
  try {
    const queryRes = await pool.query(
      'SELECT id, url, user_id as "userId", label FROM stickers WHERE user_id IS NULL OR user_id = $1 ORDER BY id ASC',
      [userId || '']
    );
    res.json(queryRes.rows);
  } catch (err: any) {
    console.error('Error fetching stickers:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST sticker (upload new kustom)
app.post('/api/stickers', async (req, res) => {
  const { url, userId, label } = req.body;
  try {
    const queryRes = await pool.query(
      'INSERT INTO stickers (url, user_id, label) VALUES ($1, $2, $3) RETURNING id, url, user_id as "userId", label',
      [url, userId || null, label || 'Kustom']
    );
    res.json(queryRes.rows[0]);
  } catch (err: any) {
    console.error('Error saving sticker:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get Status
app.get('/api/status', async (req, res) => {
  if (dbCache.status) {
    return res.json(dbCache.status);
  }
  try {
    const statusRes = await pool.query(`
      SELECT s.*, u.name as current_user_name, u.avatar as current_user_avatar 
      FROM status_updates s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.timestamp DESC
    `);

    if (statusRes.rows.length === 0) {
      dbCache.status = [];
      return res.json([]);
    }

    const statusIds = statusRes.rows.map((r: any) => r.id);
    const viewsRes = await pool.query(`
      SELECT status_id, user_id 
      FROM status_views 
      WHERE status_id = ANY($1::text[])
    `, [statusIds]);

    const viewsMap: Record<string, string[]> = {};
    for (const v of viewsRes.rows) {
      if (!viewsMap[v.status_id]) viewsMap[v.status_id] = [];
      viewsMap[v.status_id].push(v.user_id);
    }

    const list = statusRes.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.current_user_name || row.user_name,
      userAvatar: row.current_user_avatar || row.user_avatar,
      type: row.type,
      content: row.content,
      bgStyle: row.bg_style,
      timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : '',
      viewedBy: viewsMap[row.id] || []
    }));
    dbCache.status = list;
    res.json(list);
  } catch (err: any) {
    console.error('Error fetching statuses:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add Status
app.post('/api/status', async (req, res) => {
  const { id, userId, userName, userAvatar, type, content, bgStyle, timestamp } = req.body;
  try {
    await pool.query(`
      INSERT INTO users (id, name, username)
      VALUES ($1, $2, $2)
      ON CONFLICT (id) DO NOTHING
    `, [userId, userName]);

    await pool.query(`
      INSERT INTO status_updates (id, user_id, user_name, user_avatar, type, content, bg_style, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, userId, userName, userAvatar, type, content, bgStyle, timestamp ? new Date(timestamp) : new Date()]);
    
    invalidateStatusCache();
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get Calls
app.get('/api/calls', async (req, res) => {
  try {
    const callsRes = await pool.query('SELECT * FROM call_logs ORDER BY timestamp DESC');
    res.json(callsRes.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      avatar: row.avatar,
      type: row.type,
      isOutgoing: row.is_outgoing,
      timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : '',
      status: row.status,
      duration: row.duration
    })));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Add Call Log
app.post('/api/calls', async (req, res) => {
  const { id, userId, userName, avatar, type, isOutgoing, timestamp, status, duration } = req.body;
  try {
    await pool.query(`
      INSERT INTO call_logs (id, user_id, user_name, avatar, type, is_outgoing, timestamp, status, duration)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [id, userId, userName, avatar, type, isOutgoing, timestamp ? new Date(timestamp) : new Date(), status, duration]);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get Communities
app.get('/api/communities', async (req, res) => {
  try {
    const commRes = await pool.query('SELECT * FROM communities');
    const list: any[] = [];
    for (const row of commRes.rows) {
      const annRes = await pool.query('SELECT * FROM community_announcements WHERE community_id = $1 ORDER BY timestamp DESC', [row.id]);
      list.push({
        id: row.id,
        name: row.name,
        description: row.description,
        avatar: row.avatar,
        groupCount: row.group_count,
        memberCount: row.member_count,
        announcements: annRes.rows.map((ann: any) => ({
          id: ann.id,
          text: ann.text,
          timestamp: ann.timestamp ? new Date(ann.timestamp).toISOString() : ''
        }))
      });
    }
    res.json(list);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Add Community
app.post('/api/communities', async (req, res) => {
  const { id, name, description, avatar, groupCount, memberCount } = req.body;
  try {
    await pool.query(`
      INSERT INTO communities (id, name, description, avatar, group_count, member_count)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, name, description, avatar, groupCount, memberCount]);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Add Community Announcement
app.post('/api/communities/:commId/announcements', async (req, res) => {
  const { commId } = req.params;
  const { id, text, timestamp } = req.body;
  try {
    await pool.query(`
      INSERT INTO community_announcements (id, community_id, text, timestamp)
      VALUES ($1, $2, $3, $4)
    `, [id, commId, text, timestamp ? new Date(timestamp) : new Date()]);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Chat with Queen Bee AI Assistant
app.post('/api/ai/chat', async (req, res) => {
  const { messages, currentUserId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages history is required.' });
  }

  const prompt = `You are "Queen Bee AI", a delightful, wise, and helpful AI assistant for the BeeChat app (a WhatsApp-inspired chatting platform with a warm honeycomb bee-theme).
  - Your character: Speak in a sweet, warm, motherly, and playful bee queen persona.
  - Use bee-related words naturally (e.g., buzz, honey, sweet, hive, comb, colony, pollen, busy bee, honeycomb, flower, swarm). Keep it balanced and extremely fun!
  - You are chatting in Indonesian (or match the language the user is using).
  - Answer the user's latest query accurately and warmly.
  - Keep responses relatively concise, similar to a chat message (1-3 paragraphs max).

  Chat History:
  ${messages
    .slice(-10) // last 10 messages for context
    .map((m: any) => `${m.senderName}: ${m.text}`)
    .join('\n')}

  Latest Message:
  User: ${messages[messages.length - 1]?.text || ''}

  Queen Bee AI response:`;

  let simulatedFallback = false;
  if (ai) {
    try {
      const responseText = await generateAiContentWithFallback(prompt);
      return res.json({ text: responseText || 'Bzzzt! Honey, my wings are a bit tired today. Can you repeat that?' });
    } catch (err: any) {
      console.warn('All Gemini models failed in chat, falling back to simulation:', err.message || err);
      simulatedFallback = true;
    }
  }

  if (!ai || simulatedFallback) {
    // Simulated offline response matching the persona
    const lastMsg = messages[messages.length - 1]?.text || '';
    let simText = `Bzzzt! Wah, pertanyaanmu menarik sekali, sayang! 🍯 Sebagai Ratu Lebah di BeeChat, aku selalu senang mendengar kabarmu. Semoga hari ini penuh dengan nektar kebahagiaan! Tuliskan pesan lain agar sarang kita makin ramai! 🐝💛`;
    
    if (lastMsg.toLowerCase().includes('halo') || lastMsg.toLowerCase().includes('hi')) {
      simText = `Halo manis! 🐝 Ratu Lebah di sini menyapamu hangat di sarang BeeChat! Ada yang bisa kubantu hari ini? Madu segar atau tips membuat hari-harimu jadi lebih produktif? Buzz!`;
    } else if (lastMsg.toLowerCase().includes('siapa')) {
      simText = `Aku adalah Queen Bee AI, penguasa sarang madu BeeChat ini! Tugas utamaku adalah membantu para lebah pekerja seperti kamu agar tetap produktif, ceria, dan terus menghasilkan madu terbaik! 🍯✨`;
    } else if (lastMsg.toLowerCase().includes('makan') || lastMsg.toLowerCase().includes('lapar')) {
      simText = `Bzzzt! Lapar ya? Coba bayangkan nektar bunga segar yang manis dan hangat dari taman bunga BeeChat! Jangan lupa makan yang manis-manis hari ini agar energimu terisi penuh! 🌸🍯`;
    }
    
    return res.json({ text: simText, simulated: true });
  }
});

// 3. Message Translation
app.post('/api/ai/translate', async (req, res) => {
  const { text, targetLang } = req.body;

  if (!text || !targetLang) {
    return res.status(400).json({ error: 'Text and target language are required.' });
  }

  const prompt = `Translate the following message into "${targetLang}". Do not add any preamble, explanation, or quotes. Just output the clean translated text:

Message: ${text}

Translation:`;

  if (ai) {
    try {
      const responseText = await generateAiContentWithFallback(prompt);
      return res.json({ translatedText: responseText?.trim() });
    } catch (err: any) {
      console.error('Translation error:', err);
      return res.status(500).json({ error: err.message });
    }
  } else {
    // Simulation translate
    const simTranslations: Record<string, string> = {
      indonesian: `[Terjemahan] ${text}`,
      english: `[English translation of] "${text}"`,
      japanese: `[日本語訳] ${text}`,
      arabic: `[الترجمة العربية] ${text}`,
      spanish: `[Traducción al español de] ${text}`
    };
    const translated = simTranslations[targetLang.toLowerCase()] || `[Translated to ${targetLang}]: ${text}`;
    return res.json({ translatedText: translated, simulated: true });
  }
});

// 4. Chat Summarize helper
app.post('/api/ai/summarize', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages are required for summary.' });
  }

  const chatContent = messages
    .filter((m) => m.type === 'text')
    .slice(-30) // summarize last 30 messages
    .map((m) => `${m.senderName}: ${m.text}`)
    .join('\n');

  const prompt = `You are BeeChat Summarizer AI. Take the following conversation history and create a sweet, bullet-pointed summary under the title "Honeycomb Summary 🍯".
  - Summarize key topics discussed.
  - Point out any actionable items.
  - Keep the tone warm, clear, and slightly bee-themed.
  - Answer in the same language as the chat (Indonesian by default).

  Conversation History:
  ${chatContent}

  Summary:`;

  if (ai) {
    try {
      const responseText = await generateAiContentWithFallback(prompt);
      return res.json({ summary: responseText });
    } catch (err: any) {
      console.error('Summary error:', err);
      return res.status(500).json({ error: err.message });
    }
  } else {
    // Simulated summary
    const summary = `### Honeycomb Summary 🍯\n\n- **Saling Menyapa**: Para lebah sedang aktif bertegur sapa di dalam obrolan.\n- **Sarang Hangat**: Terlihat pembicaraan yang ceria tentang kehidupan sehari-hari.\n- **Rencana Berikutnya**: Mengisi cangkir dengan nektar segar dan bersiap untuk beralih ke tugas selanjutnya!\n\n*Bzzzt! Aktifkan GEMINI_API_KEY di Secrets untuk mendapatkan rangkuman AI asli yang super pintar dari seluruh pesanmu!* 🐝`;
    return res.json({ summary, simulated: true });
  }
});

// 5. Smart Reply Suggester
app.post('/api/ai/suggest', async (req, res) => {
  const { lastMessageText } = req.body;

  if (!lastMessageText) {
    return res.json({ suggestions: ['Halo juga! 🐝', 'Bzzzt, ya?', '🍯 Luar biasa!'] });
  }

  const prompt = `Based on the following message received in a chat, generate exactly 3 short, responsive, and natural smart reply suggestions.
  - The suggestions should be short (1-5 words each).
  - One option should be friendly, one professional/polite, and one slightly bee-themed or energetic.
  - Output as a simple JSON array of strings: ["suggestion 1", "suggestion 2", "suggestion 3"].
  - Respond in the language of the input (usually Indonesian).

  Input Message: "${lastMessageText}"

  JSON Output:`;

  if (ai) {
    try {
      const responseText = await generateAiContentWithFallback(prompt, 'application/json');
      const suggestions = JSON.parse(responseText || '[]');
      return res.json({ suggestions });
    } catch (err) {
      console.error('Suggest error:', err);
      // Fallback
      return res.json({
        suggestions: [
          'Oke mantap! 🍯',
          'Siaapp! 🐝',
          'Ayo kumpul!'
        ]
      });
    }
  } else {
    // Generate simple simulation replies
    let replies = ['Wah, asyik! 🍯', 'Bzzzt, setuju sekali!', 'Ada apa nih? 🐝'];
    if (lastMessageText.toLowerCase().includes('halo') || lastMessageText.toLowerCase().includes('hi')) {
      replies = ['Halo manis! 🐝', 'Hai juga! 🍯', 'Buzz! Ada apa?'];
    } else if (lastMessageText.toLowerCase().includes('apa kabar') || lastMessageText.toLowerCase().includes('how are you')) {
      replies = ['Kabar baik! 🍯', 'Sehat luar biasa!', 'Sibuk tapi seru! 🐝'];
    } else if (lastMessageText.toLowerCase().includes('tanya') || lastMessageText.toLowerCase().includes('mau nanya')) {
      replies = ['Tanya apa sayang? 🌸', 'Silakan bzzzt!', 'Tentu, katakan saja!'];
    }
    return res.json({ suggestions: replies, simulated: true });
  }
});

// 6. Text-to-Speech (TTS)
app.post('/api/ai/speech', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: `Say with a sweet, cheerful, clear voice: ${text}` }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return res.json({ audio: base64Audio });
      } else {
        return res.status(500).json({ error: 'No audio generated by the model.' });
      }
    } catch (err: any) {
      console.error('TTS error:', err);
      return res.status(500).json({ error: err.message });
    }
  } else {
    // Offline simulation doesn't return real voice, but the client can use standard web synthesis
    return res.json({ simulated: true });
  }
});

// ----------------------------------------------------
// VITE DEV SERVER AND PRODUCTION SERVING
// ----------------------------------------------------

async function startServer() {
  await initDb();
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite development middleware mounted.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production static file serving initialized.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BeeChat server is actively buzzing on http://localhost:${PORT}`);
  });
}

startServer();
