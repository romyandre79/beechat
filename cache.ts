import { dbQuery, parseDbDate } from './db';

// Memory cache to prevent overloading the remote database with high-frequency polling
export const dbCache: {
  status: any[] | null;
  chats: Record<string, any[]>;
  messages: Record<string, any[]>;
  calls: any[] | null;
  communities: any[] | null;
} = {
  status: [
    {
      id: 'status_1',
      userId: 'dan',
      userName: 'Beekeeper Dan 👨‍🌾',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      type: 'image',
      content: 'https://images.unsplash.com/photo-1473081556163-2a17de81fc97?w=600&auto=format&fit=crop&q=80',
      timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
      viewedBy: []
    }
  ],
  chats: {
    'user_queen': [
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
        lastMessageTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        typingUserIds: []
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
        lastMessageTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        typingUserIds: []
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
        lastMessageTime: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        typingUserIds: []
      }
    ]
  },
  messages: {
    'user_queen': [
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
        text: 'Sekuar 20 liter madu kualitas super A-1 murni.',
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
    ]
  },
  calls: [
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
  ],
  communities: [
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
  ]
};

// Active users tracking to sync caches only for online users
export const activeUserIds = new Set<string>();

export function invalidateChatsCache(userId?: string) {
  if (userId) {
    delete dbCache.chats[userId];
  } else {
    dbCache.chats = {};
  }
}

export function invalidateMessagesCache(userId?: string) {
  if (userId) {
    delete dbCache.messages[userId];
  } else {
    dbCache.messages = {};
  }
}

export function invalidateStatusCache() {
  dbCache.status = null;
}

export function invalidateCallsCache() {
  dbCache.calls = null;
}

export function invalidateCommunitiesCache() {
  dbCache.communities = null;
}

// Background SWR Cache Refresh Functions
export async function refreshStatusCache() {
  try {
    const statusRes = await dbQuery(`
      SELECT s.*, u.name as current_user_name, u.avatar as current_user_avatar 
      FROM status_updates s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.timestamp DESC
    `);

    const statusList: any[] = [];
    if (statusRes.rows.length > 0) {
      const statusIds = statusRes.rows.map((r: any) => r.id);
      const viewsRes = await dbQuery(`
        SELECT status_id, user_id 
        FROM status_views 
        WHERE status_id = ANY($1::text[])
      `, [statusIds]);

      const viewsMap: Record<string, string[]> = {};
      for (const v of viewsRes.rows) {
        if (!viewsMap[v.status_id]) viewsMap[v.status_id] = [];
        viewsMap[v.status_id].push(v.user_id);
      }

      for (const row of statusRes.rows) {
        statusList.push({
          id: row.id,
          userId: row.user_id,
          userName: row.current_user_name || row.user_name,
          userAvatar: row.current_user_avatar || row.user_avatar,
          type: row.type,
          content: row.content,
          bgStyle: row.bg_style,
          timestamp: parseDbDate(row.timestamp),
          viewedBy: viewsMap[row.id] || []
        });
      }
    }
    dbCache.status = statusList;
  } catch (err) {
    console.error('Background status cache refresh failed:', err);
  }
}

export async function refreshChatsCache(uId: string) {
  try {
    const queryText = `
      SELECT DISTINCT c.* FROM chats c
      JOIN chat_members cm ON c.id = cm.chat_id
      WHERE cm.user_id = $1
    `;
    const chatsRes = await dbQuery(queryText, [uId]);
    const chats: any[] = [];
    for (const row of chatsRes.rows) {
      const membersRes = await dbQuery('SELECT user_id FROM chat_members WHERE chat_id = $1', [row.id]);
      const members = membersRes.rows.map((m: any) => m.user_id);
      
      let chatName = row.name;
      let chatAvatar = row.avatar;
      
      if (!row.is_group) {
        const partnerId = members.find((mId: string) => mId !== uId);
        if (partnerId) {
          const partnerRes = await dbQuery('SELECT name, avatar FROM users WHERE id = $1', [partnerId]);
          if (partnerRes.rows.length > 0) {
            chatName = partnerRes.rows[0].name;
            chatAvatar = partnerRes.rows[0].avatar || chatAvatar;
          }
        }
      }

      chats.push({
        id: row.id,
        name: chatName,
        avatar: chatAvatar,
        isGroup: row.is_group,
        isPinned: row.is_pinned,
        isArchived: row.is_archived,
        type: row.type,
        description: row.description,
        lastMessage: row.last_message,
        lastMessageTime: row.last_message_time ? parseDbDate(row.last_message_time) : undefined,
        unreadCount: 0,
        members: members,
        typingUserIds: []
      });
    }
    dbCache.chats[uId] = chats;
  } catch (err) {
    console.error('Background chats cache refresh failed:', err);
  }
}

export async function refreshMessagesCache(uId: string) {
  try {
    // Check if there are any pending 'sent' messages first to avoid lock contention
    const pendingSent = await dbQuery(`
      SELECT 1 FROM messages m
      JOIN chat_members cm ON m.chat_id = cm.chat_id
      WHERE cm.user_id = $1 AND m.sender_id != $1 AND m.status = 'sent'
      LIMIT 1
    `, [uId]);

    if (pendingSent.rows.length > 0) {
      await dbQuery(`
        UPDATE messages
        SET status = 'delivered'
        WHERE sender_id != $1
          AND status = 'sent'
          AND chat_id IN (
            SELECT chat_id FROM chat_members WHERE user_id = $1
          )
      `, [uId]);
    }

    const queryText = `
      SELECT DISTINCT m.* FROM messages m
      JOIN chat_members cm ON m.chat_id = cm.chat_id
      WHERE cm.user_id = $1
      ORDER BY m.timestamp ASC
    `;
    const messagesRes = await dbQuery(queryText, [uId]);
    
    if (messagesRes.rows.length === 0) {
      dbCache.messages[uId] = [];
      return;
    }

    const messageIds = messagesRes.rows.map((r: any) => r.id);

    // Batch fetch all poll_options for these messages in ONE query
    const allOptionsRes = await dbQuery(
      'SELECT * FROM poll_options WHERE message_id = ANY($1::text[])',
      [messageIds]
    );

    // Batch fetch all poll_votes in ONE query
    const optionIds = allOptionsRes.rows.map((o: any) => o.id);
    let allVotesMap: Record<string, string[]> = {};
    if (optionIds.length > 0) {
      const allVotesRes = await dbQuery(
        'SELECT option_id, user_id FROM poll_votes WHERE option_id = ANY($1::text[])',
        [optionIds]
      );
      for (const v of allVotesRes.rows) {
        if (!allVotesMap[v.option_id]) allVotesMap[v.option_id] = [];
        allVotesMap[v.option_id].push(v.user_id);
      }
    }

    // Batch fetch all reactions in ONE query
    const allReactionsRes = await dbQuery(`
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
      timestamp: row.timestamp ? parseDbDate(row.timestamp) : '',
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
  } catch (err) {
    console.error('Background messages cache refresh failed:', err);
  }
}

export async function refreshCallsCache() {
  try {
    const callsRes = await dbQuery('SELECT * FROM call_logs ORDER BY timestamp DESC');
    dbCache.calls = callsRes.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      avatar: row.avatar,
      type: row.type,
      isOutgoing: row.is_outgoing,
      timestamp: row.timestamp ? parseDbDate(row.timestamp) : '',
      status: row.status,
      duration: row.duration
    }));
  } catch (err) {
    console.error('Background calls cache refresh failed:', err);
  }
}

export async function refreshCommunitiesCache() {
  try {
    const commRes = await dbQuery('SELECT * FROM communities');
    const list: any[] = [];
    for (const row of commRes.rows) {
      const annRes = await dbQuery('SELECT * FROM community_announcements WHERE community_id = $1 ORDER BY timestamp DESC', [row.id]);
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
          timestamp: ann.timestamp ? parseDbDate(ann.timestamp) : ''
        }))
      });
    }
    dbCache.communities = list;
  } catch (err) {
    console.error('Background communities cache refresh failed:', err);
  }
}

// Background interval to refresh database caches for active users and global states every 15 seconds
setInterval(async () => {
  try {
    await refreshStatusCache();
    await refreshCallsCache();
    await refreshCommunitiesCache();
    
    for (const uId of activeUserIds) {
      await refreshChatsCache(uId);
      await refreshMessagesCache(uId);
    }
  } catch (err) {
    console.error('Background interval cache refresh failed:', err);
  }
}, 15000);
