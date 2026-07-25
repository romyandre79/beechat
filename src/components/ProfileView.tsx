import { useState, useRef, FormEvent, useEffect, ChangeEvent } from 'react';
import { motion } from 'motion/react';
import { User, QrCode, Phone, Mail, FileText, Camera, Sparkles, Check, Clipboard, ShieldAlert, LockKeyholeOpen } from 'lucide-react';
import { UserProfile } from '../types';
import { cleanName } from '../utils';

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onUnblockUser?: (targetUserId: string) => void;
}

declare const __API_SERVER__: string;
declare const __API_PORT__: string;

const API_BASE = (window.location.protocol.startsWith('http') && !window.location.origin.startsWith('capacitor://') && !window.location.origin.startsWith('http://localhost:80') && !window.location.origin.startsWith('file://'))
  ? ''
  : `http://${__API_SERVER__}:${__API_PORT__}`;

export default function ProfileView({ profile, onUpdateProfile, onUnblockUser }: ProfileViewProps) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [isSaved, setIsSaved] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Blocked Users Management
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);

  const fetchBlockedUsers = async () => {
    try {
      const res = await fetch(API_BASE + `/api/users/blocked/details?userId=${profile.id}`);
      if (res.ok) {
        setBlockedUsers(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch blocked users:', err);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [profile.id]);

  const handleUnblockClick = async (targetUserId: string) => {
    try {
      const res = await fetch(API_BASE + '/api/users/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, blockedUserId: targetUserId })
      });
      if (res.ok) {
        fetchBlockedUsers();
        if (onUnblockUser) {
          onUnblockUser(targetUserId);
        } else {
          alert('Kontak berhasil dibuka blokirnya. 🐝');
        }
      }
    } catch (err) {
      console.error('Failed to unblock user:', err);
    }
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    onUpdateProfile({ name, bio, phone, email });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(`@${profile.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = async () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent('beechat://user/' + profile.username)}`;
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `beechat_qr_${profile.username}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download QR code:', err);
      window.open(qrUrl, '_blank');
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert("Bzzzt! Ukuran avatar terlalu besar, maksimal 3MB agar lebah pekerja kami tidak keberatan mengunggah! 🐝🍯");
      return;
    }

    setIsUploading(true);
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/api/upload');
      xhr.setRequestHeader('x-file-name', file.name);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      const result = await new Promise<{ url: string, fileName: string }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              reject(new Error('Format respons server salah'));
            }
          } else {
            reject(new Error(`Gagal dengan kode status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Koneksi internet terputus'));
        xhr.send(file);
      });

      const absoluteUrl = result.url.startsWith('http') ? result.url : (API_BASE + result.url);
      onUpdateProfile({ avatar: absoluteUrl });
    } catch (err: any) {
      console.error(err);
      alert(`Bzzzt! Gagal mengunggah foto profil: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 font-sans text-white overflow-y-auto">
      {/* Cover and Avatar Section */}
      <div className="relative h-44 bg-neutral-900 overflow-hidden">
        <img
          src={profile.coverPhoto || 'https://images.unsplash.com/photo-1560114928-40f1f1eb26a0?w=800&auto=format&fit=crop&q=80'}
          alt="Cover Pattern"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 to-transparent"></div>
        
        {/* Floating QR Quick Toggle */}
        <button
          onClick={() => setShowQR(true)}
          className="absolute top-4 right-4 p-2.5 bg-neutral-950/80 backdrop-blur hover:bg-amber-400 hover:text-neutral-950 border border-neutral-800 rounded-full transition-all cursor-pointer shadow-lg"
          title="Tampilkan Kode QR Lebahku"
        >
          <QrCode className="w-5 h-5" />
        </button>
      </div>

      {/* Avatar Overlay */}
      <div className="px-6 -mt-16 relative z-10 flex flex-col items-center text-center">
        <div className="relative">
          <img
            src={profile.avatar}
            alt={profile.name}
            className={`w-28 h-28 rounded-full object-cover border-4 border-neutral-950 shadow-2xl transition-opacity ${isUploading ? 'opacity-40' : ''}`}
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-1 right-1 p-2 bg-amber-400 text-neutral-950 hover:bg-amber-500 rounded-full shadow-md hover:scale-105 transition-transform cursor-pointer"
          >
            <Camera className="w-4 h-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        <h2 className="text-xl font-extrabold mt-3">{cleanName(profile.name)}</h2>
        
        {/* Username Copier */}
        <button
          onClick={handleCopyUsername}
          className="text-xs text-neutral-400 hover:text-amber-400 font-mono mt-1 flex items-center space-x-1.5 transition-colors"
        >
          <span>@{cleanName(profile.username)}</span>
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Clipboard className="w-3.5 h-3.5 text-neutral-600" />}
        </button>
      </div>

      {/* Details Form / View */}
      <div className="p-6 max-w-md mx-auto w-full space-y-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">Nama Pengenal</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">Info Status / Bio</label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                required
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono font-sans">Nomor Telepon</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">Alamat Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            {isSaved && (
              <span className="text-xs font-mono font-semibold text-emerald-500 flex items-center animate-pulse">
                <Check className="w-4 h-4 mr-1" /> Profil Berhasil Disimpan!
              </span>
            )}
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs transition-all shadow shadow-amber-400/20 ml-auto cursor-pointer"
            >
              Simpan Profil
            </button>
          </div>
        </form>

        {/* Blocked contacts list section */}
        {blockedUsers.length > 0 && (
          <div className="border-t border-neutral-900 pt-6 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 font-mono flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Daftar Kontak Diblokir ({blockedUsers.length})</span>
            </h3>
            
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {blockedUsers.map((bu) => (
                <div 
                  key={bu.id} 
                  className="flex items-center justify-between p-3 bg-neutral-900/60 border border-neutral-800 rounded-2xl"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {bu.avatar ? (
                      <img src={bu.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] text-neutral-400">🐝</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{cleanName(bu.name)}</p>
                      <p className="text-[9px] text-neutral-500 truncate">@{cleanName(bu.username)}</p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleUnblockClick(bu.id)}
                    className="px-2.5 py-1.5 bg-neutral-850 hover:bg-red-500/10 hover:text-red-400 border border-neutral-800 rounded-lg text-[10px] font-extrabold text-neutral-400 flex items-center space-x-1 transition-all cursor-pointer"
                  >
                    <LockKeyholeOpen className="w-3.5 h-3.5" />
                    <span>Buka Blokir</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QR CODE GENERATOR POPUP DIALOG */}
      {showQR && (
        <div className="fixed inset-0 z-50 bg-neutral-950/95 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-neutral-900 rounded-3xl p-6 border border-neutral-800 shadow-2xl relative text-center"
          >
            {/* Background glowing honeycomb element */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-amber-400/10 blur-2xl rounded-full"></div>
            
            <h3 className="text-lg font-bold">QR Code BeeChat Anda</h3>
            <p className="text-xs text-neutral-400 mt-1">Gunakan untuk berbagi kontak dengan cepat</p>
            
            {/* Custom Stylized QR Code Stage */}
            <div className="my-6 p-4 bg-white rounded-3xl inline-block border-4 border-amber-400 relative z-10 shadow-xl">
              <div className="w-52 h-52 flex items-center justify-center relative">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=208x208&data=${encodeURIComponent('beechat://user/' + profile.username)}`}
                  alt="QR Code"
                  className="w-full h-full object-contain rounded-2xl"
                />
                {/* Honeycomb Center logo overlay */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-400 p-1.5 rounded-xl border border-white shadow-md">
                  <svg className="w-4 h-4 text-neutral-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 2a10 10 0 0 1 10 10v4a2 2 0 0 1-2 2h-4l-4 4-4-4H4a2 2 0 0 1-2-2v-4A10 10 0 0 1 12 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="text-center">
              <h4 className="font-extrabold text-sm">{cleanName(profile.name)}</h4>
              <p className="text-xs font-mono text-neutral-400 mt-0.5">@{cleanName(profile.username)}</p>
            </div>

            <div className="flex space-x-2.5 mt-6 relative z-10">
              <button
                onClick={() => setShowQR(false)}
                className="flex-1 py-2.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 hover:text-white rounded-xl text-xs font-semibold text-neutral-400 transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={handleDownloadQR}
                className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs transition-colors"
              >
                Unduh QR
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
