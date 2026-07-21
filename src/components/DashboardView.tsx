import { useState, useEffect, FormEvent } from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, Users, AlertOctagon, Activity, Radio, Megaphone, UserX, UserCheck, RefreshCw, Cpu, Server } from 'lucide-react';
import { cleanName } from '../utils';

interface UserItem {
  id: string;
  name: string;
  username: string;
  avatar: string;
  reports: number;
  status: 'active' | 'banned';
}

interface ReportItem {
  id: string;
  reportedUser: string;
  reporter: string;
  reason: string;
  timestamp: string;
  status: 'pending' | 'resolved';
}

interface DashboardViewProps {
  onDispatchAnnouncement: (text: string) => void;
  adminId: string;
}

export default function DashboardView({ onDispatchAnnouncement, adminId }: DashboardViewProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);

  // Fetch real users and reports from DB on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`/api/admin/users?adminId=${adminId}`);
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (err) {
        console.error('Failed to fetch admin users:', err);
      }
    };

    const fetchReports = async () => {
      try {
        const res = await fetch(`/api/admin/reports?adminId=${adminId}`);
        if (res.ok) {
          const data = await res.json();
          setReports(data);
        }
      } catch (err) {
        console.error('Failed to fetch admin reports:', err);
      }
    };

    fetchUsers();
    fetchReports();
  }, [adminId]);

  const [announcementText, setAnnouncementText] = useState('');
  const [announcementSuccess, setAnnouncementSuccess] = useState(false);

  // Live Server Stats
  const [serverStats, setServerStats] = useState({
    cpu: 24,
    memory: 42,
    latency: 18,
    uptime: '14 Hari, 5 Jam'
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setServerStats({
        cpu: Math.floor(Math.random() * 25) + 15,
        memory: Math.floor(Math.random() * 5) + 40,
        latency: Math.floor(Math.random() * 8) + 12,
        uptime: '14 Hari, 5 Jam'
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleBanToggle = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/users/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, targetUserId: userId })
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(prev => prev.map(u => {
          if (u.id === userId) {
            const nextStatus = data.isBanned ? 'banned' : 'active';
            alert(`Status ${u.name} berhasil diubah menjadi: ${nextStatus.toUpperCase()}`);
            return { ...u, status: nextStatus };
          }
          return u;
        }));
      } else {
        const err = await res.json();
        alert(`Bzzzt! Gagal mengubah status ban: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      alert('Bzzzt! Gagal menghubungkan ke server.');
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      const res = await fetch('/api/admin/reports/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, reportId })
      });
      if (res.ok) {
        setReports(prev => prev.map(r => {
          if (r.id === reportId) {
            return { ...r, status: 'resolved' as const };
          }
          return r;
        }));
      } else {
        const err = await res.json();
        alert(`Gagal menyelesaikan aduan: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      alert('Bzzzt! Gagal menghubungkan ke server.');
    }
  };

  const handleSendAnnouncement = (e: FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    onDispatchAnnouncement(announcementText);
    setAnnouncementText('');
    setAnnouncementSuccess(true);
    setTimeout(() => setAnnouncementSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 font-sans text-white overflow-y-auto">
      {/* Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-sans flex items-center">
            <LayoutDashboard className="w-5 h-5 mr-2 text-amber-400" /> Admin Dashboard
          </h2>
          <p className="text-xs text-neutral-400">Pusat kendali sarang dan moderator BeeChat</p>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-4xl mx-auto w-full">
        {/* GRID: Server Status & Basic Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 flex flex-col justify-between">
            <div className="flex justify-between items-center text-neutral-400">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider">CPU Server</span>
              <Cpu className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-extrabold font-mono">{serverStats.cpu}%</h3>
              <p className="text-[9px] text-emerald-500 mt-1 font-semibold flex items-center">
                ● Normal bzzzt
              </p>
            </div>
          </div>

          <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 flex flex-col justify-between">
            <div className="flex justify-between items-center text-neutral-400">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Memori RAM</span>
              <Server className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-extrabold font-mono">{serverStats.memory}%</h3>
              <p className="text-[9px] text-neutral-400 mt-1 font-semibold">
                8.4 GB dari 16 GB
              </p>
            </div>
          </div>

          <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 flex flex-col justify-between">
            <div className="flex justify-between items-center text-neutral-400">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Ping Latency</span>
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-extrabold font-mono">{serverStats.latency}ms</h3>
              <p className="text-[9px] text-neutral-400 mt-1 font-semibold">
                Sangat Cepat & Responsif
              </p>
            </div>
          </div>

          <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 flex flex-col justify-between">
            <div className="flex justify-between items-center text-neutral-400">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Server Uptime</span>
              <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
            </div>
            <div className="mt-2">
              <h3 className="text-xs font-bold leading-relaxed">{serverStats.uptime}</h3>
              <p className="text-[9px] text-emerald-500 mt-1 font-semibold">
                Tanpa Hambatan
              </p>
            </div>
          </div>
        </div>

        {/* Dispatch global announcement */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 blur-2xl rounded-full"></div>
          
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center">
            <Megaphone className="w-4 h-4 mr-2" /> Siarkan Pengumuman Global
          </h3>
          <p className="text-xs text-neutral-400">Kirimkan pembaruan langsung ke seluruh komunitas di bawah naungan sarang.</p>
          
          <form onSubmit={handleSendAnnouncement} className="flex space-x-2.5 pt-1.5 relative z-10">
            <input
              type="text"
              required
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="Tulis pengumuman penting di sini..."
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Kirim Siaran
            </button>
          </form>
          {announcementSuccess && (
            <p className="text-xs text-emerald-400 font-mono font-bold animate-pulse mt-2">
              ✓ Pengumuman berhasil dikirimkan ke seluruh sarang lebah!
            </p>
          )}
        </div>

        {/* User management and reports stacked */}
        <div className="flex flex-col space-y-6">
          {/* User Moderation */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center">
              <Users className="w-4 h-4 mr-2" /> Moderasi Anggota
            </h3>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-2xl border border-neutral-800/40">
                  <div className="flex items-center space-x-3">
                    <img src={u.avatar} alt={cleanName(u.name)} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <h4 className="font-bold text-xs">{cleanName(u.name)}</h4>
                      <p className="text-[10px] font-mono text-neutral-500">@{cleanName(u.username)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {u.reports > 0 && (
                      <span className="text-[10px] bg-red-950/80 text-red-400 border border-red-500/10 px-2 py-0.5 rounded font-mono font-bold">
                        {u.reports} Laporkan
                      </span>
                    )}
                    <button
                      onClick={() => handleBanToggle(u.id)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        u.status === 'active'
                          ? 'bg-red-950/40 text-red-400 hover:bg-red-900'
                          : 'bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900'
                      }`}
                      title={u.status === 'active' ? 'Ban User' : 'Unban User'}
                    >
                      {u.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Reports list */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center">
              <AlertOctagon className="w-4 h-4 mr-2" /> Aduan & Laporan Pelanggaran
            </h3>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {reports.map(r => (
                <div key={r.id} className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800/40 space-y-2 text-xs relative">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-red-400">{r.reportedUser}</span>
                    <span className="text-[9px] font-mono text-neutral-500">Oleh: {r.reporter}</span>
                  </div>
                  <p className="text-neutral-300 leading-relaxed text-[11px]">{r.reason}</p>
                  
                  <div className="flex justify-between items-center pt-1.5 border-t border-neutral-900">
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                      r.status === 'pending' ? 'bg-amber-950/80 text-amber-400' : 'bg-emerald-950/80 text-emerald-400'
                    }`}>
                      {r.status === 'pending' ? 'Menunggu' : 'Terselesaikan'}
                    </span>
                    
                    {r.status === 'pending' && (
                      <button
                        onClick={() => handleResolveReport(r.id)}
                        className="text-[10px] font-bold text-amber-400 hover:underline cursor-pointer"
                      >
                        Selesaikan Laporan
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
