import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Phone, Video, Search, ArrowLeft, Send, Smile, Paperclip, Mic, Image as ImageIcon, Sparkles, Languages,
  BookOpen, Star, Pin, Trash2, Edit2, Reply, Copy, Check, CheckCheck, MoreVertical, Play, Pause, Vote, Plus, Lock, FileText, Camera
} from 'lucide-react';
import { Chat, Message, UserProfile, PollOption, Sticker } from '../types';
import { speakText, formatMessageTime, simulateTranslate, simulateSummarize, simulateSuggestReplies } from '../utils';

interface ChatRoomProps {
  chat: Chat;
  messages: Message[];
  currentUser: UserProfile;
  onSendMessage: (
    text: string,
    type?: Message['type'],
    pollQuestion?: string,
    pollOptions?: string[],
    fileName?: string,
    fileSize?: string,
    replyToId?: string,
    replyToText?: string,
    duration?: number
  ) => void;
  onBack: () => void;
  onStartCall: (type: 'voice' | 'video') => void;
  onUpdateMessage: (messageId: string, updated: Partial<Message>) => void;
  onDeleteMessage: (messageId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onBlockUser: (targetUserId: string) => void;
  onUnblockUser: (targetUserId: string) => void;
  blockedUsers: string[];
}
declare const __API_SERVER__: string;
declare const __API_PORT__: string;

const API_BASE = (window.location.protocol.startsWith('http') && !window.location.origin.startsWith('capacitor://') && !window.location.origin.startsWith('http://localhost:80') && !window.location.origin.startsWith('file://'))
  ? ''
  : `http://${__API_SERVER__}:${__API_PORT__}`;

export default function ChatRoom({
  chat,
  messages,
  currentUser,
  onSendMessage,
  onBack,
  onStartCall,
  onUpdateMessage,
  onDeleteMessage,
  onDeleteChat,
  onBlockUser,
  onUnblockUser,
  blockedUsers
}: ChatRoomProps) {
  const [inputText, setInputText] = useState('');
  const [activeMessageIdMenu, setActiveMessageIdMenu] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  
  // Smart helpers state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isTranslatingId, setIsTranslatingId] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [chatSummary, setChatSummary] = useState<string | null>(null);
  
  // UI Panels
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showExtendedReactions, setShowExtendedReactions] = useState(false);
  const [selectedReactionMsgId, setSelectedReactionMsgId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Group Members Details State
  const [showGroupDetailsModal, setShowGroupDetailsModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState<UserProfile[]>([]);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<UserProfile[]>([]);
  const [isSearchingMember, setIsSearchingMember] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Fetch group members list
  useEffect(() => {
    if (!chat.isGroup) return;
    const fetchMembers = async () => {
      setIsLoadingMembers(true);
      try {
        const res = await fetch(API_BASE + `/api/chats/${chat.id}/members`);
        if (res.ok) {
          setGroupMembers(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch group members:', err);
      } finally {
        setIsLoadingMembers(false);
      }
    };
    fetchMembers();
    const interval = setInterval(fetchMembers, 10000);
    return () => clearInterval(interval);
  }, [chat.id, chat.isGroup]);

  // Search users to add to group
  useEffect(() => {
    if (!searchMemberQuery.trim()) {
      setMemberSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearchingMember(true);
      try {
        const res = await fetch(API_BASE + `/api/users/search?q=${encodeURIComponent(searchMemberQuery)}`);
        if (res.ok) {
          const data: UserProfile[] = await res.json();
          // Filter out existing members
          const existingIds = groupMembers.map(m => m.id);
          setMemberSearchResults(data.filter(u => !existingIds.includes(u.id)));
        }
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsSearchingMember(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchMemberQuery, groupMembers]);

  const handleAddMember = async (userId: string) => {
    try {
      const res = await fetch(API_BASE + `/api/chats/${chat.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        // Re-fetch members list
        const membersRes = await fetch(API_BASE + `/api/chats/${chat.id}/members`);
        if (membersRes.ok) {
          setGroupMembers(await membersRes.json());
        }
        setSearchMemberQuery('');
        setMemberSearchResults([]);
      }
    } catch (err) {
      console.error('Failed to add member:', err);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (window.confirm('Apakah Anda yakin ingin mengeluarkan lebah pekerja ini dari sarang kelompok? 🐝🚫')) {
      try {
        const res = await fetch(API_BASE + `/api/chats/${chat.id}/members/${targetUserId}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          const membersRes = await fetch(API_BASE + `/api/chats/${chat.id}/members`);
          if (membersRes.ok) {
            setGroupMembers(await membersRes.json());
          }
        }
      } catch (err) {
        console.error('Failed to remove member:', err);
      }
    }
  };

  // Poll State
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsInput, setPollOptionsInput] = useState(['', '']);

  // Voice Note State
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voicePlaybackTime, setVoicePlaybackTime] = useState(0);
  const [voicePlaybackDuration, setVoicePlaybackDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const audioInstanceRef = useRef<HTMLAudioElement | null>(null);

  // Camera State
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Media upload progress states
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaProgress, setMediaProgress] = useState<number | null>(null);
  const [pendingCompressFile, setPendingCompressFile] = useState<{ file: File, type: 'image' | 'sticker' | 'document' } | null>(null);
  const [stickersList, setStickersList] = useState<Sticker[]>([]);

  // Load stickers from database (global + per-user)
  useEffect(() => {
    const loadStickers = async () => {
      try {
        const res = await fetch(API_BASE + `/api/stickers?userId=${currentUser.id}`);
        if (res.ok) {
          setStickersList(await res.json());
        }
      } catch (err) {
        console.error('Failed to load stickers:', err);
      }
    };
    loadStickers();
  }, [currentUser.id]);

  // Actual Voice Note Playback Effect
  useEffect(() => {
    if (audioInstanceRef.current) {
      audioInstanceRef.current.pause();
      audioInstanceRef.current = null;
    }

    if (!playingVoiceId) {
      setVoicePlaybackTime(0);
      setVoicePlaybackDuration(0);
      return;
    }

    const voiceMsg = messages.find(m => m.id === playingVoiceId);
    if (!voiceMsg || !voiceMsg.text) {
      setPlayingVoiceId(null);
      return;
    }

    // Determine audio URL path
    const isUrl = voiceMsg.text.startsWith('http') || voiceMsg.text.startsWith('/uploads') || voiceMsg.text.startsWith('blob:');
    let audioUrl = voiceMsg.text;
    if (isUrl && !voiceMsg.text.startsWith('http') && !voiceMsg.text.startsWith('blob:')) {
      audioUrl = API_BASE + (voiceMsg.text.startsWith('/') ? '' : '/') + voiceMsg.text;
    }

    if (!isUrl) {
      // Legacy or mock voice note: synthesize simple pleasant honey bee beep using Web Audio API
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, ctx.currentTime); // A4 tone
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.8);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.8);
        }
      } catch (e) {
        console.error('Audio synth error:', e);
      }

      setVoicePlaybackDuration(voiceMsg.duration || 2);
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= (voiceMsg.duration || 2)) {
          clearInterval(interval);
          setPlayingVoiceId(null);
          setVoicePlaybackTime(0);
        } else {
          setVoicePlaybackTime(elapsed);
        }
      }, 100);

      return () => clearInterval(interval);
    }

    const audio = new Audio(audioUrl);
    audioInstanceRef.current = audio;

    const onTimeUpdate = () => {
      setVoicePlaybackTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setVoicePlaybackDuration(audio.duration || voiceMsg.duration || 0);
    };

    const onEnded = () => {
      setPlayingVoiceId(null);
      setVoicePlaybackTime(0);
    };

    const onError = (e: Event) => {
      console.error('Audio playback failed error event:', e);
      alert('Bzzzt! Gagal memutar berkas rekaman suara. File mungkin telah dihapus atau URL tidak dapat diakses.');
      setPlayingVoiceId(null);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    audio.play().catch(err => {
      console.error('Audio playback failed:', err);
      setPlayingVoiceId(null);
    });

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, [playingVoiceId, messages]);
  
  // Scroller ref
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  
  // Filter messages for this chat only
  const chatMessages = messages.filter((m) => m.chatId === chat.id);

  // Load partner user profile for dynamic status (online/offline)
  const partnerId = !chat.isGroup ? chat.members.find(m => m !== currentUser.id) : undefined;
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!partnerId) return;
    const fetchPartnerProfile = async () => {
      try {
        const res = await fetch(API_BASE + `/api/users/profile?userId=${partnerId}`);
        if (res.ok) {
          setPartnerProfile(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch partner profile:', err);
      }
    };
    fetchPartnerProfile();
    const interval = setInterval(fetchPartnerProfile, 5000);
    return () => clearInterval(interval);
  }, [partnerId]);

  // Automatically mark incoming messages in this chat room as read
  useEffect(() => {
    const markAsRead = async () => {
      try {
        await fetch(API_BASE + '/api/messages/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: chat.id, userId: currentUser.id })
        });
      } catch (err) {
        console.error('Failed to mark messages as read:', err);
      }
    };
    markAsRead();
  }, [chat.id, chatMessages.length, currentUser.id]);

  // Auto Scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, chat.typingUserIds?.length]);

  // Load Smart Suggestions based on last message
  const lastMsg = chatMessages[chatMessages.length - 1];
  useEffect(() => {
    if (!lastMsg || lastMsg.senderId === currentUser.id) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsSuggesting(true);
      try {
        const result = await simulateSuggestReplies(lastMsg.text);
        setSuggestions(result);
      } catch (err) {
        console.error('Failed to load replies:', err);
      } finally {
        setIsSuggesting(false);
      }
    };

    fetchSuggestions();
  }, [lastMsg?.id]);

  // Text-To-Speech handler
  const handleTTS = async (messageText: string) => {
    await speakText(messageText);
  };

  // Translate Message handler
  const handleTranslate = async (messageId: string, text: string, targetLang: string) => {
    setIsTranslatingId(messageId);
    try {
      const translatedText = await simulateTranslate(text, targetLang);
      onUpdateMessage(messageId, {
        text: `${text}\n\n🌐 [Terjemahan - ${targetLang}]:\n${translatedText}`
      });
    } catch (err) {
      alert('Gagal menerjemahkan pesan.');
    } finally {
      setIsTranslatingId(null);
      setActiveMessageIdMenu(null);
    }
  };

  // Summarize conversation
  const handleSummarize = async () => {
    if (chatMessages.length === 0) return;
    setIsSummarizing(true);
    try {
      const summaryText = await simulateSummarize(chatMessages);
      setChatSummary(summaryText);
    } catch (err) {
      alert('Gagal meringkas percakapan.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Dispatch text message
  const handleSend = () => {
    if (!inputText.trim()) return;
    
    onSendMessage(
      inputText,
      'text',
      undefined,
      undefined,
      undefined,
      undefined,
      replyingToMessage ? replyingToMessage.id : undefined,
      replyingToMessage ? replyingToMessage.text : undefined
    );
    setInputText('');
    setReplyingToMessage(null);
  };

  // Handle Smart Reply quick clicking
  const handleSuggestionClick = (text: string) => {
    onSendMessage(text, 'text');
    setSuggestions([]);
  };

  // Voting on Polls
  const handleVote = async (messageId: string, optionId: string) => {
    const msg = chatMessages.find(m => m.id === messageId);
    if (!msg || !msg.pollOptions) return;

    const updatedOptions = msg.pollOptions.map((opt) => {
      // Toggle vote for currentUser
      const hasVoted = opt.votes.includes(currentUser.id);
      let newVotes = [...opt.votes];
      
      if (opt.id === optionId) {
        if (hasVoted) {
          newVotes = newVotes.filter((id) => id !== currentUser.id);
        } else {
          newVotes.push(currentUser.id);
        }
      }
      return { ...opt, votes: newVotes };
    });

    onUpdateMessage(messageId, { pollOptions: updatedOptions });

    try {
      await fetch(API_BASE + `/api/messages/${messageId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, userId: currentUser.id })
      });
    } catch (err) {
      console.error('Failed to register vote:', err);
    }
  };

  // React to a Message with Emoji
  const handleReact = async (messageId: string, emoji: string) => {
    const msg = chatMessages.find(m => m.id === messageId);
    if (!msg) return;

    const currentReactions = msg.reactions || [];
    const existingReaction = currentReactions.find(r => r.emoji === emoji);
    
    let updatedReactions = [...currentReactions];

    if (existingReaction) {
      const alreadyVoted = existingReaction.userIds.includes(currentUser.id);
      if (alreadyVoted) {
        // Remove reaction
        existingReaction.userIds = existingReaction.userIds.filter(id => id !== currentUser.id);
        if (existingReaction.userIds.length === 0) {
          updatedReactions = updatedReactions.filter(r => r.emoji !== emoji);
        }
      } else {
        existingReaction.userIds.push(currentUser.id);
      }
    } else {
      updatedReactions.push({ emoji, userIds: [currentUser.id] });
    }

    onUpdateMessage(messageId, { reactions: updatedReactions });
    setActiveMessageIdMenu(null);

    try {
      await fetch(API_BASE + `/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, userId: currentUser.id })
      });
    } catch (err) {
      console.error('Failed to register reaction:', err);
    }
  };

  // Send Sticker
  const handleSendSticker = (stickerUrl: string) => {
    onSendMessage(stickerUrl, 'sticker');
    setShowStickers(false);
  };

  // Send Poll
  const handleSendPoll = (e: FormEvent) => {
    e.preventDefault();
    const validOptions = pollOptionsInput.filter(opt => opt.trim() !== '');
    if (!pollQuestion.trim() || validOptions.length < 2) {
      alert('Pertanyaan jajak pendapat harus memiliki minimal 2 pilihan jawaban!');
      return;
    }

    onSendMessage('', 'poll', pollQuestion, validOptions);
    setPollQuestion('');
    setPollOptionsInput(['', '']);
    setShowPollCreator(false);
  };

  const uploadFileStream = async (file: File, type: 'image' | 'video' | 'document' | 'sticker') => {
    // Max size limit: 5GB (5 * 1024 * 1024 * 1024 bytes)
    const maxBytes = 5 * 1024 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert("Bzzzt! Ukuran file terlalu besar. Batas maksimal adalah 5 GB! 🐝🍯");
      return;
    }

    setIsUploadingMedia(true);
    setMediaProgress(0);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/api/upload');
      xhr.setRequestHeader('x-file-name', file.name);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setMediaProgress(percent);
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

      const sizeStr = file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        : (file.size / 1024).toFixed(1) + ' KB';

      // Convert relative upload path to absolute path using API_BASE for global mobile access
      const absoluteUrl = result.url.startsWith('http') ? result.url : (API_BASE + result.url);

      // If it's a custom sticker, save it to the database for this user so it appears in their stickers collection
      if (type === 'sticker') {
        try {
          const saveRes = await fetch(API_BASE + '/api/stickers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: absoluteUrl, userId: currentUser.id, label: 'Kustom' })
          });
          if (saveRes.ok) {
            const savedSticker = await saveRes.json();
            setStickersList(prev => [...prev, savedSticker]);
          }
        } catch (err) {
          console.error('Failed to save custom sticker to DB:', err);
        }
      }

      // Send the message using the uploaded link
      onSendMessage(absoluteUrl, type, undefined, undefined, result.fileName, sizeStr);
    } catch (err: any) {
      alert(`Bzzzt! Gagal mengunggah: ${err.message || err}`);
    } finally {
      setIsUploadingMedia(false);
      setMediaProgress(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
      if (documentInputRef.current) documentInputRef.current.value = '';
      if (stickerInputRef.current) stickerInputRef.current.value = '';
    }
  };

  const compressImage = (file: File, quality: number = 0.7, maxW: number = 1280): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(file); // fallback to original file if reading fails
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => resolve(file); // fallback to original file if image fails to load
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxW || height > maxW) {
            if (width > height) {
              height = Math.round((height * maxW) / width);
              width = maxW;
            } else {
              width = Math.round((width * maxW) / height);
              height = maxW;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const compressedFile = new File([blob], file.name.substring(0, file.name.lastIndexOf('.')) + '_compressed.jpg', {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  resolve(compressedFile);
                } else {
                  resolve(file);
                }
              },
              'image/jpeg',
              quality
            );
          } else {
            resolve(file);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if file size exceeds 1MB
    const threshold = 1 * 1024 * 1024;
    if (file.size > threshold) {
      setPendingCompressFile({ file, type: 'image' });
    } else {
      uploadFileStream(file, 'image');
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFileStream(file, 'video');
  };

  const compressDocumentNatively = async (file: File): Promise<File> => {
    try {
      if (typeof CompressionStream === 'undefined') return file;

      const stream = file.stream().pipeThrough(new CompressionStream('gzip'));
      const response = new Response(stream);
      const blob = await response.blob();
      
      return new File([blob], file.name + '.gz', {
        type: 'application/gzip',
        lastModified: Date.now()
      });
    } catch (err) {
      console.error('Failed native compression:', err);
      return file;
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const threshold = 1 * 1024 * 1024;
      if (file.size > threshold) {
        setPendingCompressFile({ file, type: 'image' });
      } else {
        uploadFileStream(file, 'document');
      }
    } else {
      const threshold = 1 * 1024 * 1024;
      if (file.size > threshold) {
        setPendingCompressFile({ file, type: 'document' });
      } else {
        uploadFileStream(file, 'document');
      }
    }
  };

  const handleStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if sticker exceeds 500KB
    const threshold = 500 * 1024;
    if (file.size > threshold) {
      setPendingCompressFile({ file, type: 'sticker' });
    } else {
      uploadFileStream(file, 'sticker');
    }
  };

  const handleAddPollOption = () => {
    if (pollOptionsInput.length < 5) {
      setPollOptionsInput([...pollOptionsInput, '']);
    }
  };

  // Actual Voice Recording with MediaRecorder API
  useEffect(() => {
    let recTimer: any;
    if (recording) {
      setRecordingSeconds(0);
      recTimer = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(recTimer);
  }, [recording]);

  const toggleRecording = async () => {
    if (recording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        voiceStreamRef.current = stream;
        audioChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        
        const startTime = Date.now();

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const elapsedSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const file = new File([audioBlob], `voicenote_${Date.now()}.webm`, { type: 'audio/webm' });
          
          setIsUploadingMedia(true);
          setMediaProgress(0);

          try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', API_BASE + '/api/upload');
            xhr.setRequestHeader('x-file-name', file.name);
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setMediaProgress(percent);
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

            const sizeStr = file.size > 1024 * 1024
              ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
              : (file.size / 1024).toFixed(1) + ' KB';

            const absoluteUrl = result.url.startsWith('http') ? result.url : (API_BASE + result.url);
            
            onSendMessage(absoluteUrl, 'voice', undefined, undefined, result.fileName, sizeStr, undefined, undefined, elapsedSeconds);
          } catch (err: any) {
            alert(`Bzzzt! Gagal mengunggah rekaman suara: ${err.message || err}`);
          } finally {
            setIsUploadingMedia(false);
            setMediaProgress(null);
          }

          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setRecording(true);
      } catch (err) {
        console.error('Failed to start recording:', err);
        alert('Gagal mengakses mikrofon. Pastikan izin mikrofon telah diberikan. 🎤');
      }
    }
  };

  // Camera Helper Functions
  const openCamera = async () => {
    setShowCameraModal(true);
    setCapturedPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacingMode }
      });
      setCameraStream(stream);
    } catch (err) {
      console.error('Failed to open camera:', err);
      alert('Gagal mengakses kamera. Pastikan izin kamera telah diberikan.');
      setShowCameraModal(false);
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setCapturedPhoto(null);
    setShowCameraModal(false);
  };

  const toggleCameraFacingMode = async () => {
    const nextMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextMode);
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode }
      });
      setCameraStream(stream);
    } catch (err) {
      console.error('Failed to switch camera direction:', err);
    }
  };

  const capturePhotoSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedPhoto(dataUrl);
      }
    }
  };

  const sendCapturedPhoto = async () => {
    if (!capturedPhoto) return;
    try {
      const resBlob = await fetch(capturedPhoto);
      const blob = await resBlob.blob();
      const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      await uploadFileStream(file, 'image');
      closeCamera();
    } catch (err) {
      console.error('Failed to convert snapshot or upload:', err);
      alert('Gagal mengirim foto hasil tangkapan kamera.');
    }
  };

  useEffect(() => {
    if (showCameraModal && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showCameraModal, cameraStream]);

  const formatSeconds = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rSecs = secs % 60;
    return `${mins}:${rSecs.toString().padStart(2, '0')}`;
  };

  const formatLastSeen = (timeStr?: string) => {
    if (!timeStr) return 'baru saja';
    try {
      const date = new Date(timeStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'baru saja';
      if (diffMin < 60) return `${diffMin} menit yang lalu`;
      
      const hours = date.getHours().toString().padStart(2, '0');
      const mins = date.getMinutes().toString().padStart(2, '0');
      
      if (date.toDateString() === now.toDateString()) {
        return `hari ini pukul ${hours}:${mins}`;
      }
      return `${date.toLocaleDateString('id-ID')} pukul ${hours}:${mins}`;
    } catch {
      return 'baru saja';
    }
  };

  const isPartnerBlocked = partnerId ? blockedUsers.includes(partnerId) : false;

  return (
    <div className="flex flex-col h-full bg-neutral-950 font-sans text-white relative">
      {/* 1. HEADER BAR */}
      <div className="p-3.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3 min-w-0">
          <button onClick={onBack} className="p-1 hover:bg-neutral-800 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-neutral-300" />
          </button>
          <img
            src={chat.avatar}
            alt={chat.name}
            onClick={() => chat.isGroup && setShowGroupDetailsModal(true)}
            className={`w-10 h-10 rounded-full object-cover border border-amber-400 ${chat.isGroup ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          />
          <div 
            onClick={() => chat.isGroup && setShowGroupDetailsModal(true)}
            className={`min-w-0 ${chat.isGroup ? 'cursor-pointer' : ''}`}
          >
            <h3 className="font-extrabold text-sm truncate text-neutral-100 flex items-center">
              {chat.name}
              {chat.type === 'ai' && (
                <span className="ml-1.5 text-[8px] bg-amber-400 text-neutral-950 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                  AI
                </span>
              )}
            </h3>
            <p className="text-[10px] text-neutral-400 truncate mt-0.5 flex items-center space-x-1.5">
              {chat.typingUserIds && chat.typingUserIds.length > 0 ? (
                <span className="text-amber-400 font-bold animate-pulse">sedang mengetik bzzzt...</span>
              ) : (
                <>
                  <span>
                    {chat.isGroup
                      ? 'Grup Kelompok Kerja 🍯'
                      : chat.type === 'ai'
                      ? 'Online • Aktif'
                      : partnerProfile
                      ? partnerProfile.isOnline
                        ? 'Online • Aktif'
                        : `Terakhir dilihat ${formatLastSeen(partnerProfile.lastSeen)}`
                      : 'Memuat status...'}
                  </span>
                  <span className="text-neutral-600 font-bold">•</span>
                  <span className="text-emerald-400 font-semibold flex items-center">
                    <Lock className="w-2.5 h-2.5 mr-0.5 inline-block" /> Terenkripsi
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => onStartCall('voice')}
            className="p-2 hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
            title="Telepon Suara"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={() => onStartCall('video')}
            className="p-2 hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
            title="Video Call"
          >
            <Video className="w-4 h-4" />
          </button>
          <button
            onClick={handleSummarize}
            disabled={isSummarizing}
            className="p-2 bg-amber-400/10 hover:bg-amber-400 hover:text-neutral-950 text-amber-400 rounded-lg transition-all flex items-center space-x-1 cursor-pointer"
            title="Ringkaskan Chat"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] font-bold font-mono">Ringkas AI</span>
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className="p-2 hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
              title="Menu Lainnya"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showHeaderMenu && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 5 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 5 }}
                  className="absolute right-0 mt-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-2 shadow-2xl flex flex-col space-y-1 z-35 min-w-[140px] text-xs text-white"
                >
                  <button
                    onClick={() => {
                      onDeleteChat(chat.id);
                      setShowHeaderMenu(false);
                    }}
                    className="flex items-center space-x-2.5 p-2 hover:bg-red-950 text-red-400 rounded-xl text-left w-full cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Chat</span>
                  </button>
                  {!chat.isGroup && chat.type !== 'ai' && partnerId && (
                    isPartnerBlocked ? (
                      <button
                        onClick={() => {
                          onUnblockUser(partnerId);
                          setShowHeaderMenu(false);
                        }}
                        className="flex items-center space-x-2.5 p-2 hover:bg-neutral-800 text-emerald-400 rounded-xl text-left w-full cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Buka Blokir</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          onBlockUser(partnerId);
                          setShowHeaderMenu(false);
                        }}
                        className="flex items-center space-x-2.5 p-2 hover:bg-neutral-800 text-red-400 rounded-xl text-left w-full cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Blokir User</span>
                      </button>
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 2. CONVERSATION MESSAGE LIST */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-cover bg-center"
        style={{
          backgroundImage: `radial-gradient(circle at center, rgba(15, 15, 15, 0.95), rgba(5, 5, 5, 0.99))`
        }}
      >
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-neutral-500 max-w-xs mx-auto">
            <Sparkles className="w-10 h-10 mb-3 text-amber-400 animate-pulse" />
            <p className="text-sm font-semibold">Mulai kirimkan pesan pertamamu ke sarang ini!</p>
          </div>
        ) : (
          chatMessages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.id;
            const dateStr = formatMessageTime(msg.timestamp);
            const senderProfile = chat.isGroup ? groupMembers.find(m => m.id === msg.senderId) : null;
            const senderName = senderProfile ? senderProfile.name : msg.senderId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
              >
                {/* Speech Bubble Container */}
                <div
                  onClick={() => setActiveMessageIdMenu(activeMessageIdMenu === msg.id ? null : msg.id)}
                  className={`max-w-[85%] md:max-w-[70%] rounded-2xl shadow relative cursor-pointer group-hover:shadow-md transition-all ${
                    ['image', 'video', 'sticker'].includes(msg.type) ? 'p-1' : 'px-3.5 py-2.5'
                  } ${
                    msg.type === 'system'
                      ? 'bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs text-center py-1.5 px-4 self-center mx-auto rounded-full font-mono max-w-full'
                      : isMe
                      ? 'bg-emerald-900 text-white rounded-tr-none'
                      : 'bg-neutral-800 text-neutral-100 rounded-tl-none'
                  }`}
                >
                  {/* Sender Name ONLY for Group Chats */}
                  {chat.type === 'group' && !isMe && msg.type !== 'system' && (
                    <div className="text-[10px] font-extrabold text-amber-400 mb-1 font-sans">
                      {senderName}
                    </div>
                  )}

                  {/* Reply Reference Preview */}
                  {msg.replyToId && (
                    <div className="border-l-4 border-amber-400 bg-black/25 px-2 py-1 rounded text-[10px] text-neutral-300 mb-2 truncate">
                      {msg.replyToText}
                    </div>
                  )}

                  {/* Message Contents depending on type */}
                  {msg.type === 'poll' ? (
                    /* Interactive Poll bubble */
                    <div className="space-y-3 min-w-[200px]">
                      <div className="flex items-center space-x-1.5 text-xs text-amber-400 font-bold">
                        <Vote className="w-4 h-4" />
                        <span>Jajak Pendapat / Polling</span>
                      </div>
                      <h4 className="font-extrabold text-sm">{msg.pollQuestion}</h4>
                      <div className="space-y-2 pt-1">
                        {msg.pollOptions?.map((opt) => {
                          const votesCount = opt.votes.length;
                          const totalVotes = msg.pollOptions?.reduce((sum, o) => sum + o.votes.length, 0) || 1;
                          const votePercent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                          const votedByMe = opt.votes.includes(currentUser.id);

                          return (
                            <button
                              key={opt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVote(msg.id, opt.id);
                              }}
                              className={`w-full text-left p-2 rounded-xl text-xs flex flex-col space-y-1 relative overflow-hidden transition-all border ${
                                votedByMe ? 'border-amber-400 bg-amber-400/10' : 'border-neutral-700 hover:border-neutral-600 bg-black/20'
                              }`}
                            >
                              {/* progress meter bg */}
                              <div
                                className="absolute top-0 bottom-0 left-0 bg-amber-400/10 transition-all duration-300"
                                style={{ width: `${votePercent}%` }}
                              />
                              <div className="flex justify-between items-center relative z-10">
                                <span className="font-semibold">{opt.text}</span>
                                <span className="font-mono text-[10px] font-bold text-amber-400">
                                  {votesCount} Suara ({votePercent}%)
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : msg.type === 'sticker' ? (
                    msg.text.startsWith('http') ? (
                      <img src={msg.text} alt="Sticker" className="w-24 h-24 object-contain" />
                    ) : (
                      <div className="w-20 h-20 flex items-center justify-center text-6xl select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] transform rotate-2 hover:scale-110 hover:-rotate-2 transition-transform duration-300">
                        <span style={{ filter: 'drop-shadow(0px 0px 4px #ffffff) drop-shadow(0px 0px 1px #ffffff)' }}>
                          {msg.text}
                        </span>
                      </div>
                    )
                  ) : msg.type === 'image' ? (
                    <div className="max-w-xs overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-950/40">
                      <img 
                        src={msg.text} 
                        alt="Foto Unggahan" 
                        className="w-full h-auto max-h-60 object-cover cursor-pointer hover:scale-[1.02] transition-transform"
                        onClick={() => window.open(msg.text, '_blank')} 
                      />
                    </div>
                  ) : msg.type === 'voice' ? (
                    /* VOICE NOTE CONTROLS */
                    <div className="flex items-center space-x-3.5 min-w-[220px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id);
                        }}
                        className="p-2 bg-amber-400 text-neutral-950 rounded-full hover:scale-105 transition-transform"
                      >
                        {playingVoiceId === msg.id ? <Pause className="w-4 h-4 stroke-[3]" /> : <Play className="w-4 h-4 stroke-[3] ml-0.5" />}
                      </button>
                      <div className="flex-1">
                        <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden w-full relative">
                          <div
                            className="h-full bg-amber-400 transition-all duration-100"
                            style={{
                              width: `${playingVoiceId === msg.id && voicePlaybackDuration > 0 ? (voicePlaybackTime / voicePlaybackDuration) * 100 : 0}%`
                            }}
                          />
                        </div>
                        <p className="text-[9px] text-neutral-400 font-mono mt-1 flex justify-between">
                          <span>Pesan Suara 🎤</span>
                          <span>
                            {playingVoiceId === msg.id 
                              ? `${formatSeconds(Math.round(voicePlaybackTime))} / ${formatSeconds(Math.round(voicePlaybackDuration))}` 
                              : (msg.duration ? formatSeconds(msg.duration) : '0:00')}
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : msg.type === 'video' ? (
                    <div className="max-w-xs overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
                      <video
                        src={msg.text}
                        controls
                        className="w-full max-h-60 object-cover"
                        playsInline
                      />
                    </div>
                  ) : msg.type === 'document' ? (
                    <div className="flex items-center space-x-3 p-2.5 bg-neutral-950/40 rounded-2xl border border-neutral-800 max-w-[280px]">
                      <div className="p-2.5 bg-amber-400/10 text-amber-400 rounded-xl">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-neutral-200 truncate" title={msg.fileName}>{msg.fileName || 'Unduhan Berkas'}</p>
                        <p className="text-[10px] text-neutral-500 mt-0.5">{msg.fileSize || 'Ukuran tidak diketahui'}</p>
                      </div>
                      <button
                        onClick={() => window.open(msg.text, '_blank')}
                        className="p-1.5 bg-amber-400 text-neutral-950 hover:bg-amber-500 rounded-lg text-[10px] font-bold tracking-wide transition-all ml-2"
                      >
                        Buka
                      </button>
                    </div>
                  ) : (
                    /* STANDARD TEXT MESSAGE */
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  )}

                  {/* Message Reactions Row */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex space-x-1 mt-2.5">
                      {msg.reactions.map((r, idx) => (
                        <div
                          key={idx}
                          className="bg-neutral-950/40 border border-neutral-700 px-1.5 py-0.5 rounded-full text-xs font-mono flex items-center space-x-1"
                        >
                          <span>{r.emoji}</span>
                          <span className="text-[9px] text-neutral-400 font-bold">{r.userIds.length}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Time and Status tick */}
                  {msg.type !== 'system' && (
                    <div className="flex items-center justify-end space-x-1 mt-1 text-[9px] font-mono text-neutral-400 select-none">
                      <span>{dateStr}</span>
                      {isMe && (
                        <span>
                          {msg.status === 'sending' ? (
                            <span className="animate-spin text-neutral-400">...</span>
                          ) : msg.status === 'sent' ? (
                            <Check className="w-3.5 h-3.5 text-neutral-400" />
                          ) : msg.status === 'delivered' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-neutral-400" />
                          ) : (
                            <CheckCheck className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline Message helper tools when clicked */}
                <AnimatePresence>
                  {activeMessageIdMenu === msg.id && msg.type !== 'system' && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute z-20 top-full mt-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-2.5 shadow-2xl flex flex-col space-y-1 text-xs"
                    >
                      {/* Quick Emoji Reaction bar (Standard WA reactions) */}
                      <div className="flex items-center space-x-2 pb-2 mb-2 border-b border-neutral-800">
                        {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((em) => (
                          <button
                            key={em}
                            onClick={() => handleReact(msg.id, em)}
                            className="text-base hover:scale-125 transition-transform cursor-pointer"
                          >
                            {em}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setSelectedReactionMsgId(msg.id);
                            setShowExtendedReactions(true);
                            setActiveMessageIdMenu(null);
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 text-sm font-extrabold transition-all cursor-pointer"
                          title="Lainnya..."
                        >
                          +
                        </button>
                      </div>

                      {/* Options */}
                      <button
                        onClick={() => {
                          setReplyingToMessage(msg);
                          setActiveMessageIdMenu(null);
                        }}
                        className="flex items-center space-x-2 p-1.5 hover:bg-neutral-800 rounded-lg text-left w-full"
                      >
                        <Reply className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Balas</span>
                      </button>

                      <button
                        onClick={() => handleTTS(msg.text)}
                        className="flex items-center space-x-2 p-1.5 hover:bg-neutral-800 rounded-lg text-left w-full"
                      >
                        <Play className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-400 font-bold">Dengarkan Suara (TTS)</span>
                      </button>

                      {/* Translate Submenu */}
                      <div className="pt-1.5 border-t border-neutral-800 mt-1.5">
                        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase px-1.5">Terjemahkan ke:</span>
                        <div className="grid grid-cols-2 gap-1 mt-1">
                          {[
                            { name: 'Inggris', lang: 'English' },
                            { name: 'Jepang', lang: 'Japanese' },
                            { name: 'Arab', lang: 'Arabic' },
                            { name: 'Spanyol', lang: 'Spanish' }
                          ].map((l) => (
                            <button
                              key={l.lang}
                              onClick={() => handleTranslate(msg.id, msg.text, l.lang)}
                              className="p-1 hover:bg-neutral-800 rounded text-[10px] text-left text-neutral-300"
                            >
                              {l.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.text);
                          alert('Pesan disalin!');
                          setActiveMessageIdMenu(null);
                        }}
                        className="flex items-center space-x-2 p-1.5 hover:bg-neutral-800 rounded-lg text-left w-full pt-1.5 border-t border-neutral-800 mt-1.5"
                      >
                        <Copy className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Salin Teks</span>
                      </button>

                      {isMe && (
                        <button
                          onClick={() => {
                            onDeleteMessage(msg.id);
                            setActiveMessageIdMenu(null);
                          }}
                          className="flex items-center space-x-2 p-1.5 hover:bg-red-950 text-red-400 rounded-lg text-left w-full"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Pesan</span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}

        {/* AI Typing Indicator */}
        {chat.typingUserIds && chat.typingUserIds.length > 0 && (
          <div className="flex items-start space-x-3.5 max-w-[85%]">
            <img src={chat.avatar} className="w-8 h-8 rounded-full border border-amber-400" />
            <div className="bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-2xl rounded-tl-none p-3.5 text-xs font-semibold shadow">
              <div className="flex space-x-1 items-center">
                <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                <span className="ml-1.5 text-[10px] font-mono tracking-widest text-amber-400 uppercase">Madu diproduksi...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. SMART REPLY SUGGESTIONS CARDS */}
      {suggestions.length > 0 && (
        <div className="p-2.5 bg-neutral-900/60 border-t border-neutral-900 flex space-x-2 overflow-x-auto select-none sticky bottom-0 z-10">
          {suggestions.map((rep, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(rep)}
              className="px-3.5 py-2 bg-neutral-950 border border-neutral-800/80 hover:border-amber-400 hover:text-amber-400 text-xs font-semibold rounded-2xl whitespace-nowrap transition-all shadow text-neutral-300"
            >
              ✨ {rep}
            </button>
          ))}
        </div>
      )}

      {/* 4. ACTIVE REPLY TO CARD */}
      {replyingToMessage && (
        <div className="p-3 bg-neutral-900/90 border-t border-neutral-800 flex justify-between items-center text-xs">
          <div className="border-l-4 border-amber-400 px-3 truncate">
            <span className="font-bold text-amber-400 block">Membalas pesan:</span>
            <span className="text-neutral-300 italic">{replyingToMessage.text}</span>
          </div>
          <button
            onClick={() => setReplyingToMessage(null)}
            className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
          >
            X
          </button>
        </div>
      )}

      {/* 5. INPUT MESSAGE BAR */}
      {isPartnerBlocked ? (
        <div className="p-4 bg-neutral-900 border-t border-neutral-800 text-center text-xs text-neutral-400 font-semibold flex items-center justify-center space-x-2">
          <Lock className="w-4 h-4 text-red-500 animate-pulse" />
          <span>Anda memblokir kontak ini.</span>
          <button
            type="button"
            onClick={() => onUnblockUser(partnerId!)}
            className="text-amber-400 hover:underline font-bold ml-1 cursor-pointer"
          >
            Buka Blokir
          </button>
        </div>
      ) : (
        <div className="p-3 bg-neutral-900 border-t border-neutral-800 flex items-center space-x-2.5 relative">
          <input
            type="file"
            ref={imageInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <input
            type="file"
            ref={videoInputRef}
            accept="video/*"
            className="hidden"
            onChange={handleVideoUpload}
          />
          <input
            type="file"
            ref={documentInputRef}
            accept="*/*"
            className="hidden"
            onChange={handleDocumentUpload}
          />
          <input
            type="file"
            ref={stickerInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleStickerUpload}
          />
          {/* Attachment paperclip button */}
          <div className="relative">
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="p-2.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-xl transition-all cursor-pointer"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Attachment Floating Menu */}
            <AnimatePresence>
              {showAttachmentMenu && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 10 }}
                  className="absolute bottom-14 left-0 bg-neutral-900 border border-neutral-800 rounded-2xl p-3 shadow-2xl flex flex-col space-y-1 z-30 text-xs min-w-[140px]"
                >
                  <button
                    onClick={() => {
                      imageInputRef.current?.click();
                      setShowAttachmentMenu(false);
                    }}
                    className="flex items-center space-x-2.5 p-2 hover:bg-neutral-800 rounded-xl text-left w-full cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <span>Kirim Foto</span>
                  </button>

                  <button
                    onClick={() => {
                      videoInputRef.current?.click();
                      setShowAttachmentMenu(false);
                    }}
                    className="flex items-center space-x-2.5 p-2 hover:bg-neutral-800 rounded-xl text-left w-full cursor-pointer"
                  >
                    <Video className="w-4 h-4 text-amber-400" />
                    <span>Kirim Video</span>
                  </button>

                  <button
                    onClick={() => {
                      documentInputRef.current?.click();
                      setShowAttachmentMenu(false);
                    }}
                    className="flex items-center space-x-2.5 p-2 hover:bg-neutral-800 rounded-xl text-left w-full cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Kirim Dokumen</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowPollCreator(true);
                      setShowAttachmentMenu(false);
                    }}
                    className="flex items-center space-x-2.5 p-2 hover:bg-neutral-800 rounded-xl text-left w-full cursor-pointer"
                  >
                    <Vote className="w-4 h-4 text-amber-400" />
                    <span>Buat Polling</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowStickers(true);
                      setShowAttachmentMenu(false);
                    }}
                    className="flex items-center space-x-2.5 p-2 hover:bg-neutral-800 rounded-xl text-left w-full cursor-pointer"
                  >
                    <Smile className="w-4 h-4 text-amber-400" />
                    <span>Kirim Stiker</span>
                  </button>

                  <button
                    onClick={() => {
                      openCamera();
                      setShowAttachmentMenu(false);
                    }}
                    className="flex items-center space-x-2.5 p-2 hover:bg-neutral-800 rounded-xl text-left w-full cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>Kamera</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input Text field */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={recording ? "Sedang merekam suara bzzzt..." : "Ketik pesan manismu..."}
            disabled={recording}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
          />

          {/* Mute/Voice recording and send action button */}
          <div className="flex space-x-1.5">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                showEmojiPicker ? 'bg-amber-400 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-800'
              }`}
              title="Pilih Emoticon"
            >
              <Smile className="w-5 h-5" />
            </button>

            <button
              onClick={toggleRecording}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                recording ? 'bg-red-600 text-white animate-pulse' : 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-800'
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>
            
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="p-2.5 bg-amber-400 text-neutral-950 rounded-xl disabled:bg-neutral-800 disabled:text-neutral-600 hover:bg-amber-500 transition-colors cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          {/* Emoji Picker Panel for input text bar */}
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-16 right-4 z-40 bg-neutral-900 border border-neutral-800 rounded-3xl p-4 shadow-2xl w-[280px] max-h-[220px]"
              >
                <div className="flex justify-between items-center mb-2 pb-1 border-b border-neutral-800">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400 font-extrabold">Emoticon BeeChat</span>
                  <button 
                    onClick={() => setShowEmojiPicker(false)}
                    className="text-[10px] text-neutral-500 hover:text-white cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-2 overflow-y-auto max-h-[145px] p-1 justify-items-center">
                  {[
                    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
                    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
                    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
                    '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
                    '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
                    '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
                    '🖐️', '🖖', '👋', '🤙', '💪', '🦾', '🙏', '✍️', '👏', '🙌',
                    '🔥', '🎉', '💯', '❤️', '💔', '💖', '✨', '🚀', '👀', '💩'
                  ].map((em, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInputText(prev => prev + em);
                      }}
                      className="text-xl p-1 hover:scale-125 hover:bg-neutral-800 rounded-lg transition-transform cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 6. MODAL: CHAT SUMMARY DISPLAY */}
      <AnimatePresence>
        {chatSummary && (
          <div className="fixed inset-0 z-50 bg-neutral-950/95 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative"
            >
              <div className="flex items-center space-x-2 text-amber-400 mb-4 border-b border-neutral-800 pb-3">
                <Sparkles className="w-5 h-5 animate-spin" />
                <h3 className="font-extrabold text-sm font-mono uppercase tracking-wider">Honeycomb Chat Summary</h3>
              </div>
              
              <div className="text-xs text-neutral-300 leading-relaxed font-sans max-h-96 overflow-y-auto whitespace-pre-wrap">
                {chatSummary}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setChatSummary(null)}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Tutup Rangkuman
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. MODAL: STICKER BOARD SELECTION */}
      {showStickers && (
        <div className="fixed inset-0 z-50 bg-neutral-950/90 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-2">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-400">Pilih Stiker Lebah Madu</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    stickerInputRef.current?.click();
                    setShowStickers(false);
                  }}
                  className="px-2.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 rounded-xl text-[10px] font-extrabold transition-all flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> <span>Buat Sendiri</span>
                </button>
                <button onClick={() => setShowStickers(false)} className="text-neutral-500 hover:text-white cursor-pointer px-1 font-bold">X</button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3 p-1 max-h-64 overflow-y-auto">
              {stickersList.map((item, idx) => {
                const isUrl = item.url.startsWith('http') || item.url.startsWith('/uploads');
                return (
                  <button
                    key={item.id || idx}
                    onClick={() => handleSendSticker(item.url)}
                    className="p-3 border border-neutral-800/80 hover:border-amber-400/50 rounded-2xl transition-all bg-neutral-950 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-900 overflow-hidden"
                    title={item.label || 'Stiker'}
                  >
                    {isUrl ? (
                      <img src={item.url} alt={item.label || 'Stiker'} className="w-12 h-12 object-contain" />
                    ) : (
                      <span className="text-3xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">{item.url}</span>
                    )}
                    <span className="text-[9px] text-neutral-500 mt-1 truncate w-full text-center">
                      {item.label || (item.userId ? 'Kustom' : 'Umum')}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      {/* 8. MODAL: POLL CREATOR DIALOG */}
      {showPollCreator && (
        <div className="fixed inset-0 z-50 bg-neutral-950/90 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-2">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-400 flex items-center">
                <Vote className="w-4 h-4 mr-1.5" /> Buat Jajak Pendapat
              </h3>
              <button onClick={() => setShowPollCreator(false)} className="text-neutral-500 hover:text-white">X</button>
            </div>

            <form onSubmit={handleSendPoll} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-neutral-300 font-medium">Pertanyaan Jajak Pendapat</label>
                <input
                  type="text"
                  required
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Contoh: Kapan kita memanen madu sektor utara? 🍯"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-neutral-300 font-medium">Pilihan Jawaban</label>
                <div className="space-y-2 max-h-40 overflow-y-auto p-1">
                  {pollOptionsInput.map((opt, idx) => (
                    <input
                      key={idx}
                      type="text"
                      required={idx < 2}
                      value={opt}
                      onChange={(e) => {
                        const nextOpts = [...pollOptionsInput];
                        nextOpts[idx] = e.target.value;
                        setPollOptionsInput(nextOpts);
                      }}
                      placeholder={`Pilihan ${idx + 1}`}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  ))}
                </div>
                {pollOptionsInput.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddPollOption}
                    className="text-[10px] font-bold text-amber-400 hover:underline flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" /> <span>Tambah Pilihan Jawaban</span>
                  </button>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPollCreator(false)}
                  className="px-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs transition-all shadow"
                >
                  Kirim Polling
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* 9. MODAL: GROUP MEMBERS & INFO DETAILS */}
      <AnimatePresence>
        {showGroupDetailsModal && (
          <div className="fixed inset-0 z-50 bg-neutral-950/90 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex justify-between items-center">
                <h3 className="font-extrabold text-sm text-amber-400 flex items-center">
                  <Smile className="w-4 h-4 mr-1.5" /> Informasi Sarang Kelompok
                </h3>
                <button
                  onClick={() => {
                    setShowGroupDetailsModal(false);
                    setSearchMemberQuery('');
                    setMemberSearchResults([]);
                  }}
                  className="text-neutral-400 hover:text-white font-bold p-1 transition-colors"
                >
                  X
                </button>
              </div>

              {/* Content body */}
              <div className="p-5 flex-1 overflow-y-auto space-y-5">
                {/* Group profile card */}
                <div className="flex flex-col items-center text-center space-y-2 border-b border-neutral-800 pb-4">
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-amber-400 shadow-md"
                  />
                  <h4 className="font-bold text-base text-white">{chat.name}</h4>
                  <p className="text-xs text-neutral-400 font-medium">
                    {chat.description || 'Tidak ada deskripsi sarang.'}
                  </p>
                </div>

                {/* Add member search */}
                <div className="space-y-2">
                  <label className="text-xs text-neutral-300 font-semibold flex items-center justify-between">
                    <span>Masukkan Lebah Pekerja Baru 🐝</span>
                    <span className="text-[10px] text-neutral-500">Cari berdasarkan nama/username</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchMemberQuery}
                      onChange={(e) => setSearchMemberQuery(e.target.value)}
                      placeholder="Cari lebah untuk diundang..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                    {isSearchingMember && (
                      <div className="absolute right-3 top-3 w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                    )}
                  </div>

                  {/* Search results list */}
                  {memberSearchResults.length > 0 && (
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden max-h-40 overflow-y-auto divide-y divide-neutral-900 mt-2">
                      {memberSearchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleAddMember(u.id)}
                          className="w-full text-left p-2.5 hover:bg-neutral-900 transition-colors flex items-center justify-between group"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            {u.avatar ? (
                              <img src={u.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] text-neutral-400">🐝</div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{u.name}</p>
                              <p className="text-[10px] text-neutral-500 truncate">@{u.username}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg group-hover:bg-amber-400 group-hover:text-neutral-950 transition-all">
                            Masukkan
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchMemberQuery.trim() !== '' && !isSearchingMember && memberSearchResults.length === 0 && (
                    <p className="text-[10px] text-neutral-500 italic mt-1 pl-1">
                      Tidak ada lebah pekerja baru yang cocok.
                    </p>
                  )}
                </div>

                {/* Members list */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Daftar Anggota Kelompok ({groupMembers.length})
                  </h5>
                  
                  {isLoadingMembers && groupMembers.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-500 flex flex-col items-center justify-center space-y-2">
                      <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Memuat anggota...</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {groupMembers.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between bg-neutral-950/55 border border-neutral-800/60 p-2.5 rounded-2xl"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            {m.avatar ? (
                              <img src={m.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-400">🐝</div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate flex items-center">
                                {m.name}
                                {m.id === currentUser.id && (
                                  <span className="ml-1 text-[8px] bg-neutral-800 text-neutral-400 px-1 py-0.5 rounded">Anda</span>
                                )}
                              </p>
                              <p className="text-[10px] text-neutral-500 truncate">{m.bio || 'Menghasilkan nektar kebaikan. 🍯'}</p>
                            </div>
                          </div>
                          
                          {/* Online status indicator & Kick option */}
                          <div className="flex items-center space-x-2.5 flex-shrink-0">
                            <div className="flex items-center space-x-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${m.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`} />
                              <span className="text-[9px] text-neutral-400">
                                {m.isOnline ? 'Aktif' : 'Offline'}
                              </span>
                            </div>
                            
                            {m.id !== currentUser.id && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m.id)}
                                className="px-2 py-1 bg-red-950/40 hover:bg-red-900 border border-red-900/60 rounded-lg text-[9px] font-extrabold text-red-400 transition-colors cursor-pointer"
                              >
                                Keluarkan
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {isUploadingMedia && (
        <div className="fixed inset-0 z-[60] bg-neutral-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col items-center space-y-4 shadow-2xl max-w-xs w-full text-center">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-amber-400/20 border-t-amber-400 rounded-full animate-spin"></div>
              <span className="text-2xl animate-bounce">🐝</span>
            </div>
            <div className="w-full space-y-3">
              <h3 className="font-bold text-sm text-white">
                Mengirim Berkas... {mediaProgress !== null ? `${mediaProgress}%` : ''}
              </h3>
              <p className="text-xs text-neutral-400">Lebah kurir sedang mengantarkan berkas Anda ke sarang. Harap tunggu bzzzt!</p>
              
              {mediaProgress !== null && (
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full bg-amber-400 transition-all duration-150"
                    style={{ width: `${mediaProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showExtendedReactions && selectedReactionMsgId && (
        <div className="fixed inset-0 z-[60] bg-neutral-950/90 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-2">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-400">Reaksi Lengkap</h3>
              <button 
                onClick={() => {
                  setShowExtendedReactions(false);
                  setSelectedReactionMsgId(null);
                }} 
                className="text-neutral-500 hover:text-white cursor-pointer px-1 font-bold"
              >
                X
              </button>
            </div>
            
            <div className="grid grid-cols-8 gap-2 p-1 max-h-60 overflow-y-auto justify-items-center">
              {[
                '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
                '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
                '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
                '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
                '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
                '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
                '🖐️', '🖖', '👋', '🤙', '💪', '🦾', '🙏', '✍️', '👏', '🙌',
                '🔥', '🎉', '💯', '❤️', '💔', '💖', '✨', '🚀', '👀', '💩'
              ].map((em, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    handleReact(selectedReactionMsgId, em);
                    setShowExtendedReactions(false);
                    setSelectedReactionMsgId(null);
                  }}
                  className="text-2xl p-1.5 hover:scale-125 hover:bg-neutral-800 rounded-xl transition-all cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
      {pendingCompressFile && (
        <div className="fixed inset-0 z-[60] bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="text-center space-y-2">
              <span className="text-4xl animate-bounce inline-block">
                {pendingCompressFile.type === 'document' ? '📄' : '🖼️'}
              </span>
              <h3 className="font-extrabold text-sm text-white">
                {pendingCompressFile.type === 'document' ? 'Kompres Dokumen?' : 'Kompres Foto / Stiker?'}
              </h3>
              <p className="text-xs text-neutral-400">
                {pendingCompressFile.type === 'document' ? (
                  <>
                    Dokumen <span className="text-white font-bold">{pendingCompressFile.file.name}</span> berukuran{' '}
                    <span className="text-amber-400 font-bold">
                      {(pendingCompressFile.file.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    . Ingin mengompres dokumen menjadi format <span className="text-amber-400 font-mono">.gz (Gzip)</span> agar hemat kuota dan terkirim secepat lebah? 🐝🍯
                  </>
                ) : (
                  <>
                    Ukuran berkas asli adalah{' '}
                    <span className="text-amber-400 font-bold">
                      {(pendingCompressFile.file.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    . Ingin mengompres gambar agar hemat kuota dan terkirim secepat lebah? 🐝🍯
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col space-y-2 pt-2">
              <button
                onClick={async () => {
                  const fileToUpload = pendingCompressFile.file;
                  const type = pendingCompressFile.type;
                  setPendingCompressFile(null);
                  if (type === 'document') {
                    const compressed = await compressDocumentNatively(fileToUpload);
                    uploadFileStream(compressed, 'document');
                  } else {
                    const compressed = await compressImage(fileToUpload, 0.7, 1080);
                    uploadFileStream(compressed, type);
                  }
                }}
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                {pendingCompressFile.type === 'document' ? 'Ya, Kompres (.gz)' : 'Ya, Kompres (Hemat Kuota)'}
              </button>
              <button
                onClick={() => {
                  const fileToUpload = pendingCompressFile.file;
                  const type = pendingCompressFile.type;
                  setPendingCompressFile(null);
                  uploadFileStream(fileToUpload, type);
                }}
                className="w-full py-2.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Kirim Ukuran Asli
              </button>
              <button
                onClick={() => setPendingCompressFile(null)}
                className="w-full py-2 text-neutral-500 hover:text-white text-[10px] font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 11. MODAL: CAMERA CAPTURE */}
      <AnimatePresence>
        {showCameraModal && (
          <div className="fixed inset-0 z-[70] bg-neutral-950 flex flex-col">
            {/* Camera Header Bar */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10"
            >
              <button
                onClick={closeCamera}
                className="p-2 bg-neutral-900/60 backdrop-blur-md hover:bg-neutral-800 rounded-full text-white transition-all cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-xs font-extrabold text-amber-400 uppercase tracking-widest font-mono flex items-center space-x-1.5">
                <Camera className="w-3.5 h-3.5" />
                <span>BeeChat Kamera</span>
              </span>
              <button
                onClick={toggleCameraFacingMode}
                className="p-2 bg-neutral-900/60 backdrop-blur-md hover:bg-neutral-800 rounded-full text-white transition-all cursor-pointer"
                title="Ganti Kamera"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
                  <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
                  <path d="m14 9-3 3 3 3" />
                  <path d="m10 15 3-3-3-3" />
                </svg>
              </button>
            </motion.div>

            {/* Live Camera Preview / Captured Photo */}
            <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
              {capturedPhoto ? (
                <motion.img
                  initial={{ scale: 1.05, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  src={capturedPhoto}
                  alt="Hasil Tangkapan"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    cameraFacingMode === 'user' ? '-scale-x-100' : ''
                  }`}
                />
              )}
              <canvas ref={canvasRef} className="hidden" />

              {/* Corner Frame Decorations */}
              {!capturedPhoto && (
                <>
                  <div className="absolute top-16 left-6 w-10 h-10 border-t-2 border-l-2 border-amber-400/50 rounded-tl-xl" />
                  <div className="absolute top-16 right-6 w-10 h-10 border-t-2 border-r-2 border-amber-400/50 rounded-tr-xl" />
                  <div className="absolute bottom-32 left-6 w-10 h-10 border-b-2 border-l-2 border-amber-400/50 rounded-bl-xl" />
                  <div className="absolute bottom-32 right-6 w-10 h-10 border-b-2 border-r-2 border-amber-400/50 rounded-br-xl" />
                </>
              )}
            </div>

            {/* Camera Action Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-t from-black via-black/95 to-transparent p-6 pb-8 flex items-center justify-center"
            >
              {capturedPhoto ? (
                /* After capture: Retry / Send */
                <div className="flex items-center space-x-6">
                  <button
                    onClick={() => setCapturedPhoto(null)}
                    className="flex flex-col items-center space-y-1.5 group cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-full border-2 border-neutral-600 group-hover:border-red-400 flex items-center justify-center transition-all group-hover:bg-red-950/30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-neutral-400 group-hover:text-red-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </div>
                    <span className="text-[10px] font-bold text-neutral-400 group-hover:text-red-400 uppercase tracking-wider transition-colors">Ulangi</span>
                  </button>

                  <button
                    onClick={sendCapturedPhoto}
                    className="flex flex-col items-center space-y-1.5 group cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-full bg-amber-400 group-hover:bg-amber-500 flex items-center justify-center transition-all shadow-lg shadow-amber-400/30 group-hover:shadow-amber-500/40 group-hover:scale-105">
                      <Send className="w-7 h-7 text-neutral-950" />
                    </div>
                    <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">Kirim</span>
                  </button>
                </div>
              ) : (
                /* Live preview: Capture button */
                <div className="flex flex-col items-center space-y-2.5">
                  <button
                    onClick={capturePhotoSnapshot}
                    className="w-[72px] h-[72px] rounded-full border-[4px] border-white/80 flex items-center justify-center cursor-pointer group hover:border-amber-400 transition-all"
                  >
                    <div className="w-[58px] h-[58px] rounded-full bg-white/90 group-hover:bg-amber-400 transition-all group-active:scale-90" />
                  </button>
                  <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">Ketuk untuk memotret</span>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
