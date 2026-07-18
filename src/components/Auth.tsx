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
    
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = 'length';
    let i, j;
    let result = '';

    const words: number[] = [];
    const asciiLength = ascii[lengthProperty] * 8;
    
    let hash: number[] = [];
    const k: number[] = [];
    let primeCounter = 0;

    const isComposite: Record<number, number> = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = 1;
        }
        if (primeCounter < 8) {
          hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        }
        k[primeCounter++] = (mathPow(candidate, 1/3) * maxWord) | 0;
      }
    }
    
    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << (24 - (i % 4) * 8);
    }
    words[words[lengthProperty]] = ((asciiLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiLength | 0);
    
    for (j = 0; j < words[lengthProperty]; j += 16) {
      const w = words.slice(j, j + 16);
      const oldHash = hash.slice(0);
      
      while (w[lengthProperty] < 64) {
        const w15 = w[w[lengthProperty] - 15];
        const w2 = w[w[lengthProperty] - 2];
        
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        
        w.push((w[w[lengthProperty] - 16] + s0 + w[w[lengthProperty] - 7] + s1) | 0);
      }
      
      for (i = 0; i < 64; i++) {
        const a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
        
        const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = s0 + maj;
        
        const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = h + s1 + ch + k[i] + w[i];
        
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
        hash.length = 8;
      }
      
      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }
    
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? '0' : '') + b.toString(16);
      }
    }
    return result;
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
