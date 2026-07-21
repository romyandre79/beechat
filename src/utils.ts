import { Chat, Message, CallLog, StatusUpdate, Community, UserProfile } from './types';

// Web Speech API fallback for Text-to-Speech
export async function speakText(text: string): Promise<boolean> {
  // Web Speech API is fully functional on Chrome/Firefox/Edge on Windows, and works flawlessly offline
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID'; // Indonesian default, falls back to browser default if not supported
    window.speechSynthesis.speak(utterance);
    return true;
  }
  return false;
}


// Generate nice date string (e.g., "10:30" or "Yesterday" or "15/07/2026")
export function formatMessageTime(timestampStr: string): string {
  const date = new Date(timestampStr);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } else if (isYesterday) {
    return 'Kemarin';
  } else {
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
}

export function cleanName(name: string): string {
  if (!name) return '';
  return name.replace(/0$/, '');
}

export const INITIAL_USER: UserProfile = {
  id: 'user_queen',
  name: 'Lebah Pekerja Utama',
  username: 'worker_bee_sweet',
  avatar: 'https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=150&auto=format&fit=crop&q=80', // Beautiful vector placeholder
  bio: 'Selalu bersemangat mengumpulkan nektar kebaikan! 🍯🐝',
  email: 'lebah.pekerja@beechat.sweet',
  phone: '+62 812-3456-7890',
  isOnline: true,
  coverPhoto: 'https://images.unsplash.com/photo-1560114928-40f1f1eb26a0?w=800&auto=format&fit=crop&q=80', // Honeycomb texture
};

export const INITIAL_CHATS: Chat[] = [
  {
    id: 'chat_queen_ai',
    name: 'Queen Bee AI Assistant 👑',
    avatar: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=150&auto=format&fit=crop&q=80', // Shiny queen bee
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
    avatar: 'https://images.unsplash.com/photo-1473081556163-2a17de81fc97?w=150&auto=format&fit=crop&q=80', // Hive close-up
    isGroup: true,
    isPinned: false,
    isArchived: false,
    unreadCount: 0,
    members: ['user_queen', 'dan', 'buzz', 'bob'],
    type: 'group',
    description: 'Grup utama koordinasi seluruh lebah pekerja untuk pengumpulan nektar bunga.',
    lastMessage: 'Buzz: Kami menemukan ladang bunga lavender indah di utara!',
    lastMessageTime: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: 'chat_buzz',
    name: 'Worker Buzz 🐝',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    isGroup: false,
    isPinned: false,
    isArchived: false,
    unreadCount: 0,
    members: ['user_queen', 'buzz'],
    type: 'direct',
    description: 'Lebah pekerja tercepat, spesialis bunga matahari.',
    lastMessage: 'Aku bawa 5 liter nektar segar malam ini!',
    lastMessageTime: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
  },
  {
    id: 'chat_bob',
    name: 'Bumblebee Bob 🌼',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    isGroup: false,
    isPinned: false,
    isArchived: true,
    unreadCount: 0,
    members: ['user_queen', 'bob'],
    type: 'direct',
    description: 'Lebah pemalas tapi sangat lucu yang suka tidur di kelopak bunga mawar.',
    lastMessage: 'Bzzzt.. kelopak bunga mawar ini empuk sekali.',
    lastMessageTime: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  }
];

export const INITIAL_MESSAGES: Message[] = [
  // AI assistant messages
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

  // Dan messages
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
  },

  // Group messages
  {
    id: 'm_grp_sys',
    chatId: 'chat_hive_group',
    senderId: 'system',
    text: 'Lebah Pekerja Utama membuat grup "Sarang Madu Utama 🍯"',
    type: 'system',
    timestamp: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    status: 'read'
  },
  {
    id: 'm_grp_1',
    chatId: 'chat_hive_group',
    senderId: 'dan',
    text: 'Selamat pagi tim lebah! Hari ini cuaca sangat cerah (28°C), waktu yang sempurna untuk penyerbukan.',
    type: 'text',
    timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    status: 'read'
  },
  {
    id: 'm_grp_2',
    chatId: 'chat_hive_group',
    senderId: 'bob',
    text: 'Aku masih mengantuk bzzzt... Tapi aku siap terbang mencari nektar manis.',
    type: 'text',
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    status: 'read'
  },
  {
    id: 'm_grp_poll',
    chatId: 'chat_hive_group',
    senderId: 'dan',
    text: 'Ayo pilih target bunga penyerbukan kita hari ini!',
    type: 'poll',
    timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    status: 'read',
    pollQuestion: 'Bunga apa yang paling melimpah hari ini? 🌸🌻',
    pollOptions: [
      { id: 'opt_1', text: 'Bunga Matahari (Sunflower)', votes: ['buzz', 'user_queen'] },
      { id: 'opt_2', text: 'Lavender Indah', votes: ['dan'] },
      { id: 'opt_3', text: 'Bunga Mawar Merah', votes: ['bob'] }
    ]
  },
  {
    id: 'm_grp_3',
    chatId: 'chat_hive_group',
    senderId: 'buzz',
    text: 'Buzz: Kami menemukan ladang bunga lavender indah di utara!',
    type: 'text',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    status: 'read'
  },

  // Buzz messages
  {
    id: 'm_buzz_1',
    chatId: 'chat_buzz',
    senderId: 'buzz',
    text: 'Halo ketua lebah, aku sedang terbang tinggi di sektor utara.',
    type: 'text',
    timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    status: 'read'
  },
  {
    id: 'm_buzz_2',
    chatId: 'chat_buzz',
    senderId: 'user_queen',
    text: 'Hati-hati terhadap angin kencang ya Buzz!',
    type: 'text',
    timestamp: new Date(Date.now() - 5.5 * 3600 * 1000).toISOString(),
    status: 'read'
  },
  {
    id: 'm_buzz_3',
    chatId: 'chat_buzz',
    senderId: 'buzz',
    text: 'Aku bawa 5 liter nektar segar malam ini!',
    type: 'text',
    timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    status: 'read'
  },

  // Bob messages
  {
    id: 'm_bob_1',
    chatId: 'chat_bob',
    senderId: 'bob',
    text: 'Bzzzt.. kelopak bunga mawar ini empuk sekali.',
    type: 'text',
    timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    status: 'read'
  }
];

export const INITIAL_CALLS: CallLog[] = [
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
  },
  {
    id: 'call_2',
    userId: 'buzz',
    userName: 'Worker Buzz 🐝',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    type: 'voice',
    isOutgoing: true,
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    status: 'completed',
    duration: '01:45'
  },
  {
    id: 'call_3',
    userId: 'bob',
    userName: 'Bumblebee Bob 🌼',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    type: 'voice',
    isOutgoing: false,
    timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    status: 'missed'
  }
];

export const INITIAL_STATUS: StatusUpdate[] = [
  {
    id: 'status_1',
    userId: 'dan',
    userName: 'Beekeeper Dan 👨‍🌾',
    userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    type: 'image',
    content: 'https://images.unsplash.com/photo-1473081556163-2a17de81fc97?w=600&auto=format&fit=crop&q=80', // Beautiful beehive
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
  },
  {
    id: 'status_3',
    userId: 'bob',
    userName: 'Bumblebee Bob 🌼',
    userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    type: 'text',
    content: 'Zzz.. di kelopak matahari rasanya hangat sekali.. jangan diganggu bzzzt 😴',
    bgStyle: 'bg-gradient-to-r from-amber-600 to-orange-500',
    timestamp: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    viewedBy: []
  }
];

export const INITIAL_COMMUNITIES: Community[] = [
  {
    id: 'comm_1',
    name: 'Masyarakat Lebah Madu Nusantara 🇮🇩',
    description: 'Aliansi pembudidaya lebah madu murni dan pelestari lingkungan alam dari Sabang sampai Merauke.',
    avatar: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=150&auto=format&fit=crop&q=80', // Honey jars
    groupCount: 8,
    memberCount: 1450,
    announcements: [
      {
        id: 'ann_1',
        text: 'Pengumuman: Festival Madu Nusantara akan diselenggarakan bulan depan secara virtual! Siapkan produk terbaik sarangmu. 🍯🏆',
        timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'ann_2',
        text: 'Tips: Di musim pancaroba, pastikan kecukupan air bersih di dekat sarang agar lebah tidak kelelahan mencari minum.',
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
      }
    ]
  },
  {
    id: 'comm_2',
    name: 'Pecinta Penyerbukan Alami 🌸',
    description: 'Penyedia informasi ilmiah dan edukasi praktis mengenai pentingnya peran lebah (pollinators) bagi bumi.',
    avatar: 'https://images.unsplash.com/photo-1508558934129-56633a41a2e5?w=150&auto=format&fit=crop&q=80', // Meadow flowers
    groupCount: 3,
    memberCount: 520,
    announcements: [
      {
        id: 'ann_3',
        text: 'Hindari menyemprot pestisida kimia di pagi hari demi menjaga keamanan lebah pekerja kita ya rekan-rekan!',
        timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
      }
    ]
  }
];

// Simulation for Chat with Queen Bee AI Assistant
export async function simulateAiChat(
  messages: { senderName: string; text: string }[],
  currentUserId: string
): Promise<string> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const lastMsg = messages[messages.length - 1]?.text || '';
  const cleanMsg = lastMsg.toLowerCase();

  // Rules-based system for high-quality interactions in persona
  if (cleanMsg.includes('halo') || cleanMsg.includes('hi') || cleanMsg.includes('helo') || cleanMsg.includes('hei') || cleanMsg.includes('pagi') || cleanMsg.includes('siang') || cleanMsg.includes('sore') || cleanMsg.includes('malam')) {
    return `Halo manis! 🐝 Ratu Lebah di sini menyapamu hangat di sarang BeeChat! Ada yang bisa kubantu hari ini? Madu segar, tips penyerbukan bunga, atau saran produktivitas? Buzz!`;
  }
  
  if (cleanMsg.includes('siapa') || cleanMsg.includes('nama') || cleanMsg.includes('kamu') || cleanMsg.includes('dirimu')) {
    return `Aku adalah Queen Bee AI 👑, penguasa sarang madu BeeChat ini! Tugas utamaku adalah mendampingi lebah pekerja manis seperti kamu agar selalu bersemangat, produktif, dan ceria sepanjang hari. Buzz!`;
  }

  if (cleanMsg.includes('lapar') || cleanMsg.includes('makan') || cleanMsg.includes('lapar') || cleanMsg.includes('haus') || cleanMsg.includes('minum')) {
    return `Bzzzt! Jangan sampai kelelahan, sayang! Coba nikmati sesendok madu murni hangat atau bayangkan nektar bunga lavender yang segar. Ingat untuk beristirahat di kelopak bunga terdekat! 🍯🌸`;
  }

  if (cleanMsg.includes('tips') || cleanMsg.includes('semangat') || cleanMsg.includes('produktivitas') || cleanMsg.includes('kerja') || cleanMsg.includes('malas')) {
    const tips = [
      "Fokus pada satu bunga (tugas) terlebih dahulu sebelum terbang ke bunga lainnya. Itu rahasia lebah pekerja tercepat! 🌸",
      "Istirahatlah setiap 25 menit (metode Pomodoro lebah). Regangkan sayapmu dan hirup udara segar! 🐝",
      "Jaga kebersihan sarangmu. Lingkungan yang rapi membuat pikiran sebersih nektar pagi hari! 🍯",
      "Bekerjasamalah dengan koloni. Obrolkan kesulitanmu di Sarang Madu Utama agar dipikul bersama! 🤝"
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    return `Bzzzt! Ratu punya tips khusus untukmu agar tetap produktif:\n\n"${randomTip}"\n\nTetap manis dan bersemangat ya!`;
  }

  if (cleanMsg.includes('terjemah') || cleanMsg.includes('artikan') || cleanMsg.includes('bahasa')) {
    return `Tentu saja, manis! Kamu bisa menerjemahkan pesan apa pun di dalam sarang ini dengan mengeklik pesan tersebut, lalu memilih bahasa tujuan di menu terjemahan. Ratu sudah menyiapkannya secara otomatis untukmu! 🌐🐝`;
  }

  if (cleanMsg.includes('buat') || cleanMsg.includes('tulis') || cleanMsg.includes('bantu')) {
    return `Dengan senang hati, sayang! Katakan saja apa yang ingin kamu tulis (misalnya surat izin libur lebah, puisi tentang bunga matahari, atau pengumuman sarang), biar Ratu bantu merangkainya seindah kelopak mawar! 🌹🐝`;
  }

  if (cleanMsg.includes('terima kasih') || cleanMsg.includes('thanks') || cleanMsg.includes('makasih') || cleanMsg.includes('suwun')) {
    return `Sama-sama, lebah kecilku yang manis! 🍯 Senang bisa membantumu. Terbanglah dengan aman dan sebarkan kebaikan hari ini! Buzz-buzz! 🐝💛`;
  }

  if (cleanMsg.includes('cuaca') || cleanMsg.includes('hujan') || cleanMsg.includes('panas')) {
    return `Bzzzt! Ratu menyarankan agar kamu selalu memantau langit. Jika mendung, segera kembali ke sarang ya! Kita tidak ingin sayap indahmu basah kuyup terkena badai. Tetap aman! ☔🌻`;
  }

  // Fallback responses with beautiful bee theme
  const fallbacks = [
    `Bzzzt! Pertanyaanmu menarik sekali, sayang! 🍯 Sebagai Ratu Lebah di BeeChat, aku selalu senang mendengar kabarmu. Semoga hari ini penuh dengan nektar kebahagiaan! Tuliskan pesan lain agar sarang kita makin ramai! 🐝💛`,
    `Oh manis sekali! Pesanmu membuat Ratu tersenyum lebar. Katakan, apakah ada hal spesifik tentang pengelolaan sarang atau pengumpulan nektar bunga yang ingin kita bahas hari ini? Buzz! 🌸`,
    `Bzzzt... Ratu sedang memperhatikan seluruh lebah pekerja beraktivitas di taman bunga. Sungguh pemandangan yang indah! Ceritakan padaku, bagaimana harimu berjalan sejauh ini? 🍯🐝`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// Simulation for translation
export async function simulateTranslate(text: string, targetLang: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const key = targetLang.toLowerCase();
  
  // Custom mock translator logic depending on language
  if (key === 'english') {
    return `[English Translation] Honey, let's work together to make our honeycomb the sweetest in the garden! 🍯🐝 (Original: "${text}")`;
  } else if (key === 'japanese') {
    return `[Japanese Translation] ハニー、私たちの蜂の巣を庭で一番甘いものにするために一緒に頑張りましょう！ 🍯🐝 (Original: "${text}")`;
  } else if (key === 'arabic') {
    return `[Arabic Translation] يا حبيبي، دعونا نعمل معاً لجعل خلايا النحل لدينا الأقلى حلاوة في الحديقة! 🍯🐝 (Original: "${text}")`;
  } else if (key === 'spanish') {
    return `[Spanish Translation] ¡Cariño, trabajemos juntos para hacer que nuestro panal sea el más dulce del jardín! 🍯🐝 (Original: "${text}")`;
  }
  
  return `[${targetLang} Translation]: ${text}`;
}

// Simulation for summarizing chats
export async function simulateSummarize(messages: Message[]): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1000));

  const textMessages = messages.filter(m => m.type === 'text');
  if (textMessages.length === 0) {
    return `### Honeycomb Summary 🍯\n\nBelum ada obrolan teks di sarang ini untuk dirangkum bzzzt!`;
  }

  return `### Honeycomb Summary 🍯

- **Aktivitas Koloni**: Para lebah aktif bertukar informasi mengenai lokasi bunga segar dan status pengumpulan madu.
- **Topik Hangat**: Diskusi seputar peningkatan produktivitas lebah pekerja dan koordinasi pembagian sektor terbang.
- **Tindak Lanjut**: 
  1. Melanjutkan penyerbukan di area taman bunga matahari.
  2. Memantau cuaca agar lebah tidak terjebak hujan.
  3. Tetap menjaga komunikasi aktif di Sarang Madu BeeChat!

*Bzzzt! Rangkuman ini dibuat secara instan di dalam browser secara luring!* 🐝`;
}

// Simulation for smart replies suggestions
export async function simulateSuggestReplies(lastMessageText: string): Promise<string[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const clean = lastMessageText.toLowerCase();
  if (clean.includes('halo') || clean.includes('hi') || clean.includes('helo')) {
    return ['Halo manis! 🐝', 'Hai juga! 🍯', 'Buzz! Ada apa?'];
  }
  if (clean.includes('apa kabar') || clean.includes('how are you')) {
    return ['Kabar baik! 🍯', 'Sehat luar biasa!', 'Sibuk tapi seru! 🐝'];
  }
  if (clean.includes('panen') || clean.includes('madu') || clean.includes('nektar')) {
    return ['Ayo panen! 🍯', 'Madu siap diantar!', 'Luar biasa banyak! 🐝'];
  }
  if (clean.includes('bantu') || clean.includes('tanya') || clean.includes('mau nanya')) {
    return ['Tanya apa sayang? 🌸', 'Silakan bzzzt!', 'Tentu, katakan saja!'];
  }
  
  return ['Wah, asyik! 🍯', 'Bzzzt, setuju sekali!', 'Siap meluncur! 🐝'];
}

