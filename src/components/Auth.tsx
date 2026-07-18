import { useState, FormEvent, useRef, ChangeEvent } from 'react';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, User, Phone, CheckSquare, Image as ImageIcon, Sparkles, ArrowRight } from 'lucide-react';
import { UserProfile } from '../types';

interface AuthProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const COUNTRIES = [
  { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+64', name: 'New Zealand', flag: '🇳🇿' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+7', name: 'Russia', flag: '🇷🇺' }
];

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('Mari mengumpulkan nektar kebaikan! 🐝🍯');
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('+62');
  const [phoneNum, setPhoneNum] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [useCustomAvatar, setUseCustomAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomAvatar(reader.result as string);
        setUseCustomAvatar(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredCountries = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) || 
    c.code.includes(countrySearch)
  );

  // Cool preselected bee avatars
  const BEE_AVATARS = [
    'https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=150&auto=format&fit=crop&q=80', // Queen Bee Look
    'https://images.unsplash.com/photo-1473081556163-2a17de81fc97?w=150&auto=format&fit=crop&q=80', // Sweet Bee hive
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', // Worker look
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', // Lazy bumblebee
  ];

  const sha256Fallback = (ascii: string): string => {
    function rightRotate(value: number, amount: number) {
      return (value >>> amount) | (value << (32 - amount));
    }
    
    const words: number[] = [];
    const asciiLength = ascii.length;
    for (let i = 0; i < asciiLength; i++) {
      words[i >> 2] |= (ascii.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
    }
    
    words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);
    const wordsLength = ((asciiLength + 8) >> 6) * 16 + 15;
    while (words.length <= wordsLength) words.push(0);
    words[wordsLength] = asciiLength * 8;
    
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h5 = 0x510e527f, h4 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    
    for (let j = 0; j < words.length; j += 16) {
      const w = words.slice(j, j + 16);
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        if (i >= 16) {
          const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
          const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        const ch = (e & f) ^ (~e & g);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const temp1 = (h + S1 + ch + k[i] + (w[i] || 0)) | 0;
        const temp2 = (S0 + maj) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    
    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map(v => (v >>> 0).toString(16).padStart(8, '0'))
      .join('');
  };

  const sha256 = async (message: string): Promise<string> => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    }
    return sha256Fallback(message);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase();
    let userId = cleanUsername || 'user_queen';
    if (userId === 'worker_bee_sweet') {
      userId = 'user_queen';
    }

    try {
      const passwordHash = await sha256(password);

      if (isLogin) {
        const res = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: username, passwordHash })
        });
        const data = await res.json();
        if (res.ok && data.user) {
          onLoginSuccess(data.user);
        } else {
          setError(data.error || 'Gagal masuk bzzzt! 🐝');
        }
      } else {
        const combinedPhone = phoneNum.trim() !== '' ? `${countryCode} ${phoneNum.trim()}` : '';
        const newUser: UserProfile = {
          id: userId,
          name: name,
          username: cleanUsername,
          avatar: useCustomAvatar && customAvatar ? customAvatar : BEE_AVATARS[avatarIndex],
          bio: bio,
          email: email.trim(),
          phone: combinedPhone,
          isOnline: true
        };

        const res = await fetch('/api/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newUser, passwordHash })
        });
        const data = await res.json();
        if (res.ok) {
          onLoginSuccess(newUser);
        } else {
          setError(data.error || 'Gagal mendaftar bzzzt! 🐝');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Kesalahan koneksi ke server database bzzzt! 🐝');
    }
  };

  const handleOAuthLogin = (provider: string) => {
    const userId = 'user_' + provider.toLowerCase();
    // Quick and gorgeous visual feedback of login
    const loggedInUser: UserProfile = {
      id: userId,
      name: `Lebah ${provider}`,
      username: `${provider.toLowerCase()}_bee`,
      avatar: BEE_AVATARS[0],
      bio: `Menebar madu kebaikan via login ${provider}! 🍯`,
      email: `lebah.${provider.toLowerCase()}@beechat.sweet`,
      phone: '+62 800-BEE-SAFE',
      isOnline: true,
    };
    onLoginSuccess(loggedInUser);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Decorative Polygons resembling honeycomb */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <svg className="absolute top-10 right-10 w-48 h-48 text-amber-500" viewBox="0 0 100 100" fill="currentColor">
          <polygon points="50,1 95,25 95,75 50,99 5,75 5,25" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <svg className="absolute bottom-10 left-10 w-72 h-72 text-yellow-600" viewBox="0 0 100 100" fill="currentColor">
          <polygon points="50,1 95,25 95,75 50,99 5,75 5,25" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        {/* Logo and Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center mb-3 shadow-md shadow-amber-400/20">
            <svg className="w-10 h-10 text-neutral-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a10 10 0 0 1 10 10v4a2 2 0 0 1-2 2h-4l-4 4-4-4H4a2 2 0 0 1-2-2v-4A10 10 0 0 1 12 2z" />
              <line x1="9" y1="11" x2="15" y2="11" stroke="black" strokeWidth="2" />
              <line x1="9.5" y1="13" x2="14.5" y2="13" stroke="black" strokeWidth="2" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold font-sans">
            {isLogin ? 'Selamat Datang di BeeChat' : 'Buat Sarang Baru'}
          </h2>
          <p className="text-neutral-400 text-xs mt-1">
            {isLogin ? 'Masuk dan kumpulkan madu obrolan hangatmu!' : 'Daftar dan mulailah mengepakkan sayapmu bersama lebah lain.'}
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-neutral-950 p-1 rounded-xl mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              isLogin ? 'bg-amber-400 text-neutral-950 shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4 inline-block mr-1.5 -mt-0.5" /> Masuk
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              !isLogin ? 'bg-amber-400 text-neutral-950 shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4 inline-block mr-1.5 -mt-0.5" /> Daftar
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl flex items-center justify-center font-medium">
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              {/* Profile Photo selector */}
              <div className="flex flex-col items-center space-y-2 mb-4">
                <label className="text-xs text-neutral-400 uppercase tracking-wider font-mono">Pilih Avatar Lebah</label>
                <div className="flex items-center space-x-2">
                  {BEE_AVATARS.map((url, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setAvatarIndex(index);
                        setUseCustomAvatar(false);
                      }}
                      className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${
                        (!useCustomAvatar && avatarIndex === index) ? 'border-amber-400 scale-110 shadow-lg shadow-amber-400/30' : 'border-transparent opacity-60'
                      }`}
                    >
                      <img src={url} alt="Bee Avatar" className="w-full h-full object-cover" />
                    </button>
                  ))}
                  
                  {/* Custom Uploaded Avatar Option */}
                  {customAvatar && (
                    <button
                      type="button"
                      onClick={() => setUseCustomAvatar(true)}
                      className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${
                        useCustomAvatar ? 'border-amber-400 scale-110 shadow-lg shadow-amber-400/30' : 'border-transparent opacity-60'
                      }`}
                    >
                      <img src={customAvatar} alt="Custom Avatar" className="w-full h-full object-cover" />
                    </button>
                  )}

                  {/* Upload Trigger Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-12 h-12 rounded-full border-2 border-dashed border-neutral-700 hover:border-amber-400 flex items-center justify-center text-neutral-400 hover:text-white transition-all bg-neutral-950 cursor-pointer"
                    title="Unggah Foto Kustom"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-5 w-5 text-neutral-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setName(val);
                      if (val.trim()) {
                        const clean = val.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').trim();
                        const parts = clean.split(/\s+/);
                        const suggestions: string[] = [];
                        if (parts.length > 0 && parts[0] !== '') {
                          const joined = parts.join('');
                          const under = parts.join('_');
                          const dotted = parts.join('.');
                          suggestions.push(under);
                          if (joined !== under) suggestions.push(joined);
                          suggestions.push(dotted);
                          suggestions.push(`${joined}${Math.floor(10 + Math.random() * 90)}`);
                          setUsernameSuggestions(Array.from(new Set(suggestions)).slice(0, 3));
                        } else {
                          setUsernameSuggestions([]);
                        }
                      } else {
                        setUsernameSuggestions([]);
                      }
                    }}
                    placeholder="Contoh: Ratu Madu"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white"
                  />
                </div>
              </div>
            </>
          )}

          {isLogin ? (
            /* Single Consolidated Login Field */
            <div className="space-y-1">
              <label className="text-xs text-neutral-300 font-medium">Username / Email / No. Telepon</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-5 w-5 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    // Also mirror to email or phone if it looks like one
                    if (e.target.value.includes('@')) {
                      setEmail(e.target.value);
                    } else if (/^\+?[0-9-]{6,15}$/.test(e.target.value)) {
                      setPhone(e.target.value);
                    }
                  }}
                  placeholder="Ketik username, email, atau no. telepon"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white"
                />
              </div>
            </div>
          ) : (
            /* Registration Fields */
            <>
              {/* Username */}
              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 h-5 w-5 text-neutral-500 font-bold text-sm select-none">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username_lebah"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white"
                  />
                </div>
                {usernameSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-[11px] text-neutral-400">
                    <span>Saran:</span>
                    {usernameSuggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setUsername(sug)}
                        className="bg-neutral-800 hover:bg-amber-400 hover:text-neutral-950 text-neutral-300 px-2 py-0.5 rounded-full transition-all border border-neutral-800 text-[11px] font-medium"
                      >
                        @{sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium font-sans">Alamat Email (Opsional)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-5 w-5 text-neutral-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="lebah@sarang.com"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Nomor Telepon</label>
                <div className="flex gap-2">
                  <div className="w-28 relative">
                    <button
                      type="button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className="w-full h-10 bg-neutral-950 border border-neutral-800 rounded-xl px-2 text-sm focus:outline-none focus:border-amber-400 text-white font-medium cursor-pointer text-center flex items-center justify-center gap-1.5 select-none"
                    >
                      <span>{COUNTRIES.find(c => c.code === countryCode)?.flag || '🏳️'}</span>
                      <span>{countryCode}</span>
                    </button>
                    
                    {showCountryDropdown && (
                      <div className="absolute top-11 left-0 w-60 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1.5 max-h-60 overflow-hidden">
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Cari negara/kode..."
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 text-white"
                          autoFocus
                        />
                        <div className="flex-1 overflow-y-auto max-h-40 flex flex-col gap-1 scrollbar-thin scrollbar-thumb-neutral-800">
                          {filteredCountries.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setCountryCode(c.code);
                                setShowCountryDropdown(false);
                                setCountrySearch('');
                              }}
                              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 hover:bg-neutral-800 hover:text-amber-400 transition-colors ${
                                countryCode === c.code ? 'bg-amber-400/10 text-amber-400' : 'text-neutral-300'
                              }`}
                            >
                              <span>{c.flag}</span>
                              <span className="font-semibold">{c.code}</span>
                              <span className="truncate text-neutral-500">{c.name}</span>
                            </button>
                          ))}
                          {filteredCountries.length === 0 && (
                            <div className="text-center py-2 text-xs text-neutral-500">Tidak ditemukan</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 relative">
                    <Phone className="absolute left-3 top-2.5 h-5 w-5 text-neutral-500" />
                    <input
                      type="text"
                      value={phoneNum}
                      onChange={(e) => setPhoneNum(e.target.value)}
                      placeholder="8xx-xxxx-xxxx (Opsional)"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Password */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs text-neutral-300 font-medium">Kata Sandi</label>
              {isLogin && (
                <button type="button" className="text-xs text-amber-400 hover:underline">
                  Lupa Sandi?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-neutral-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white"
              />
            </div>
          </div>

          {/* Remember me & terms */}
          {isLogin ? (
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs text-neutral-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-neutral-800 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-neutral-950 w-4 h-4"
                />
                <span>Ingat Saya</span>
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-start space-x-2 text-xs text-neutral-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="rounded border-neutral-800 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-neutral-950 w-4 h-4 mt-0.5"
                  required
                />
                <span>Saya menyetujui Ketentuan Sarang Lebah & Kebijakan Privasi Madu.</span>
              </label>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-amber-400/10 flex items-center justify-center space-x-2 mt-6 cursor-pointer"
          >
            <span>{isLogin ? 'Masuk ke Sarang' : 'Mulai Mengepak Sayap'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase font-mono">
            <span className="bg-neutral-900 px-2 text-neutral-500">Atau masuk dengan</span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleOAuthLogin('Google')}
            className="flex items-center justify-center py-2 bg-neutral-950 border border-neutral-800 hover:border-amber-400/40 rounded-xl text-xs font-semibold hover:text-amber-400 transition-colors"
          >
            Google
          </button>
          <button
            onClick={() => handleOAuthLogin('Apple')}
            className="flex items-center justify-center py-2 bg-neutral-950 border border-neutral-800 hover:border-amber-400/40 rounded-xl text-xs font-semibold hover:text-amber-400 transition-colors"
          >
            Apple
          </button>
          <button
            onClick={() => handleOAuthLogin('Facebook')}
            className="flex items-center justify-center py-2 bg-neutral-950 border border-neutral-800 hover:border-amber-400/40 rounded-xl text-xs font-semibold hover:text-amber-400 transition-colors"
          >
            Facebook
          </button>
        </div>
      </motion.div>
    </div>
  );
}
