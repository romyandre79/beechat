import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { Server as SocketIOServer } from 'socket.io';
import mysql from 'mysql2/promise';

import {
  pool,
  mysqlPool,
  isDatabaseOffline,
  setDatabaseOffline,
  dbQuery,
  dbConnect,
  initDb,
  ensureMySQLDatabaseExists,
  localDb,
  seedLocalDbMockup,
  parseDbDate
} from './db';

import {
  dbCache,
  activeUserIds,
  invalidateChatsCache,
  invalidateMessagesCache,
  invalidateStatusCache,
  invalidateCallsCache,
  invalidateCommunitiesCache,
  refreshStatusCache,
  refreshChatsCache,
  refreshMessagesCache,
  refreshCallsCache,
  refreshCommunitiesCache
} from './cache';

import {
  sendWhatsAppNotification,
  sendEmailNotification
} from './notifications';

import {
  ai,
  generateAiContentWithFallback
} from './ai';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
const PORT = 3000;

// Track online socket connections: userId -> socketId
const userSockets = new Map<string, string>();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Global CORS Middleware for API and Static uploads
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-file-name');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

// Serve uploaded static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Streaming octet-stream upload endpoint to handle large files (up to 5GB)
app.post('/api/upload', (req, res) => {
  const fileName = req.headers['x-file-name'] as string;
  if (!fileName) {
    return res.status(400).json({ error: 'Missing x-file-name header' });
  }

  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

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

// --- API ROUTES ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', apiInitialized: !!ai });
});

// ICE Server Configuration (TURN/STUN)
app.get('/api/ice-config', (req, res) => {
  const turnHost = process.env.TURN_HOST || '';
  const turnPort = process.env.TURN_PORT || '3478';
  const turnUsername = process.env.TURN_USERNAME || '';
  const turnPassword = process.env.TURN_PASSWORD || '';

  const iceServers: any[] = [];

  if (turnHost) {
    iceServers.push(
      { urls: `stun:${turnHost}:${turnPort}` },
      {
        urls: `turn:${turnHost}:${turnPort}`,
        username: turnUsername,
        credential: turnPassword
      },
      {
        urls: `turn:${turnHost}:${turnPort}?transport=tcp`,
        username: turnUsername,
        credential: turnPassword
      }
    );
  }

  // Always include Google STUN as fallback
  iceServers.push({ urls: 'stun:stun.l.google.com:19302' });

  res.json({ iceServers });
});

// Config
app.get('/api/config', (req, res) => {
  res.json({
    appName: process.env.APP_NAME || 'BeeChat',
    appVersion: process.env.APP_VERSION || '1.0.0'
  });
});

// Sync User
app.post('/api/users/sync', async (req, res) => {
  const { id, name, username, avatar, bio, email, phone, isOnline, lastSeen, coverPhoto } = req.body;
  try {
    const defaultMockups = ['user_queen', 'dan', 'buzz', 'bob'];
    const defaultHash = 'f974cf978fbcd58b9f91a27e7d8c1c4e73cc359ee5cc73adfd132b4b455b85a3'; // 'beechat123'

    const syncEmail = (email && typeof email === 'string' && email.trim() !== '') ? email.toLowerCase().trim() : null;
    const syncPhone = (phone && typeof phone === 'string' && phone.trim() !== '') ? phone.trim() : null;

    await dbQuery(`
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
    `, [id, name, username, avatar, bio, syncEmail, syncPhone, isOnline, lastSeen ? new Date(lastSeen) : null, coverPhoto, defaultMockups.includes(id) ? defaultHash : null]);
    invalidateChatsCache();
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
    const usernameCheck = await dbQuery(
      'SELECT 1 FROM users WHERE LOWER(username) = $1',
      [username.toLowerCase()]
    );
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username sudah terdaftar bzzzt! Coba username lain. 🐝' });
    }

    if (email && email.trim() !== '') {
      const emailCheck = await dbQuery(
        'SELECT 1 FROM users WHERE LOWER(email) = $1',
        [email.toLowerCase().trim()]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Alamat Email sudah terdaftar bzzzt! Silakan gunakan email lain. 🐝' });
      }
    }

    if (phone && phone.trim() !== '') {
      const phoneCheck = await dbQuery(
        'SELECT 1 FROM users WHERE phone = $1',
        [phone.trim()]
      );
      if (phoneCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Nomor Telepon sudah terdaftar bzzzt! Silakan gunakan nomor lain. 🐝' });
      }
    }

    const userEmail = (email && email.trim() !== '') ? email.toLowerCase().trim() : null;
    const userPhone = (phone && phone.trim() !== '') ? phone.trim() : null;

    await dbQuery(`
      INSERT INTO users (id, name, username, avatar, bio, email, phone, is_online, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
    `, [id, name, username, avatar, bio, userEmail, userPhone, passwordHash]);

    const initStatusId = `status_init_${id}`;
    await dbQuery(`
      INSERT INTO status_updates (id, user_id, user_name, user_avatar, type, content, bg_style, timestamp)
      VALUES ($1, $2, $3, $4, 'text', 'Halo madu-maduku! Saya baru saja hinggap di sarang BeeChat! 🍯🐝', 'bg-gradient-to-r from-amber-500 to-yellow-500', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [initStatusId, id, name, avatar]);

    await dbQuery(`
      INSERT INTO users (id, name, username, avatar, bio, email, phone, is_online, password_hash)
      VALUES ('queen_ai', 'Queen Bee AI Assistant 👑', 'queen_ai', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=150&auto=format&fit=crop&q=80', 'Ratu AI asisten Anda.', 'ai@queen.sweet', '+62 800-BEE-AI', true, 'no-password')
      ON CONFLICT (id) DO NOTHING
    `);

    await dbQuery(`
      INSERT INTO status_updates (id, user_id, user_name, user_avatar, type, content, bg_style, timestamp)
      VALUES ('status_queen_ai', 'queen_ai', 'Queen Bee AI Assistant 👑', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=150&auto=format&fit=crop&q=80', 'text', 'Selamat beraktivitas manis! Jangan lupa minum madu hangat hari ini ya! 🍯🐝', 'bg-gradient-to-r from-amber-600 to-orange-500', NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    await dbQuery(`
      INSERT INTO chats (id, name, avatar, is_group, is_pinned, is_archived, type, description, last_message, last_message_time)
      VALUES ('chat_hive_group', 'Sarang Madu Utama 🍯', 'https://images.unsplash.com/photo-1473081556163-2a17de81fc97?w=150&auto=format&fit=crop&q=80', true, false, false, 'group', 'Grup utama koordinasi seluruh lebah pekerja untuk pengumpulan nektar bunga.', 'Selamat bergabung di sarang utama!', NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    await dbQuery(`
      INSERT INTO chat_members (chat_id, user_id)
      VALUES ('chat_hive_group', $1)
      ON CONFLICT DO NOTHING
    `, [id]);

    const aiChatId = `chat_queen_ai_${id}`;
    await dbQuery(`
      INSERT INTO chats (id, name, avatar, is_group, is_pinned, is_archived, type, description, last_message, last_message_time)
      VALUES ($1, 'Queen Bee AI Assistant 👑', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=150&auto=format&fit=crop&q=80', false, true, false, 'ai', 'Ratu Lebah AI siap membantumu menulis pesan, menerjemahkan, atau merangkum obrolan! Buzz!', 'Halo manis! 🐝 Ratu Lebah di sini. Ada yang bisa kubantu di sarang hari ini? 🍯', NOW())
      ON CONFLICT DO NOTHING
    `, [aiChatId]);

    await dbQuery(`
      INSERT INTO chat_members (chat_id, user_id)
      VALUES ($1, $2), ($1, 'queen_ai')
      ON CONFLICT DO NOTHING
    `, [aiChatId, id]);

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
    const userRes = await dbQuery(
      'SELECT * FROM users WHERE id = $1 OR username = $1 OR email = $1 OR phone = $1',
      [identifier.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan bzzzt! Silakan daftar akun baru. 🐝' });
    }

    const user = userRes.rows[0];
    const defaultHash = 'f974cf978fbcd58b9f91a27e7d8c1c4e73cc359ee5cc73adfd132b4b455b85a3'; // 'beechat123'
    const storedHash = (user.password_hash && user.password_hash.trim() !== '') ? user.password_hash : defaultHash;

    if (user.is_banned === true || user.is_banned === 1) {
      return res.status(403).json({ error: 'Akun Anda telah ditangguhkan/diblokir oleh admin. 🐝' });
    }

    if (storedHash !== passwordHash) {
      return res.status(401).json({ error: 'Kata sandi salah bzzzt! Coba kata sandi default: beechat123 🐝' });
    }

    await dbQuery('UPDATE users SET is_online = true WHERE id = $1', [user.id]);

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

// GET admin user list
app.get('/api/admin/users', async (req, res) => {
  const { adminId } = req.query;
  if (adminId !== 'raja_hutan') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya admin yang dapat mengakses menu ini. 🐝' });
  }
  try {
    const usersRes = await dbQuery("SELECT id, name, username, avatar, is_banned FROM users WHERE id <> 'system' AND id <> 'queen_ai'");
    const users = usersRes.rows.map((u: any) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      avatar: u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      status: (u.is_banned === true || u.is_banned === 1) ? 'banned' : 'active',
      reports: 0
    }));
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST admin toggle ban user
app.post('/api/admin/users/ban', async (req, res) => {
  const { adminId, targetUserId } = req.body;
  if (adminId !== 'raja_hutan') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya admin yang dapat mengakses menu ini. 🐝' });
  }
  try {
    const userRes = await dbQuery('SELECT is_banned FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    const currentlyBanned = userRes.rows[0].is_banned === true || userRes.rows[0].is_banned === 1;
    const nextBanStatus = !currentlyBanned;
    await dbQuery('UPDATE users SET is_banned = $1, is_online = false WHERE id = $2', [nextBanStatus, targetUserId]);
    res.json({ success: true, isBanned: nextBanStatus });
  } catch (err: any) {
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
    await dbQuery(`
      UPDATE users 
      SET is_online = false, last_seen = last_active 
      WHERE is_online = true AND last_active < CURRENT_TIMESTAMP - INTERVAL '15 seconds'
    `);

    const userRes = await dbQuery(
      'SELECT id, name, username, avatar, bio, email, phone, is_online as "isOnline", last_seen as "lastSeen", cover_photo as "coverPhoto" FROM users WHERE id = $1',
      [String(userId)]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const profile = userRes.rows[0];
    if (profile && profile.lastSeen) {
      profile.lastSeen = parseDbDate(profile.lastSeen);
    }
    res.json(profile);
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
    await dbQuery(`
      UPDATE users 
      SET is_online = false, last_seen = last_active 
      WHERE is_online = true AND last_active < CURRENT_TIMESTAMP - INTERVAL '15 seconds'
    `);

    await dbQuery(
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
    const usersRes = await dbQuery(`
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
  activeUserIds.add(uId);
  res.json(dbCache.chats[uId] || []);
});
// Create Chat
app.post('/api/chats', async (req, res) => {
  const { id, name, avatar, isGroup, isPinned, isArchived, type, description, members, lastMessage, lastMessageTime } = req.body;
  try {
    await dbQuery(`
      INSERT INTO chats (id, name, avatar, is_group, is_pinned, is_archived, type, description, last_message, last_message_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING
    `, [id, name, avatar, isGroup, isPinned, isArchived, type, description, lastMessage, lastMessageTime ? new Date(lastMessageTime) : null]);

    if (members && Array.isArray(members)) {
      for (const userId of members) {
        await dbQuery(`
          INSERT INTO users (id, name, username)
          VALUES ($1, $1, $1)
          ON CONFLICT (id) DO NOTHING
        `, [userId]);

        await dbQuery(`
          INSERT INTO chat_members (chat_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [id, userId]);
      }
    }

    // Immediately refresh cache for all members to prevent disappearance on next poll
    if (members && Array.isArray(members)) {
      for (const userId of members) {
        await refreshChatsCache(String(userId)).catch(() => { });
      }
    } else {
      invalidateChatsCache();
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE chat (clear messages)
app.delete('/api/chats/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  try {
    // Delete message reactions for messages in this chat
    await dbQuery(`DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE chat_id = $1)`, [id]).catch(() => { });
    // Delete poll votes for messages in this chat
    await dbQuery(`DELETE FROM poll_votes WHERE option_id IN (SELECT po.id FROM poll_options po JOIN messages m ON po.message_id = m.id WHERE m.chat_id = $1)`, [id]).catch(() => { });
    // Delete poll options for messages in this chat
    await dbQuery(`DELETE FROM poll_options WHERE message_id IN (SELECT id FROM messages WHERE chat_id = $1)`, [id]).catch(() => { });
    // Delete all messages in this chat
    await dbQuery('DELETE FROM messages WHERE chat_id = $1', [id]);

    // Reset last message in chat instead of deleting the chat room
    await dbQuery('UPDATE chats SET last_message = NULL, last_message_time = NULL WHERE id = $1', [id]);

    // Directly purge only messages from in-memory cache, keeping the chat
    for (const uId of Object.keys(dbCache.messages)) {
      dbCache.messages[uId] = (dbCache.messages[uId] || []).filter((m: any) => m.chatId !== id);
    }
    // Update the last message inside cached chats
    for (const uId of Object.keys(dbCache.chats)) {
      dbCache.chats[uId] = (dbCache.chats[uId] || []).map((c: any) => c.id === id ? { ...c, lastMessage: null, lastMessageTime: null } : c);
    }

    if (userId) {
      refreshChatsCache(String(userId)).catch(() => { });
      refreshMessagesCache(String(userId)).catch(() => { });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error clearing chat messages:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET chat members
app.get('/api/chats/:id/members', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await dbQuery(`
      SELECT u.id, u.name, u.username, u.avatar, u.bio, u.is_online as "isOnline", u.last_seen as "lastSeen"
      FROM users u
      JOIN chat_members cm ON u.id = cm.user_id
      WHERE cm.chat_id = $1
    `, [id]);

    const members = result.rows.map((m: any) => {
      if (m.lastSeen) m.lastSeen = parseDbDate(m.lastSeen);
      return m;
    });
    res.json(members);
  } catch (err: any) {
    console.error('Error fetching chat members:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST add chat member
app.post('/api/chats/:id/members', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId parameter' });
  try {
    await dbQuery('INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, userId]);

    // Add a system message: "[User] bergabung ke grup"
    const userRes = await dbQuery('SELECT name FROM users WHERE id = $1', [userId]);
    const userName = userRes.rows[0]?.name || userId;
    const sysMsgId = 'm_sys_' + Date.now();

    await dbQuery(`
      INSERT INTO messages (id, chat_id, sender_id, text, type, timestamp, status)
      VALUES ($1, $2, 'system', $3, 'system', NOW(), 'read')
    `, [sysMsgId, id, `${userName} bergabung ke grup`]);

    // Invalidate caches
    invalidateChatsCache();
    invalidateMessagesCache();

    // Refresh for all members
    const membersRes = await dbQuery('SELECT user_id FROM chat_members WHERE chat_id = $1', [id]);
    for (const mRow of membersRes.rows) {
      refreshChatsCache(mRow.user_id).catch(() => { });
      refreshMessagesCache(mRow.user_id).catch(() => { });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error adding chat member:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE chat member (kick from group)
app.delete('/api/chats/:id/members/:userId', async (req, res) => {
  const { id, userId } = req.params;
  try {
    await dbQuery('DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2', [id, userId]);

    // Add a system message: "[User] dikeluarkan dari grup"
    const userRes = await dbQuery('SELECT name FROM users WHERE id = $1', [userId]);
    const userName = userRes.rows[0]?.name || userId;
    const sysMsgId = 'm_sys_' + Date.now();

    await dbQuery(`
      INSERT INTO messages (id, chat_id, sender_id, text, type, timestamp, status)
      VALUES ($1, $2, 'system', $3, 'system', NOW(), 'read')
    `, [sysMsgId, id, `${userName} dikeluarkan dari grup`]);

    // Invalidate caches
    invalidateChatsCache();
    invalidateMessagesCache();

    // Refresh for all remaining members
    const membersRes = await dbQuery('SELECT user_id FROM chat_members WHERE chat_id = $1', [id]);
    for (const mRow of membersRes.rows) {
      refreshChatsCache(mRow.user_id).catch(() => { });
      refreshMessagesCache(mRow.user_id).catch(() => { });
    }
    // Also refresh for the kicked user
    refreshChatsCache(userId).catch(() => { });
    refreshMessagesCache(userId).catch(() => { });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error removing chat member:', err);
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
  activeUserIds.add(uId);
  res.json(dbCache.messages[uId] || []);
});

// Send Message
app.post('/api/messages', async (req, res) => {
  const { id, chatId, senderId, text, type, timestamp, status, mediaUrl, fileName, fileSize, duration, pollQuestion, pollOptions, replyToId, replyToText } = req.body;
  try {
    await dbQuery(`
      INSERT INTO users (id, name, username)
      VALUES ($1, $1, $1)
      ON CONFLICT (id) DO NOTHING
    `, [senderId]);

    const messageStatus = status === 'sending' ? 'sent' : status;
    await dbQuery(`
      INSERT INTO messages (id, chat_id, sender_id, text, type, timestamp, status, media_url, file_name, file_size, duration, poll_question, reply_to_id, reply_to_text)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [id, chatId, senderId, text, type, timestamp ? new Date(timestamp) : new Date(), messageStatus, mediaUrl, fileName, fileSize, duration, pollQuestion, replyToId, replyToText]);

    let displayLastMsg = text;
    if (type === 'poll') displayLastMsg = `📊 Jajak Pendapat: ${pollQuestion}`;
    if (type === 'image') displayLastMsg = '📷 Foto baru';
    if (type === 'voice') displayLastMsg = '🎤 Pesan suara';
    if (type === 'sticker') displayLastMsg = '🐝 Stiker';

    await dbQuery(`
      UPDATE chats 
      SET last_message = $1, last_message_time = $2 
      WHERE id = $3
    `, [displayLastMsg, timestamp ? new Date(timestamp) : new Date(), chatId]);

    if (pollOptions && Array.isArray(pollOptions)) {
      for (const opt of pollOptions) {
        await dbQuery(`
          INSERT INTO poll_options (id, message_id, text)
          VALUES ($1, $2, $3)
        `, [opt.id, id, opt.text]);
      }
    }
    // Refresh messages and chats cache immediately for all members of this chat
    const membersRes = await dbQuery('SELECT user_id FROM chat_members WHERE chat_id = $1', [chatId]);
    for (const mRow of membersRes.rows) {
      refreshMessagesCache(mRow.user_id).catch(() => { });
      refreshChatsCache(mRow.user_id).catch(() => { });
    }

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
    const pendingRead = await dbQuery(`
      SELECT 1 FROM messages
      WHERE chat_id = $1 AND sender_id != $2 AND status IN ('sent', 'delivered')
      LIMIT 1
    `, [chatId, userId]);

    if (pendingRead.rows.length > 0) {
      const updateRes = await dbQuery(`
        UPDATE messages
        SET status = 'read'
        WHERE chat_id = $1
          AND sender_id != $2
          AND status IN ('sent', 'delivered')
        RETURNING id
      `, [chatId, userId]);

      if (updateRes.rows.length > 0) {
        const membersRes = await dbQuery('SELECT user_id FROM chat_members WHERE chat_id = $1', [chatId]);
        for (const mRow of membersRes.rows) {
          refreshMessagesCache(mRow.user_id).catch(() => { });
          refreshChatsCache(mRow.user_id).catch(() => { });
        }
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
    await dbQuery(`
      INSERT INTO users (id, name, username)
      VALUES ($1, $1, $1)
      ON CONFLICT (id) DO NOTHING
    `, [userId]);

    const checkRes = await dbQuery('SELECT 1 FROM poll_votes WHERE option_id = $1 AND user_id = $2', [optionId, userId]);
    if (checkRes.rows.length > 0) {
      await dbQuery('DELETE FROM poll_votes WHERE option_id = $1 AND user_id = $2', [optionId, userId]);
    } else {
      await dbQuery('INSERT INTO poll_votes (option_id, user_id) VALUES ($1, $2)', [optionId, userId]);
    }

    // Find the chatId of the poll message and refresh cache for all members
    const msgRes = await dbQuery('SELECT chat_id FROM messages WHERE id = (SELECT message_id FROM poll_options WHERE id = $1)', [optionId]);
    if (msgRes.rows.length > 0) {
      const chatId = msgRes.rows[0].chat_id;
      const membersRes = await dbQuery('SELECT user_id FROM chat_members WHERE chat_id = $1', [chatId]);
      for (const mRow of membersRes.rows) {
        refreshMessagesCache(mRow.user_id).catch(() => { });
      }
    } else {
      invalidateMessagesCache();
    }
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
    await dbQuery(`
      INSERT INTO users (id, name, username)
      VALUES ($1, $1, $1)
      ON CONFLICT (id) DO NOTHING
    `, [userId]);

    const checkRes = await dbQuery('SELECT 1 FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3', [messageId, userId, emoji]);
    if (checkRes.rows.length > 0) {
      await dbQuery('DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3', [messageId, userId, emoji]);
    } else {
      await dbQuery('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)', [messageId, userId, emoji]);
    }

    // Find the chatId of the reaction and refresh cache for all members
    const msgRes = await dbQuery('SELECT chat_id FROM messages WHERE id = $1', [messageId]);
    if (msgRes.rows.length > 0) {
      const chatId = msgRes.rows[0].chat_id;
      const membersRes = await dbQuery('SELECT user_id FROM chat_members WHERE chat_id = $1', [chatId]);
      for (const mRow of membersRes.rows) {
        refreshMessagesCache(mRow.user_id).catch(() => { });
      }
    } else {
      invalidateMessagesCache();
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE message
app.delete('/api/messages/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  try {
    await dbQuery('DELETE FROM messages WHERE id = $1', [id]);

    // Directly purge from in-memory cache
    for (const uId of Object.keys(dbCache.messages)) {
      dbCache.messages[uId] = (dbCache.messages[uId] || []).filter((m: any) => m.id !== id);
    }

    if (userId) {
      refreshMessagesCache(String(userId)).catch(() => { });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting message:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST block user
app.post('/api/users/block', async (req, res) => {
  const { userId, blockedUserId } = req.body;
  try {
    await dbQuery('INSERT INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, blockedUserId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error blocking user:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST unblock user
app.post('/api/users/unblock', async (req, res) => {
  const { userId, blockedUserId } = req.body;
  try {
    await dbQuery('DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2', [userId, blockedUserId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error unblocking user:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET blocked users
app.get('/api/users/blocked', async (req, res) => {
  const { userId } = req.query;
  try {
    const result = await dbQuery('SELECT blocked_user_id FROM blocked_users WHERE user_id = $1', [userId]);
    const blockedIds = result.rows.map((row: any) => row.blocked_user_id);
    res.json(blockedIds);
  } catch (err: any) {
    console.error('Error fetching blocked list:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET blocked users details
app.get('/api/users/blocked/details', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId parameter' });
  try {
    const result = await dbQuery(`
      SELECT u.id, u.name, u.username, u.avatar, u.bio
      FROM users u
      JOIN blocked_users bu ON u.id = bu.blocked_user_id
      WHERE bu.user_id = $1
    `, [userId]);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching blocked details:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET stickers (global + personal)
app.get('/api/stickers', async (req, res) => {
  const { userId } = req.query;
  try {
    const queryRes = await dbQuery(
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
    const queryRes = await dbQuery(
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
  res.json(dbCache.status || []);
});

// Add Status
app.post('/api/status', async (req, res) => {
  const { id, userId, userName, userAvatar, type, content, bgStyle, timestamp } = req.body;
  try {
    await dbQuery(`
      INSERT INTO users (id, name, username)
      VALUES ($1, $2, $2)
      ON CONFLICT (id) DO NOTHING
    `, [userId, userName]);

    await dbQuery(`
      INSERT INTO status_updates (id, user_id, user_name, user_avatar, type, content, bg_style, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, userId, userName, userAvatar, type, content, bgStyle, timestamp ? new Date(timestamp) : new Date()]);

    invalidateStatusCache();
    refreshStatusCache();
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get Calls
app.get('/api/calls', async (req, res) => {
  res.json(dbCache.calls || []);
});

app.post('/api/calls', async (req, res) => {
  const { id, userId, userName, avatar, type, isOutgoing, timestamp, status, duration } = req.body;
  try {
    // Parse isOutgoing strictly to boolean/number based on database requirements
    const isOutgoingDbVal = typeof isOutgoing === 'boolean' ? isOutgoing : (isOutgoing === 'true' || isOutgoing === 1);

    // Ensure the user exists in the users table to prevent Foreign Key constraints from failing
    await dbQuery(`
      INSERT INTO users (id, name, username, avatar)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `, [userId, userName, `user_${userId.toLowerCase().replace(/[^a-z0-9]/g, '')}`, avatar]);

    await dbQuery(`
      INSERT INTO call_logs (id, user_id, user_name, avatar, type, is_outgoing, timestamp, status, duration)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [id, userId, userName, avatar, type, isOutgoingDbVal, timestamp ? new Date(timestamp) : new Date(), status, duration]);

    invalidateCallsCache();
    refreshCallsCache();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error saving call log:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get Communities
app.get('/api/communities', async (req, res) => {
  res.json(dbCache.communities || []);
});

// Add Community
app.post('/api/communities', async (req, res) => {
  const { id, name, description, avatar, groupCount, memberCount } = req.body;
  try {
    await dbQuery(`
      INSERT INTO communities (id, name, description, avatar, group_count, member_count)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, name, description, avatar, groupCount, memberCount]);
    invalidateCommunitiesCache();
    refreshCommunitiesCache();
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
    await dbQuery(`
      INSERT INTO community_announcements (id, community_id, text, timestamp)
      VALUES ($1, $2, $3, $4)
    `, [id, commId, text, timestamp ? new Date(timestamp) : new Date()]);
    invalidateCommunitiesCache();
    refreshCommunitiesCache();
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- AI ASSISTANT CHAT ROUTE ---

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
      .slice(-10)
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

// Message Translation
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

// Chat Summarize helper
app.post('/api/ai/summarize', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages are required for summary.' });
  }

  const chatContent = messages
    .filter((m) => m.type === 'text')
    .slice(-30)
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
    const summary = `### Honeycomb Summary 🍯\n\n- **Saling Menyapa**: Para lebah sedang aktif bertegur sapa di dalam obrolan.\n- **Sarang Hangat**: Terlihat pembicaraan yang ceria tentang kehidupan sehari-hari.\n- **Rencana Berikutnya**: Mengisi cangkir dengan nektar segar dan bersiap untuk beralih to tugas selanjutnya!\n\n*Bzzzt! Aktifkan GEMINI_API_KEY di Secrets untuk mendapatkan rangkuman AI asli yang super pintar dari seluruh pesanmu!* 🐝`;
    return res.json({ summary, simulated: true });
  }
});

// Smart Reply Suggester
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
      return res.json({
        suggestions: [
          'Oke mantap! 🍯',
          'Siaapp! 🐝',
          'Ayo kumpul!'
        ]
      });
    }
  } else {
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

// Text-to-Speech (TTS)
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
              prebuiltVoiceConfig: { voiceName: 'Kore' },
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
    return res.json({ simulated: true });
  }
});

// --- SOCKET.IO SIGNALING FOR WEBRTC CALLS ---

io.on('connection', (socket) => {

  // Register user's socket
  socket.on('register', (userId: string) => {
    userSockets.set(userId, socket.id);
    socket.data.userId = userId;
  });

  // Caller sends an offer to a target user
  socket.on('call-offer', (data: {
    targetUserId: string;
    callerId: string;
    callerName: string;
    callerAvatar: string;
    callType: 'voice' | 'video';
    sdpOffer: RTCSessionDescriptionInit;
  }) => {
    const targetSocketId = userSockets.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-incoming', {
        callerId: data.callerId,
        callerName: data.callerName,
        callerAvatar: data.callerAvatar,
        callType: data.callType,
        sdpOffer: data.sdpOffer
      });
    } else {
      // Target user is offline
      socket.emit('call-unavailable', { targetUserId: data.targetUserId });
    }
  });

  // Receiver sends answer back to caller
  socket.on('call-answer', (data: {
    callerId: string;
    sdpAnswer: RTCSessionDescriptionInit;
  }) => {
    const callerSocketId = userSockets.get(data.callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call-answered', {
        answererId: socket.data.userId,
        sdpAnswer: data.sdpAnswer
      });
    }
  });

  // ICE candidate exchange
  socket.on('ice-candidate', (data: {
    targetUserId: string;
    candidate: RTCIceCandidateInit;
  }) => {
    const targetSocketId = userSockets.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        fromUserId: socket.data.userId,
        candidate: data.candidate
      });
    }
  });

  // Call rejected by receiver
  socket.on('call-reject', (data: { callerId: string }) => {
    const callerSocketId = userSockets.get(data.callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call-rejected', {
        rejectedBy: socket.data.userId
      });
    }
  });

  // Call ended by either party
  socket.on('call-end', (data: { targetUserId: string }) => {
    const targetSocketId = userSockets.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-ended', {
        endedBy: socket.data.userId
      });
    }
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    if (socket.data.userId) {
      userSockets.delete(socket.data.userId);
    }
  });
});

// --- VITE AND SERVER BOOT ---

async function startServer() {
  try {
    if (process.env.DB_DRIVER === 'MySQL') {
      await ensureMySQLDatabaseExists();
      const connection = await mysqlPool!.getConnection();
      connection.release();
    } else {
      const client = await pool.connect();
      client.release();
    }

    await initDb();

    refreshStatusCache().catch(() => { });
    refreshCallsCache().catch(() => { });
    refreshCommunitiesCache().catch(() => { });
  } catch (err: any) {
    setDatabaseOffline(true);
    seedLocalDbMockup();
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
  });
}

startServer();
