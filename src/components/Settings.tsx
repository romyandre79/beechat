import { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, MessageCircle, Bell, Database, HelpCircle, LogOut, Moon, Sun, Info, Palette } from 'lucide-react';

interface SettingsViewProps {
    darkMode: boolean;
    onToggleDarkMode: () => void;
    wallpaper: string;
    onChangeWallpaper: (wallpaperClass: string) => void;
    onLogout: () => void;
}

export const WALLPAPERS = [
    { name: 'Honeycomb Slate (Gelap)', class: 'bg-neutral-950 text-white' },
    { name: 'Amber Glow Gradient', class: 'bg-gradient-to-br from-amber-950 via-neutral-950 to-neutral-900 text-white' },
    { name: 'Forest Nature Green', class: 'bg-gradient-to-br from-emerald-950 via-neutral-950 to-neutral-950 text-white' },
    { name: 'Golden Hive Bright (Terang)', class: 'bg-gradient-to-b from-amber-50 to-orange-100 text-neutral-900' },
    { name: 'Solid Charcoal Simple', class: 'bg-neutral-900 text-white' },
];

export default function SettingsView({
    darkMode,
    onToggleDarkMode,
    wallpaper,
    onChangeWallpaper,
    onLogout,
}: SettingsViewProps) {
    const [readReceipts, setReadReceipts] = useState(true);
    const [lastSeenPrivacy, setLastSeenPrivacy] = useState('Everyone');
    const [securityLock, setSecurityLock] = useState(false);

    return (
        <div className="flex flex-col h-full bg-neutral-950 font-sans text-white overflow-y-auto">
            {/* Header */}
            <div className="p-4 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold font-sans">Pengaturan</h2>
                    <p className="text-xs text-neutral-400">Sesuaikan kenyamanan sarang obrolanmu</p>
                </div>
            </div>

            <div className="p-4 max-w-md mx-auto w-full space-y-6">
                {/* Theme Settings */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center">
                        <Palette className="w-4 h-4 mr-2" /> Tampilan & Wallpaper
                    </h3>

                    {/* Mode Switcher */}
                    <div className="flex items-center justify-between p-2 hover:bg-neutral-950/40 rounded-xl transition-all">
                        <div className="flex items-center space-x-3">
                            {darkMode ? <Moon className="w-5 h-5 text-amber-400" /> : <Sun className="w-5 h-5 text-amber-400" />}
                            <div>
                                <h4 className="font-bold text-sm">Mode Gelap</h4>
                                <p className="text-xs text-neutral-500">Hemat daya baterai ponsel lebahmu</p>
                            </div>
                        </div>
                        <button
                            onClick={onToggleDarkMode}
                            className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${darkMode ? 'bg-amber-400' : 'bg-neutral-800'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-neutral-950 transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {/* Wallpaper Selection */}
                    <div className="space-y-2">
                        <h4 className="font-bold text-sm px-2">Wallpaper Chat Background</h4>
                        <div className="grid grid-cols-1 gap-2 p-1">
                            {WALLPAPERS.map((wp, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => onChangeWallpaper(wp.class)}
                                    className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${wallpaper === wp.class
                                            ? 'border-amber-400 bg-neutral-950 text-amber-400 font-bold'
                                            : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700'
                                        }`}
                                >
                                    <span>{wp.name}</span>
                                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${wallpaper === wp.class ? 'border-amber-400' : 'border-neutral-500'}`}>
                                        {wallpaper === wp.class && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Security & Privacy */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center">
                        <Shield className="w-4 h-4 mr-2" /> Privasi & Keamanan
                    </h3>

                    {/* Last Seen */}
                    <div className="flex items-center justify-between p-2 rounded-xl">
                        <div>
                            <h4 className="font-bold text-sm">Terakhir Dilihat (Last Seen)</h4>
                            <p className="text-xs text-neutral-500">Siapa saja yang bisa melihat kehadiranmu</p>
                        </div>
                        <select
                            value={lastSeenPrivacy}
                            onChange={(e) => setLastSeenPrivacy(e.target.value)}
                            className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                        >
                            <option value="Everyone">Semua Orang</option>
                            <option value="My Contacts">Kontak Saya</option>
                            <option value="Nobody">Tidak Ada</option>
                        </select>
                    </div>

                    {/* Read Receipts */}
                    <div className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-950/40 transition-all">
                        <div>
                            <h4 className="font-bold text-sm">Laporan Dibaca (Double Tick)</h4>
                            <p className="text-xs text-neutral-500">Tampilkan centang ganda kuning saat membaca</p>
                        </div>
                        <button
                            onClick={() => setReadReceipts(prev => !prev)}
                            className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${readReceipts ? 'bg-amber-400' : 'bg-neutral-800'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-neutral-950 transition-transform ${readReceipts ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {/* App Lock */}
                    <div className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-950/40 transition-all">
                        <div className="flex items-center space-x-3">
                            <Lock className="w-5 h-5 text-neutral-400" />
                            <div>
                                <h4 className="font-bold text-sm">Kunci Aplikasi (App Lock)</h4>
                                <p className="text-xs text-neutral-500">Minta Sidik Jari/Sandi saat membuka</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSecurityLock(prev => !prev)}
                            className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${securityLock ? 'bg-amber-400' : 'bg-neutral-800'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-neutral-950 transition-transform ${securityLock ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                {/* Informational Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center">
                        <Info className="w-4 h-4 mr-2" /> Tentang Aplikasi
                    </h3>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                        BeeChat merupakan sarang obrolan premium dan terenkripsi yang memiliki integritas tinggi. Diperkaya dengan asisten cerdas <strong>Queen Bee AI</strong> berbasis model kognitif tercanggih Gemini API.
                    </p>
                    <div className="pt-2 text-[10px] font-mono text-neutral-500 flex justify-between">
                        <span>Dibuat dengan ❤️ di AI Studio</span>
                        <span>Versi 2.4.0 (PWA)</span>
                    </div>
                </div>

                {/* Logout */}
                <button
                    onClick={onLogout}
                    className="w-full py-3 bg-red-950/60 hover:bg-red-900 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar Dari Sarang Lebah</span>
                </button>
            </div>
        </div>
    );
}
