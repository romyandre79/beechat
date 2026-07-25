import pg from 'pg';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Force the pg driver to parse TIMESTAMP (OID 1114) as UTC to prevent timezone offset shifts
pg.types.setTypeParser(1114, (stringValue) => {
  return new Date(stringValue.replace(' ', 'T') + 'Z');
});

// PostgreSQL Connection Pool
const { Pool } = pg;
export const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: false,
  max: 20,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  statement_timeout: 30000
});

// MariaDB/MySQL Connection Pool (Conditional)
export let mysqlPool: mysql.Pool | null = null;
if (process.env.DB_DRIVER === 'MySQL') {
  mysqlPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    connectTimeout: 15000
  });
}

export let isDatabaseOffline = false;

export function setDatabaseOffline(offline: boolean) {
  isDatabaseOffline = offline;
}

// Safe Local/UTC Date Parser helper
export function parseDbDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString();
  }
  try {
    return new Date(String(val)).toISOString();
  } catch {
    return String(val);
  }
}

export const localDb = {
  users: [] as any[],
  chats: [] as any[],
  messages: [] as any[],
  status_updates: [] as any[],
  call_logs: [] as any[],
  communities: [] as any[],
  stickers: [
    { id: 1, url: '🐝', label: 'Lebah Madu' },
    { id: 2, url: '🍯', label: 'Madu Manis' },
    { id: 3, url: '🌻', label: 'Matahari' },
    { id: 4, url: '🌸', label: 'Sakura' },
    { id: 5, url: '👑', label: 'Ratu Lebah' },
    { id: 6, url: '🧸', label: 'Beruang Madu' },
    { id: 7, url: '🥞', label: 'Pancake Madu' },
    { id: 8, url: '🍋', label: 'Lemon Madu' },
    { id: 9, url: '💖', label: 'Cinta Lebah' }
  ] as any[],
  chat_members: [] as any[],
  poll_options: [] as any[],
  poll_votes: [] as any[],
  message_reactions: [] as any[],
  status_views: [] as any[],
  community_announcements: [] as any[],
  blocked_users: [] as any[]
};

export function seedLocalDbMockup() {
  localDb.users = [
    {
      id: 'user_queen',
      name: 'Lebah Pekerja Utama',
      username: 'worker_bee_sweet',
      avatar: 'https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=150&auto=format&fit=crop&q=80',
      bio: 'Selalu bersemangat mengumpulkan nektar kebaikan! 🍯🐝',
      email: 'lebah.pekerja@beechat.sweet',
      phone: '+62 812-3456-7890',
      is_online: true,
      last_seen: new Date().toISOString()
    },
    {
      id: 'queen_ai',
      name: 'Queen Bee AI Assistant 👑',
      username: 'queen_ai',
      avatar: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=150&auto=format&fit=crop&q=80',
      bio: 'Ratu AI asisten Anda.',
      email: 'ai@queen.sweet',
      phone: '+62 800-BEE-AI',
      is_online: true,
      last_seen: new Date().toISOString()
    },
    {
      id: 'dan',
      name: 'Beekeeper Dan 👨‍🌾',
      username: 'dan',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      bio: 'Peternak lebah ramah yang memantau kualitas honeycomb kita harian.',
      email: 'dan@sarang.sweet',
      phone: '+62 812-9999-0000',
      is_online: true,
      last_seen: new Date().toISOString()
    },
    {
      id: 'buzz',
      name: 'Worker Buzz 🐝',
      username: 'buzz',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      bio: 'Lebah pekerja tercepat, spesialis bunga matahari.',
      email: 'buzz@sarang.sweet',
      phone: '+62 812-9999-1111',
      is_online: true,
      last_seen: new Date().toISOString()
    },
    {
      id: 'bob',
      name: 'Bumblebee Bob 🌼',
      username: 'bob',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      bio: 'Lebah pemalas tapi sangat lucu yang suka tidur di kelopak bunga mawar.',
      email: 'bob@sarang.sweet',
      phone: '+62 812-9999-2222',
      is_online: false,
      last_seen: new Date().toISOString()
    }
  ];

  localDb.chats = [
    {
      id: 'chat_queen_ai',
      name: 'Queen Bee AI Assistant 👑',
      avatar: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=150&auto=format&fit=crop&q=80',
      isGroup: false,
      isPinned: true,
      isArchived: false,
      unreadCount: 1,
      members: ['user_queen', 'queen_ai'],
      type: 'ai',
      description: 'Ratu Lebah AI siap membantumu menulis pesan, menerjemahkan, atau merangkum obrolan! Buzz!',
      lastMessage: 'Halo manis! 🐝 Ratu Lebah di sini. Ada yang bisa kubantu di sarang hari ini? 🍯',
      lastMessageTime: new Date(Date.now() - 5 * 60 * 1000).toISOString()
    },
    {
      id: 'chat_dan',
      name: 'Beekeeper Dan 👨‍🌾',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isGroup: false,
      isPinned: true,
      isArchived: false,
      unreadCount: 0,
      members: ['user_queen', 'dan'],
      type: 'direct',
      description: 'Peternak lebah ramah yang memantau kualitas honeycomb kita harian.',
      lastMessage: 'Bagaimana produksi madu di sektor barat hari ini?',
      lastMessageTime: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    },
    {
      id: 'chat_hive_group',
      name: 'Sarang Madu Utama 🍯',
      avatar: 'https://images.unsplash.com/photo-1473081556163-2a17de81fc97?w=150&auto=format&fit=crop&q=80',
      isGroup: true,
      isPinned: false,
      isArchived: false,
      unreadCount: 0,
      members: ['user_queen', 'dan', 'buzz', 'bob'],
      type: 'group',
      description: 'Grup utama koordinasi seluruh lebah pekerja untuk pengumpulan nektar bunga.',
      lastMessage: 'Buzz: Kami menemukan ladang bunga lavender indah di utara!',
      lastMessageTime: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    }
  ];

  localDb.messages = [
    {
      id: 'm_ai_1',
      chatId: 'chat_queen_ai',
      senderId: 'queen_ai',
      text: 'Selamat datang di BeeChat, lebah kecilku yang manis! 🍯🐝 Aku adalah Ratu Lebah AI di sarang ini. Aku bisa membantumu menerjemahkan pesan, membuat polling, merangkum percakapan, atau sekadar mengobrol hangat!',
      type: 'text',
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      status: 'read'
    },
    {
      id: 'm_ai_2',
      chatId: 'chat_queen_ai',
      senderId: 'queen_ai',
      text: 'Halo manis! 🐝 Ratu Lebah di sini. Ada yang bisa kubantu di sarang hari ini? 🍯',
      type: 'text',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: 'read'
    },
    {
      id: 'm_dan_1',
      chatId: 'chat_dan',
      senderId: 'user_queen',
      text: 'Halo Dan! Sarang madu sektor timur sudah hampir penuh dan siap dipanen.',
      type: 'text',
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'read'
    },
    {
      id: 'm_dan_2',
      chatId: 'chat_dan',
      senderId: 'dan',
      text: 'Wah, luar biasa cepat! Berapa perkiraan volumenya kali ini?',
      type: 'text',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      status: 'read'
    },
    {
      id: 'm_dan_3',
      chatId: 'chat_dan',
      senderId: 'user_queen',
      text: 'Sekitar 20 liter madu kualitas super A-1 murni.',
      type: 'text',
      timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      status: 'read'
    },
    {
      id: 'm_dan_4',
      chatId: 'chat_dan',
      senderId: 'dan',
      text: 'Bagaimana produksi madu di sektor barat hari ini?',
      type: 'text',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      status: 'read'
    }
  ];

  localDb.status_updates = [
    {
      id: 'status_1',
      userId: 'dan',
      userName: 'Beekeeper Dan 👨‍🌾',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      type: 'image',
      content: 'https://images.unsplash.com/photo-1473081556163-2a17de81fc97?w=600&auto=format&fit=crop&q=80',
      timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      viewedBy: []
    },
    {
      id: 'status_2',
      userId: 'buzz',
      userName: 'Worker Buzz 🐝',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      type: 'text',
      content: 'Terbang bebas mengarungi ladang bunga tulip pagi ini! Keindahan alam tiada tara! 🌷🐝 #lebah_produktif',
      bgStyle: 'bg-gradient-to-r from-amber-500 to-yellow-500',
      timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      viewedBy: []
    }
  ];

  localDb.call_logs = [
    {
      id: 'call_1',
      userId: 'dan',
      userName: 'Beekeeper Dan 👨‍🌾',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      type: 'video',
      isOutgoing: false,
      timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      status: 'completed',
      duration: '04:12'
    }
  ];

  localDb.communities = [
    {
      id: 'comm_1',
      name: 'Masyarakat Lebah Madu Nusantara 🇮🇩',
      description: 'Aliansi pembudidaya lebah madu murni dan pelestari lingkungan alam dari Sabang sampai Merauke.',
      avatar: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=150&auto=format&fit=crop&q=80',
      groupCount: 8,
      memberCount: 1450,
      announcements: [
        {
          id: 'ann_1',
          text: 'Pengumuman: Festival Madu Nusantara akan diselenggarakan bulan depan secara virtual! Siapkan produk terbaik sarangmu. 🍯🏆',
          timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
        }
      ]
    }
  ];
}

export async function mockQuery(text: string, params: any[] = []): Promise<{ rows: any[] }> {
  const q = text.trim().replace(/\s+/g, ' ');
  const qLower = q.toLowerCase();

  if (qLower.startsWith('create table') || qLower.startsWith('alter table') || qLower.startsWith('create index') || qLower.startsWith('set search_path') || qLower.startsWith('create schema')) {
    return { rows: [] };
  }

  if (qLower.includes('select count(*)') && qLower.includes('stickers')) {
    return { rows: [{ count: String(localDb.stickers.length) }] };
  }

  if (qLower.includes('from users')) {
    if (qLower.includes('join blocked_users')) {
      const userId = params[0];
      const blockedIds = localDb.blocked_users.filter(bu => bu.user_id === userId).map(bu => bu.blocked_user_id);
      const matchedUsers = localDb.users.filter(u => blockedIds.includes(u.id));
      return {
        rows: matchedUsers.map(u => ({
          id: u.id,
          name: u.name,
          username: u.username,
          avatar: u.avatar,
          bio: u.bio
        }))
      };
    }
    if (qLower.includes('join chat_members')) {
      const chatId = params[0];
      const memberIds = localDb.chat_members.filter(cm => cm.chat_id === chatId).map(cm => cm.user_id);
      const matchedUsers = localDb.users.filter(u => memberIds.includes(u.id));
      return {
        rows: matchedUsers.map(u => ({
          id: u.id,
          name: u.name,
          username: u.username,
          avatar: u.avatar,
          bio: u.bio,
          isOnline: u.is_online,
          lastSeen: u.last_seen
        }))
      };
    }
    if (qLower.includes('id = $1 or username = $1 or email = $1 or phone = $1')) {
      const val = String(params[0]).toLowerCase();
      const user = localDb.users.find(u =>
        u.id.toLowerCase() === val ||
        u.username.toLowerCase() === val ||
        (u.email && u.email.toLowerCase() === val) ||
        (u.phone && u.phone.toLowerCase() === val)
      );
      return { rows: user ? [user] : [] };
    }
    if (qLower.includes('where id = $1')) {
      const id = String(params[0]);
      const user = localDb.users.find(u => u.id === id);
      if (user) {
        return {
          rows: [{
            id: user.id,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
            bio: user.bio,
            email: user.email,
            phone: user.phone,
            isOnline: user.is_online,
            lastSeen: user.last_seen,
            coverPhoto: user.cover_photo,
            password_hash: user.password_hash
          }]
        };
      }
      return { rows: [] };
    }
    if (qLower.includes('name ilike $1')) {
      const searchVal = String(params[0]).replace(/%/g, '').toLowerCase();
      const matches = localDb.users.filter(u =>
        u.name.toLowerCase().includes(searchVal) ||
        u.username.toLowerCase().includes(searchVal) ||
        (u.email && u.email.toLowerCase().includes(searchVal)) ||
        (u.phone && u.phone.toLowerCase().includes(searchVal))
      );
      return { rows: matches };
    }
  }

  if (qLower.startsWith('insert into users')) {
    const [id, name, username, avatar, bio, email, phone, isOnline, lastSeen, coverPhoto, passwordHash] = params;
    const existing = localDb.users.find(u => u.id === id);
    const newUser = { id, name, username, avatar, bio, email, phone, is_online: isOnline ?? true, last_seen: lastSeen || new Date().toISOString(), cover_photo: coverPhoto, password_hash: passwordHash || 'no-password' };
    if (existing) {
      Object.assign(existing, newUser);
    } else {
      localDb.users.push(newUser);
    }
    return { rows: [newUser] };
  }
  if (qLower.startsWith('update users')) {
    if (qLower.includes('last_active = current_timestamp')) {
      const id = String(params[0]);
      const user = localDb.users.find(u => u.id === id);
      if (user) {
        user.is_online = true;
        user.last_seen = new Date().toISOString();
      }
    }
    return { rows: [] };
  }

  if (qLower.includes('from chats')) {
    if (qLower.includes('cm.user_id = $1')) {
      const uId = String(params[0]);
      const userChats = localDb.chats.filter(c => c.members.includes(uId));
      return {
        rows: userChats.map(c => ({
          id: c.id,
          name: c.name,
          avatar: c.avatar,
          is_group: c.isGroup,
          is_pinned: c.isPinned,
          is_archived: c.isArchived,
          type: c.type,
          description: c.description,
          last_message: c.lastMessage,
          last_message_time: c.lastMessageTime
        }))
      };
    }
  }
  if (qLower.startsWith('insert into chats')) {
    const [id, name, avatar, isGroup, isPinned, isArchived, type, description, lastMessage, lastMessageTime] = params;
    const newChat = { id, name, avatar, isGroup: isGroup ?? false, isPinned: isPinned ?? false, isArchived: isArchived ?? false, type: type || 'direct', description, lastMessage, lastMessageTime, members: [] as string[] };
    localDb.chats.push(newChat);
    return { rows: [newChat] };
  }
  if (qLower.startsWith('update chats')) {
    if (qLower.includes('last_message = null')) {
      const chatId = params[0];
      const chat = localDb.chats.find(c => c.id === chatId);
      if (chat) {
        chat.lastMessage = null;
        chat.lastMessageTime = null;
      }
    } else if (qLower.includes('set last_message = $1')) {
      const [lastMsg, lastMsgTime, chatId] = params;
      const chat = localDb.chats.find(c => c.id === chatId);
      if (chat) {
        chat.lastMessage = lastMsg;
        chat.lastMessageTime = lastMsgTime;
      }
    }
    return { rows: [] };
  }
  if (qLower.startsWith('insert into blocked_users')) {
    const [userId, blockedUserId] = params;
    localDb.blocked_users.push({ user_id: userId, blocked_user_id: blockedUserId });
    return { rows: [] };
  }
  if (qLower.startsWith('delete from blocked_users')) {
    const [userId, blockedUserId] = params;
    localDb.blocked_users = localDb.blocked_users.filter(bu => !(bu.user_id === userId && bu.blocked_user_id === blockedUserId));
    return { rows: [] };
  }
  if (qLower.startsWith('select blocked_user_id from blocked_users')) {
    const userId = params[0];
    const matched = localDb.blocked_users.filter(bu => bu.user_id === userId);
    return { rows: matched };
  }

  if (qLower.startsWith('delete from chat_members') && qLower.includes('user_id = $2')) {
    const [chatId, userId] = params;
    localDb.chat_members = localDb.chat_members.filter(cm => !(cm.chat_id === chatId && cm.user_id === userId));
    return { rows: [] };
  }

  if (qLower.startsWith('delete from chats')) {
    const chatId = params[0];
    localDb.chats = localDb.chats.filter(c => c.id !== chatId);
    return { rows: [] };
  }
  if (qLower.startsWith('delete from chat_members') && qLower.includes('chat_id = $1') && params.length === 1) {
    const chatId = params[0];
    localDb.chat_members = localDb.chat_members.filter(cm => cm.chat_id !== chatId);
    return { rows: [] };
  }

  if (qLower.startsWith('select user_id from chat_members')) {
    const chatId = params[0];
    const chat = localDb.chats.find(c => c.id === chatId);
    const members = chat ? chat.members.map(mId => ({ user_id: mId })) : [];
    return { rows: members };
  }
  if (qLower.startsWith('insert into chat_members')) {
    const [chatId, userId] = params;
    const chat = localDb.chats.find(c => c.id === chatId);
    if (chat && !chat.members.includes(userId)) {
      chat.members.push(userId);
    }
    return { rows: [] };
  }

  if (qLower.includes('from messages')) {
    if (qLower.includes('cm.user_id = $1')) {
      const uId = String(params[0]);
      const chatIds = localDb.chats.filter(c => c.members.includes(uId)).map(c => c.id);
      const userMsgs = localDb.messages.filter(m => chatIds.includes(m.chatId));
      return {
        rows: userMsgs.map(m => ({
          id: m.id,
          chat_id: m.chatId,
          sender_id: m.senderId,
          text: m.text,
          type: m.type,
          timestamp: m.timestamp,
          status: m.status,
          media_url: m.mediaUrl,
          file_name: m.fileName,
          file_size: m.fileSize,
          duration: m.duration,
          poll_question: m.pollQuestion,
          reply_to_id: m.replyToId,
          reply_to_text: m.replyToText
        }))
      };
    }
  }
  if (qLower.startsWith('insert into messages')) {
    const [id, chatId, senderId, text, type, timestamp, status, mediaUrl, fileName, fileSize, duration, pollQuestion, replyToId, replyToText] = params;
    const newMsg = { id, chatId, senderId, text, type, timestamp, status, mediaUrl, fileName, fileSize, duration, pollQuestion, replyToId, replyToText, pollOptions: [] as any[], reactions: [] as any[] };
    localDb.messages.push(newMsg);
    return { rows: [newMsg] };
  }
  if (qLower.startsWith('update messages')) {
    if (qLower.includes('status = \'delivered\'')) {
      const userId = params[0];
      localDb.messages.forEach(m => {
        if (m.senderId !== userId && m.status === 'sent') {
          m.status = 'delivered';
        }
      });
    }
    if (qLower.includes('status = \'read\'')) {
      const [chatId, userId] = params;
      let count = 0;
      localDb.messages.forEach(m => {
        if (m.chatId === chatId && m.senderId !== userId && (m.status === 'sent' || m.status === 'delivered')) {
          m.status = 'read';
          count++;
        }
      });
      return { rows: Array(count).fill({ id: 'dummy' }) };
    }
    return { rows: [] };
  }
  if (qLower.startsWith('delete from messages') && qLower.includes('chat_id = $1')) {
    const chatId = params[0];
    localDb.messages = localDb.messages.filter(m => m.chatId !== chatId);
    return { rows: [] };
  }
  if (qLower.startsWith('delete from messages') && qLower.includes('id = $1')) {
    const msgId = params[0];
    localDb.messages = localDb.messages.filter(m => m.id !== msgId);
    return { rows: [] };
  }

  if (qLower.startsWith('select * from poll_options')) {
    const messageIds = params[0];
    const options = localDb.poll_options.filter(o => messageIds.includes(o.message_id));
    return { rows: options };
  }
  if (qLower.startsWith('insert into poll_options')) {
    const [id, messageId, text] = params;
    const newOpt = { id, message_id: messageId, text };
    localDb.poll_options.push(newOpt);
    return { rows: [newOpt] };
  }
  if (qLower.includes('from poll_votes')) {
    if (qLower.startsWith('select')) {
      const optionIds = params[0];
      const votes = localDb.poll_votes.filter(v => optionIds.includes(v.option_id));
      return { rows: votes };
    }
    if (qLower.startsWith('insert')) {
      const [optionId, userId] = params;
      localDb.poll_votes.push({ option_id: optionId, user_id: userId });
      return { rows: [] };
    }
    if (qLower.startsWith('delete')) {
      const [optionId, userId] = params;
      localDb.poll_votes = localDb.poll_votes.filter(v => !(v.option_id === optionId && v.user_id === userId));
      return { rows: [] };
    }
  }

  if (qLower.includes('from message_reactions')) {
    if (qLower.startsWith('select')) {
      const messageIds = params[0];
      const reactions = localDb.message_reactions.filter(r => messageIds.includes(r.message_id));
      const aggregated: any[] = [];
      const groups = reactions.reduce((acc, r) => {
        const key = `${r.message_id}_${r.emoji}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(r.user_id);
        return acc;
      }, {} as Record<string, string[]>);
      for (const [key, userIds] of Object.entries(groups)) {
        const [msgId, emoji] = key.split('_');
        aggregated.push({ message_id: msgId, emoji, user_ids: userIds });
      }
      return { rows: aggregated };
    }
    if (qLower.startsWith('insert')) {
      const [messageId, userId, emoji] = params;
      localDb.message_reactions.push({ message_id: messageId, user_id: userId, emoji });
      return { rows: [] };
    }
    if (qLower.startsWith('delete')) {
      const [messageId, userId, emoji] = params;
      localDb.message_reactions = localDb.message_reactions.filter(r => !(r.message_id === messageId && r.user_id === userId && r.emoji === emoji));
      return { rows: [] };
    }
  }

  if (qLower.includes('from status_updates')) {
    if (qLower.startsWith('select')) {
      const updates = localDb.status_updates.map(s => {
        const u = localDb.users.find(usr => usr.id === s.userId);
        return {
          id: s.id,
          user_id: s.userId,
          user_name: s.userName,
          user_avatar: s.userAvatar,
          type: s.type,
          content: s.content,
          bg_style: s.bgStyle,
          timestamp: s.timestamp,
          current_user_name: u?.name,
          current_user_avatar: u?.avatar
        };
      });
      return { rows: updates };
    }
    if (qLower.startsWith('insert')) {
      const [id, userId, userName, userAvatar, type, content, bgStyle, timestamp] = params;
      localDb.status_updates.unshift({ id, userId, userName, userAvatar, type, content, bgStyle, timestamp });
      return { rows: [] };
    }
  }
  if (qLower.includes('from status_views')) {
    const statusIds = params[0];
    const views = localDb.status_views.filter(v => statusIds.includes(v.status_id));
    return { rows: views };
  }

  if (qLower.includes('from call_logs')) {
    if (qLower.startsWith('select')) {
      return { rows: localDb.call_logs };
    }
    if (qLower.startsWith('insert')) {
      const [id, userId, userName, avatar, type, isOutgoing, timestamp, status, duration] = params;
      localDb.call_logs.unshift({ id, user_id: userId, user_name: userName, avatar, type, is_outgoing: isOutgoing, timestamp, status, duration });
      return { rows: [] };
    }
  }

  if (qLower.includes('from communities')) {
    if (qLower.startsWith('select')) {
      return { rows: localDb.communities };
    }
    if (qLower.startsWith('insert')) {
      const [id, name, description, avatar, groupCount, memberCount] = params;
      localDb.communities.push({ id, name, description, avatar, group_count: groupCount, member_count: memberCount, announcements: [] });
      return { rows: [] };
    }
  }
  if (qLower.includes('from community_announcements')) {
    if (qLower.startsWith('select')) {
      const commId = params[0];
      const announcements = localDb.community_announcements.filter(a => a.community_id === commId);
      return { rows: announcements };
    }
    if (qLower.startsWith('insert')) {
      const [id, commId, text, timestamp] = params;
      localDb.community_announcements.unshift({ id, community_id: commId, text, timestamp });
      return { rows: [] };
    }
  }

  if (qLower.includes('from stickers')) {
    if (qLower.startsWith('select')) {
      const userId = params[0];
      const list = localDb.stickers.filter(s => !s.user_id || s.user_id === userId);
      return { rows: list };
    }
    if (qLower.startsWith('insert')) {
      const [url, userId, label] = params;
      const newSticker = { id: Date.now(), url, user_id: userId, label };
      localDb.stickers.push(newSticker);
      return { rows: [newSticker] };
    }
  }

  if (qLower.includes('from blocked_users')) {
    if (qLower.startsWith('select')) {
      const userId = params[0];
      const list = localDb.blocked_users.filter(b => b.user_id === userId).map(b => ({ blocked_user_id: b.blocked_user_id }));
      return { rows: list };
    }
    if (qLower.startsWith('insert')) {
      const [userId, blockedUserId] = params;
      if (!localDb.blocked_users.some(b => b.user_id === userId && b.blocked_user_id === blockedUserId)) {
        localDb.blocked_users.push({ user_id: userId, blocked_user_id: blockedUserId });
      }
      return { rows: [] };
    }
    if (qLower.startsWith('delete')) {
      const [userId, blockedUserId] = params;
      localDb.blocked_users = localDb.blocked_users.filter(b => !(b.user_id === userId && b.blocked_user_id === blockedUserId));
      return { rows: [] };
    }
  }

  return { rows: [] };
}

export async function runMySQLQuery(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
  if (!mysqlPool) throw new Error('MySQL pool not initialized');

  let mysqlSql = sql.trim().replace(/\s+/g, ' ');
  const qLower = mysqlSql.toLowerCase();

  if (qLower.startsWith('set search_path') || qLower.startsWith('create schema')) {
    return { rows: [] };
  }

  const placeholderRegex = /\$([0-9]+)/g;
  let match;
  const sequentialParams: any[] = [];

  while ((match = placeholderRegex.exec(mysqlSql)) !== null) {
    const idx = parseInt(match[1]) - 1;
    sequentialParams.push(params[idx]);
  }

  mysqlSql = mysqlSql.replace(/=\s*ANY\(\s*\$[0-9]+(?:::[a-z0-9\[\]]+)?\s*\)/gi, 'IN (?)');
  mysqlSql = mysqlSql.replace(/=\s*ANY\(\s*\?(?:::[a-z0-9\[\]]+)?\s*\)/gi, 'IN (?)');
  mysqlSql = mysqlSql.replace(/\$[0-9]+/g, '?');

  const finalParams = sequentialParams.length > 0 ? sequentialParams : params;

  if (qLower.includes('array_agg')) {
    const queryReactionsSql = `SELECT message_id, emoji, user_id FROM message_reactions WHERE message_id IN (?)`;
    const [rawRows]: any = await mysqlPool.query(queryReactionsSql, finalParams);

    const grouped = rawRows.reduce((acc: any, row: any) => {
      const key = `${row.message_id}_${row.emoji}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row.user_id);
      return acc;
    }, {} as Record<string, string[]>);

    const rows = Object.entries(grouped).map(([key, userIds]) => {
      const [msgId, emoji] = key.split('_');
      return { message_id: msgId, emoji, user_ids: userIds };
    });

    return { rows };
  }

  const onConflictRegex = /\s*ON CONFLICT\s*(?:\([^)]*\))?\s*DO NOTHING/gi;
  if (onConflictRegex.test(mysqlSql)) {
    mysqlSql = mysqlSql.replace(onConflictRegex, '');
    mysqlSql = mysqlSql.replace(/^INSERT\s+INTO/gi, 'INSERT IGNORE INTO');
  }

  if (qLower.includes('on conflict') && qLower.includes('do update')) {
    mysqlSql = mysqlSql.replace(/ON CONFLICT\s*\([^)]*\)\s*DO UPDATE SET/gi, 'ON DUPLICATE KEY UPDATE');
    mysqlSql = mysqlSql.replace(/EXCLUDED\.([a-zA-Z0-9_]+)/gi, 'VALUES($1)');
    mysqlSql = mysqlSql.replace(/users\.password_hash/gi, 'password_hash');
  }

  const returningRegex = /\bRETURNING\s+[a-zA-Z0-9_*,\s]+$/gi;
  const hasReturning = returningRegex.test(mysqlSql);
  if (hasReturning) {
    mysqlSql = mysqlSql.replace(returningRegex, '');
  }

  mysqlSql = mysqlSql.replace(/\bILIKE\b/gi, 'LIKE');
  mysqlSql = mysqlSql.replace(/INTERVAL '15 seconds'/gi, 'INTERVAL 15 SECOND');

  try {
    const [result]: any = await mysqlPool.query(mysqlSql, finalParams);
    if (hasReturning && result && typeof result.affectedRows === 'number') {
      return { rows: Array(result.affectedRows).fill({ id: 'dummy' }) };
    }
    return { rows: Array.isArray(result) ? result : [] };
  } catch (err: any) {
    if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
      return { rows: [] };
    }
    if (err.errno === 1050 || err.code === 'ER_TABLE_EXISTS_ERROR') {
      return { rows: [] };
    }
    throw err;
  }
}

export const dbQuery = async function (text: string, params: any[] = []) {
  if (isDatabaseOffline) {
    return mockQuery(text, params);
  }
  if (process.env.DB_DRIVER === 'MySQL') {
    try {
      return await runMySQLQuery(text, params);
    } catch (err: any) {
      // If MySQL is unreachable, fall back to in-memory mock
      const connErrors = ['ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ENOTFOUND', 'ECONNRESET'];
      if (connErrors.includes(err.code) || (err.errno && (err.errno === -4062 || err.errno === -4073 || err.errno === -4077))) {
        console.warn(`MySQL unreachable (${err.code || err.errno}), falling back to in-memory mock for: ${text.substring(0, 60)}...`);
        return mockQuery(text, params);
      }
      throw err;
    }
  }
  return pool.query(text, params);
};

export const dbConnect = async function () {
  if (isDatabaseOffline) {
    return {
      query: (text: string, params?: any[]) => mockQuery(text, params),
      release: () => { }
    };
  }
  if (process.env.DB_DRIVER === 'MySQL') {
    return {
      query: (text: string, params?: any[]) => runMySQLQuery(text, params),
      release: () => { }
    };
  }
  return pool.connect();
};

export async function initDb() {
  const client = await dbConnect();
  try {
    //('Initializing database schemas...');

    await client.query('CREATE SCHEMA IF NOT EXISTS beechat AUTHORIZATION beechat').catch(() => { });
    await client.query('SET search_path TO beechat, public').catch(() => { });

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
        password_hash VARCHAR(256),
        is_banned BOOLEAN DEFAULT false
      );
    `);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(256);`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`).catch(() => { });
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;`).catch(() => { });
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);`).catch(() => { });
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone);`).catch(() => { });

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

    await client.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name TEXT').catch(() => { });
    await client.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size TEXT').catch(() => { });

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

    // 14. Blocked users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        blocked_user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, blocked_user_id)
      );
    `);

    // Seed default global stickers if empty
    const stickersCheck = await client.query('SELECT COUNT(*) FROM stickers WHERE user_id IS NULL');
    if (parseInt(stickersCheck.rows[0].count || stickersCheck.rows[0].count === 0 ? stickersCheck.rows[0].count : '0') === 0) {
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
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)').catch(() => { });
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)').catch(() => { });
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)').catch(() => { });
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id)').catch(() => { });
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id)').catch(() => { });
    await client.query('CREATE INDEX IF NOT EXISTS idx_poll_options_message_id ON poll_options(message_id)').catch(() => { });
    await client.query('CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON poll_votes(option_id)').catch(() => { });
    await client.query('CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id)').catch(() => { });
    await client.query('CREATE INDEX IF NOT EXISTS idx_status_updates_user_id ON status_updates(user_id)').catch(() => { });
    await client.query('CREATE INDEX IF NOT EXISTS idx_status_views_status_id ON status_views(status_id)').catch(() => { });
    await client.query('CREATE INDEX IF NOT EXISTS idx_stickers_user_id ON stickers(user_id)').catch(() => { });
    await client.query('CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id)').catch(() => { });

    // 9. Reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id VARCHAR(255) PRIMARY KEY,
        reported_user_id VARCHAR(255) NOT NULL,
        reporter_id VARCHAR(255) NOT NULL,
        reason TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending'
      );
    `).catch(() => { });

    // Seed default reports if empty
    const reportsCheck = await client.query('SELECT COUNT(*) as count FROM reports').catch(() => ({ rows: [{ count: 0 }] }));
    const count = parseInt(reportsCheck.rows[0]?.count || '0');
    if (count === 0) {
      await client.query(`
        INSERT INTO reports (id, reported_user_id, reporter_id, reason, status)
        VALUES 
        ('rep_1', 'kucing', 'ary', 'Mencoba merusak dinding sarang madu utama', 'pending'),
        ('rep_2', 'riyadhi', 'hadi', 'Tidur terus saat jam kerja mengumpulkan nektar', 'resolved')
      `).catch(() => {});
    }

  } catch (err) {
  } finally {
    client.release();
  }
}

export async function ensureMySQLDatabaseExists() {
  if (process.env.DB_DRIVER !== 'MySQL') return;

  const tempConnection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    port: parseInt(process.env.DB_PORT || '3306')
  });

  const dbName = process.env.DB_NAME || 'beechat';
  await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await tempConnection.end();
}
