import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Heart, Send, ArrowLeft, Camera, Type, Volume2 } from 'lucide-react';
import { StatusUpdate, UserProfile, Chat } from '../types';
import { cleanName } from '../utils';

const API_BASE = (window.location.protocol.startsWith('http') && !window.location.origin.startsWith('capacitor://') && !window.location.origin.startsWith('http://localhost:80') && !window.location.origin.startsWith('file://')) ? window.location.origin : 'http://103.29.212.67:3000';

interface StatusViewProps {
  statuses: StatusUpdate[];
  currentUser: UserProfile;
  chats: Chat[];
  uploadProgress: number | null;
  onAddStatus: (text: string, type: 'text' | 'image' | 'video', bgStyle?: string) => void;
}

export default function StatusView({ statuses, currentUser, chats, uploadProgress, onAddStatus }: StatusViewProps) {
  const [activeStoryGroup, setActiveStoryGroup] = useState<string | null>(null); // userId of active story being viewed
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showCreator, setShowCreator] = useState(false);
  const [newStatusText, setNewStatusText] = useState('');
  const [selectedBg, setSelectedBg] = useState('bg-gradient-to-r from-amber-500 to-yellow-500');
  const [statusReply, setStatusReply] = useState('');
  const [liked, setLiked] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localProgress, setLocalProgress] = useState<number | null>(null);

  // Trimming states
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bgStyles = [
    'bg-gradient-to-r from-amber-500 to-yellow-500',
    'bg-gradient-to-r from-orange-600 to-amber-500',
    'bg-gradient-to-r from-amber-600 to-yellow-400',
    'bg-gradient-to-r from-yellow-500 to-yellow-300',
    'bg-gradient-to-r from-neutral-800 to-neutral-700',
  ];

  // Group statuses by user
  const groupedStatuses = statuses.reduce<Record<string, StatusUpdate[]>>((acc, status) => {
    if (!acc[status.userId]) {
      acc[status.userId] = [];
    }
    acc[status.userId].push(status);
    return acc;
  }, {});

  // Extract all user IDs of other users we are in communication with
  const chatUserIds = chats.reduce<string[]>((acc, chat) => {
    if (chat.members) {
      chat.members.forEach(memberId => {
        if (memberId !== currentUser.id && !acc.includes(memberId)) {
          acc.push(memberId);
        }
      });
    }
    return acc;
  }, []);

  const userIds = Object.keys(groupedStatuses).filter(id => id !== currentUser.id && chatUserIds.includes(id));
  const activeStories = activeStoryGroup ? groupedStatuses[activeStoryGroup] : [];
  const currentStory = activeStories[activeStoryIndex];

  // Story autoplay effect
  useEffect(() => {
    if (!activeStoryGroup) return;

    setProgress(0);
    const duration = 5000; // 5 seconds per story
    const step = 50; // update every 50ms
    const totalSteps = duration / step;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      setProgress((currentStep / totalSteps) * 100);

      if (currentStep >= totalSteps) {
        clearInterval(interval);
        // Go to next story
        if (activeStoryIndex < activeStories.length - 1) {
          setActiveStoryIndex(prev => prev + 1);
        } else {
          // Finished all stories for this user, check if there's a next user
          const currentUserIndex = userIds.indexOf(activeStoryGroup);
          if (currentUserIndex < userIds.length - 1) {
            setActiveStoryGroup(userIds[currentUserIndex + 1]);
            setActiveStoryIndex(0);
          } else {
            // Close status viewer
            setActiveStoryGroup(null);
          }
        }
      }
    }, step);

    return () => clearInterval(interval);
  }, [activeStoryGroup, activeStoryIndex, activeStoryGroup ? groupedStatuses[activeStoryGroup]?.length : 0]);

  const handleCreateStatus = async (e: FormEvent) => {
    e.preventDefault();
    if (!newStatusText.trim()) return;
    setIsUploading(true);
    try {
      await onAddStatus(newStatusText, 'text', selectedBg);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      setNewStatusText('');
      setShowCreator(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's a video and size > 3MB
    if (file.type.startsWith('video/') && file.size > 3 * 1024 * 1024) {
      setPendingVideo(file);
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = url;
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration);
        setTrimStart(0);
        setTrimEnd(Math.min(video.duration, 15)); // default to max 15s or full duration
        URL.revokeObjectURL(url);
      };
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Limit to 3MB for image or smaller video to prevent blocking remote DB connection
    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert("Bzzzt! Ukuran media terlalu besar, maksimal 3MB agar sayap lebah kami tidak keberatan mengunggah! 🐝🍯");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setLocalProgress(0);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/api/upload');
      xhr.setRequestHeader('x-file-name', file.name);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setLocalProgress(percent);
        }
      };

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

      const type = file.type.startsWith('video/') ? 'video' : 'image';
      await onAddStatus(result.url, type);
    } catch (err: any) {
      console.error(err);
      alert(`Bzzzt! Gagal mengunggah media status: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      setLocalProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTrimVideo = async () => {
    if (!pendingVideo) return;
    setIsTrimming(true);
    setTrimProgress(0);

    const videoUrl = URL.createObjectURL(pendingVideo);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    
    // Wait for metadata to load
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        resolve();
      };
    });

    video.currentTime = trimStart;

    // Wait for seek to complete
    await new Promise<void>((resolve) => {
      video.onseeked = () => {
        resolve();
      };
    });

    // Get stream from video element
    const stream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
    
    let options = {};
    const candidateTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    for (const type of candidateTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        options = { mimeType: type };
        break;
      }
    }
    const mediaRecorder = new MediaRecorder(stream, options);
    
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const trimDuration = trimEnd - trimStart;

    const processPromise = new Promise<File>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const trimmedBlob = new Blob(chunks, { type: 'video/webm' });
        const trimmedFile = new File([trimmedBlob], pendingVideo.name.replace(/\.[^/.]+$/, "") + "_trimmed.webm", {
          type: 'video/webm'
        });
        resolve(trimmedFile);
      };

      video.play();
      mediaRecorder.start();

      const checkInterval = setInterval(() => {
        const elapsed = video.currentTime - trimStart;
        const progressPercent = Math.min(100, Math.round((elapsed / trimDuration) * 100));
        setTrimProgress(progressPercent);

        if (video.currentTime >= trimEnd || video.ended) {
          clearInterval(checkInterval);
          video.pause();
          mediaRecorder.stop();
          stream.getTracks().forEach((track: any) => track.stop());
          URL.revokeObjectURL(videoUrl);
        }
      }, 100);
    });

    try {
      const processedFile = await processPromise;
      setPendingVideo(null);
      setIsUploading(true);
      setLocalProgress(0);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/api/upload');
      xhr.setRequestHeader('x-file-name', processedFile.name);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setLocalProgress(percent);
        }
      };

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
        xhr.send(processedFile);
      });

      await onAddStatus(result.url, 'video');
    } catch (err: any) {
      console.error(err);
      alert(`Bzzzt! Gagal memotong atau mengunggah video: ${err.message || err}`);
    } finally {
      setIsTrimming(false);
      setIsUploading(false);
      setLocalProgress(null);
    }
  };

  const handleSendReply = () => {
    if (!statusReply.trim()) return;
    // Simulate status reply message
    alert(`Balasan status terkirim ke ${currentStory.userName}: "${statusReply}"`);
    setStatusReply('');
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 font-sans text-white overflow-y-auto">
      {/* Tab Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold font-sans">Status</h2>
          <p className="text-xs text-neutral-400">Bagikan momen termanismu hari ini</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCreator(true)}
            className="p-2 bg-neutral-800 hover:bg-amber-400 hover:text-neutral-950 rounded-full transition-colors cursor-pointer"
            title="Buat Status Teks"
          >
            <Type className="w-5 h-5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-amber-400 text-neutral-950 hover:bg-amber-500 rounded-full transition-colors cursor-pointer"
            title="Bagikan Foto/Video Sarang"
          >
            <Camera className="w-5 h-5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*"
            className="hidden"
          />
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* User's Own Status Row */}
        <div className="flex items-center space-x-4 p-2 hover:bg-neutral-900/40 rounded-2xl transition-colors">
          <div className="relative">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-neutral-700"
            />
            <button
              onClick={() => setShowCreator(true)}
              className="absolute bottom-0 right-0 p-1 bg-amber-400 text-neutral-950 rounded-full hover:scale-105 transition-transform"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>
          <div>
            <h3 className="font-semibold text-sm">Status Saya</h3>
            <p className="text-xs text-neutral-500">Ketuk untuk menambahkan pembaruan manis</p>
          </div>
        </div>

        {/* Divider */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono mb-3">Pembaruan Terbaru</h4>
          <div className="space-y-3">
            {userIds.map(userId => {
              const userStories = groupedStatuses[userId];
              const latestStory = userStories[userStories.length - 1];
              
              return (
                <button
                  key={userId}
                  onClick={() => {
                    setActiveStoryGroup(userId);
                    setActiveStoryIndex(0);
                  }}
                  className="w-full flex items-center space-x-4 p-2.5 hover:bg-neutral-900/60 rounded-2xl transition-all text-left border border-transparent hover:border-neutral-800/40"
                >
                  {/* Status Ring - Colored yellow indicating unread */}
                  <div className="relative flex items-center justify-center w-15 h-15 rounded-full p-[3px] border-2 border-amber-400 animate-pulse">
                    <img
                      src={latestStory.userAvatar}
                      alt={cleanName(latestStory.userName)}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{cleanName(latestStory.userName)}</h3>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">
                      {latestStory.type === 'text' ? latestStory.content : latestStory.type === 'video' ? '🎬 Video baru' : '📷 Foto baru'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-neutral-500">
                      {new Date(latestStory.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* VIDEO TRIMMER DIALOG */}
      {pendingVideo && (
        <div className="fixed inset-0 z-50 bg-neutral-950/90 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl"
          >
            <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center text-amber-400">
                <Camera className="w-4 h-4 mr-1.5" /> Potong Video Status
              </h3>
              <button onClick={() => setPendingVideo(null)} className="p-1 hover:bg-neutral-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-xs text-neutral-400">
                Video lebah ini berukuran <strong>{(pendingVideo.size / (1024 * 1024)).toFixed(1)} MB</strong>. Agar sayap lebah kami tidak keberatan mengunggah, potong durasi video ini bzzzt! 🐝🍯
              </p>
              
              <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center">
                <video
                  src={URL.createObjectURL(pendingVideo)}
                  controls
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400 font-medium">Mulai (detik)</label>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, trimEnd - 1)}
                      step={0.1}
                      value={trimStart}
                      onChange={(e) => setTrimStart(Math.max(0, Math.min(parseFloat(e.target.value) || 0, trimEnd - 0.5)))}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400 font-medium">Selesai (detik)</label>
                    <input
                      type="number"
                      min={trimStart + 0.5}
                      max={videoDuration}
                      step={0.1}
                      value={trimEnd}
                      onChange={(e) => setTrimEnd(Math.max(trimStart + 0.5, Math.min(parseFloat(e.target.value) || videoDuration, videoDuration)))}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-neutral-400 font-medium flex justify-between">
                    <span>Rentang Potong Timeline</span>
                    <span className="font-mono text-amber-400 text-[10px]">{(trimEnd - trimStart).toFixed(1)}s dari {videoDuration.toFixed(1)}s</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min={0}
                      max={videoDuration}
                      step={0.1}
                      value={trimStart}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setTrimStart(val);
                        if (val >= trimEnd) setTrimEnd(Math.min(videoDuration, val + 1));
                      }}
                      className="w-full accent-amber-400"
                    />
                    <input
                      type="range"
                      min={0}
                      max={videoDuration}
                      step={0.1}
                      value={trimEnd}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setTrimEnd(val);
                        if (val <= trimStart) setTrimStart(Math.max(0, val - 1));
                      }}
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              </div>

              {isTrimming ? (
                <div className="space-y-2 py-2">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-amber-400">Sedang memotong video...</span>
                    <span>{trimProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-150"
                      style={{ width: `${trimProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setPendingVideo(null)}
                    className="px-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleTrimVideo}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs transition-all shadow"
                  >
                    Potong & Bagikan
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* CREATE STATUS TEXT DIALOG */}
      {showCreator && (
        <div className="fixed inset-0 z-50 bg-neutral-950/90 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl"
          >
            <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center text-amber-400">
                <Type className="w-4 h-4 mr-1.5" /> Buat Status Teks
              </h3>
              <button onClick={() => setShowCreator(false)} className="p-1 hover:bg-neutral-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateStatus}>
              {/* Wallpaper/Canvas box */}
              <div className={`h-64 ${selectedBg} flex items-center justify-center p-6 relative transition-all`}>
                <textarea
                  required
                  maxLength={150}
                  value={newStatusText}
                  onChange={(e) => setNewStatusText(e.target.value)}
                  placeholder="Ketik status manismu di sini..."
                  className="w-full bg-transparent text-white placeholder-white/60 text-center text-xl font-bold font-sans resize-none border-none focus:outline-none focus:ring-0"
                />
                <span className="absolute bottom-3 right-3 text-[10px] font-mono bg-black/20 px-2 py-0.5 rounded text-white/80">
                  {150 - newStatusText.length} karakter
                </span>
              </div>
              {/* Control tray */}
              <div className="p-4 bg-neutral-900 flex justify-between items-center border-t border-neutral-800">
                <div className="flex space-x-1.5">
                  {bgStyles.map((style, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedBg(style)}
                      className={`w-7 h-7 rounded-full border ${selectedBg === style ? 'border-white scale-110' : 'border-transparent'} ${style}`}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  className="bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center space-x-1"
                >
                  <span>Bagikan</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* FULLSCREEN STORY VIEWER */}
      <AnimatePresence>
        {activeStoryGroup && currentStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col justify-between"
          >
            {/* Top Indicator bar */}
            <div className="p-4 absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent">
              {/* Progress bars */}
              <div className="flex space-x-1 mb-3">
                {activeStories.map((_, idx) => (
                  <div key={idx} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-75"
                      style={{
                        width: idx < activeStoryIndex ? '100%' : idx === activeStoryIndex ? `${progress}%` : '0%',
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Status Header info */}
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center space-x-3">
                  <button onClick={() => setActiveStoryGroup(null)} className="p-1 hover:bg-white/10 rounded-lg mr-1">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <img
                    src={currentStory.userAvatar}
                    alt={cleanName(currentStory.userName)}
                    className="w-10 h-10 rounded-full object-cover border border-amber-400"
                  />
                  <div>
                    <h4 className="font-bold text-sm">{cleanName(currentStory.userName)}</h4>
                    <p className="text-[10px] text-white/70 font-mono">
                      {formatMessageTime(currentStory.timestamp)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setActiveStoryGroup(null)} className="p-1.5 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Core Story Content */}
            <div className="flex-1 flex items-center justify-center p-4 w-full h-full">
              {currentStory.type === 'text' ? (
                <div className={`w-full max-w-lg aspect-square ${currentStory.bgStyle || 'bg-gradient-to-r from-amber-500 to-yellow-500'} rounded-3xl flex items-center justify-center p-8 text-center text-2xl font-extrabold shadow-2xl`}>
                  <p>{currentStory.content}</p>
                </div>
              ) : currentStory.type === 'video' ? (
                <div className="max-w-full max-h-[80vh] w-full flex justify-center relative rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl bg-black">
                  <video
                    src={currentStory.content.startsWith('/') ? (API_BASE + currentStory.content) : currentStory.content}
                    controls
                    autoPlay
                    playsInline
                    className="max-w-full max-h-[75vh] object-contain"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-center text-sm font-semibold z-10">
                    🎬 Video Sarang • Aktivitas lebah pekerja!
                  </div>
                </div>
              ) : (
                <div className="max-w-full max-h-[80vh] relative rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl">
                  <img
                    src={currentStory.content.startsWith('/') ? (API_BASE + currentStory.content) : currentStory.content}
                    alt="Story media"
                    className="w-full max-h-[75vh] object-contain"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-center text-sm font-semibold">
                    🐝 Honeycomb View • Mengumpulkan madu harian!
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Quick Reply bar */}
            <div className="p-4 bg-gradient-to-t from-black to-black/60 border-t border-neutral-900/40 relative z-20 flex items-center space-x-3">
              <input
                type="text"
                placeholder={`Balas ke ${currentStory.userName}...`}
                value={statusReply}
                onChange={(e) => setStatusReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                className="flex-1 bg-neutral-900/80 border border-neutral-800 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={() => setLiked(!liked)}
                className={`p-2 rounded-full transition-all ${liked ? 'text-rose-500 scale-125' : 'text-white/60 hover:text-rose-500'}`}
              >
                <Heart className="w-6 h-6 fill-current" />
              </button>
              <button
                onClick={handleSendReply}
                className="p-2.5 bg-amber-400 text-neutral-950 rounded-xl hover:scale-105 transition-transform"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isUploading && (
        <div className="fixed inset-0 z-[60] bg-neutral-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col items-center space-y-4 shadow-2xl max-w-xs w-full text-center">
            {/* Spinning Honeycomb / Bee loading animation */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-amber-400/20 border-t-amber-400 rounded-full animate-spin"></div>
              <span className="text-2xl animate-bounce">🐝</span>
            </div>
            <div className="w-full space-y-3">
              <h3 className="font-bold text-sm text-white">
                Mengunggah... {localProgress !== null ? `${localProgress}%` : (uploadProgress !== null ? `${uploadProgress}%` : '')}
              </h3>
              <p className="text-xs text-neutral-400">Sarang lebah sedang mengirim media Anda ke database remote. Harap tunggu bzzzt!</p>
              
              {(localProgress !== null || uploadProgress !== null) && (
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full bg-amber-400 transition-all duration-150"
                    style={{ width: `${localProgress !== null ? localProgress : uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMessageTime(timestampStr: string): string {
  const date = new Date(timestampStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
