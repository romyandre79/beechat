import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Users, Megaphone, Plus, MessageSquare, ShieldAlert, ArrowRight, Sparkles } from 'lucide-react';
import { Community } from '../types';

interface CommunityViewProps {
  communities: Community[];
  onAddCommunity: (name: string, desc: string) => void;
}

export default function CommunityView({ communities, onAddCommunity }: CommunityViewProps) {
  const [showCreator, setShowCreator] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [activeCommId, setActiveCommId] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddCommunity(name, desc);
    setName('');
    setDesc('');
    setShowCreator(false);
  };

  const selectedComm = communities.find((c) => c.id === activeCommId);

  return (
    <div className="flex flex-col h-full bg-neutral-950 font-sans text-white overflow-y-auto">
      {/* View Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-sans">Komunitas</h2>
          <p className="text-xs text-neutral-400">Berkumpul bersama koloni lebah hebat lainnya</p>
        </div>
        <button
          onClick={() => setShowCreator(true)}
          className="p-2 bg-amber-400 text-neutral-950 hover:bg-amber-500 rounded-full transition-colors cursor-pointer"
          title="Buat Komunitas Baru"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {activeCommId && selectedComm ? (
          /* DETAILED ANNOUNCEMENTS AND GROUPS VIEW */
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={() => setActiveCommId(null)}
              className="text-amber-400 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 hover:underline"
            >
              <span>← Kembali Ke Komunitas</span>
            </button>

            {/* Comm Hero Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 flex items-center space-x-4">
              <img
                src={selectedComm.avatar}
                alt={selectedComm.name}
                className="w-16 h-16 rounded-2xl object-cover border border-neutral-800"
              />
              <div>
                <h3 className="text-lg font-bold">{selectedComm.name}</h3>
                <p className="text-xs text-neutral-400 mt-1">{selectedComm.description}</p>
                <div className="flex space-x-3.5 mt-2.5 text-[10px] font-mono text-amber-400">
                  <span>{selectedComm.groupCount} Kelompok Kerja</span>
                  <span>•</span>
                  <span>{selectedComm.memberCount} Lebah Bergabung</span>
                </div>
              </div>
            </div>

            {/* Announcement section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center">
                <Megaphone className="w-4 h-4 mr-2" /> Papan Pengumuman Sarang
              </h4>

              {selectedComm.announcements && selectedComm.announcements.length > 0 ? (
                <div className="space-y-3">
                  {selectedComm.announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="bg-neutral-900/60 border border-amber-400/20 rounded-2xl p-4 space-y-2 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 blur-xl rounded-full"></div>
                      <p className="text-sm leading-relaxed text-neutral-200">{ann.text}</p>
                      <p className="text-[10px] font-mono text-neutral-500 text-right">
                        Disiarkan pada {new Date(ann.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-neutral-900/20 text-center py-8 rounded-2xl border border-dashed border-neutral-800 text-neutral-500 text-xs">
                  Belum ada siaran pengumuman baru dari administrator.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* COMMUNITIES LISTING */
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">Daftar Komunitasku</h3>
            
            {communities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-500">
                <Users className="w-10 h-10 mb-3 text-neutral-600" />
                <p className="text-sm font-medium">Kamu belum bergabung dalam komunitas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {communities.map((comm) => (
                  <button
                    key={comm.id}
                    onClick={() => setActiveCommId(comm.id)}
                    className="w-full flex items-center justify-between p-4 bg-neutral-900/40 hover:bg-neutral-900/80 rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all text-left"
                  >
                    <div className="flex items-center space-x-4">
                      <img
                        src={comm.avatar}
                        alt={comm.name}
                        className="w-14 h-14 rounded-2xl object-cover border border-neutral-800"
                      />
                      <div>
                        <h4 className="font-bold text-sm text-neutral-100">{comm.name}</h4>
                        <p className="text-xs text-neutral-500 line-clamp-1 mt-1">{comm.description}</p>
                        <div className="flex items-center space-x-2 mt-2 text-[10px] font-mono text-amber-400">
                          <span>{comm.groupCount} Grup</span>
                          <span>•</span>
                          <span>{comm.memberCount} Anggota</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-neutral-600" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE DIALOG */}
      {showCreator && (
        <div className="fixed inset-0 z-50 bg-neutral-950/90 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl"
          >
            <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center text-amber-400">
                <Users className="w-4 h-4 mr-1.5" /> Buat Komunitas Baru
              </h3>
              <button onClick={() => setShowCreator(false)} className="p-1 hover:bg-neutral-800 rounded-lg">
                X
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Nama Komunitas</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Koloni Lebah Hutan"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-400 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Deskripsi / Peraturan</label>
                <textarea
                  required
                  rows={3}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Deskripsikan tujuan berkumpul dan ketentuan umum..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-400 text-white resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreator(false)}
                  className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 rounded-xl text-xs font-semibold text-neutral-400"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs transition-colors"
                >
                  Buat Komunitas
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
