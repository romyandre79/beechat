import { useState, useEffect, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare, Circle, Phone, Users, User, Settings, ShieldAlert, Plus, Search, Sun, Moon, LogOut,
  Sparkles, Check, Archive, Pin, Star, HelpCircle, CheckCheck, CircleDot
} from 'lucide-react';

import { Chat, Message, UserProfile, StatusUpdate, CallLog, Community } from './types';
import {
  INITIAL_USER, INITIAL_CHATS, INITIAL_MESSAGES, INITIAL_CALLS, INITIAL_STATUS, INITIAL_COMMUNITIES,
  speakText, simulateAiChat
} from './utils';
import { encryptMessage, decryptMessage } from './crypto';
import { webrtcService, IncomingCallData } from './webrtc';

// Subcomponents
import Splash from './components/Splash';
import Auth from './components/Auth';
import ChatRoom from './components/ChatRoom';
import StatusView from './components/StatusView';
import CallsView from './components/CallsView';
import CommunityView from './components/CommunityView';
import ProfileView from './components/ProfileView';
import SettingsView from './components/SettingsView';
import DashboardView from './components/DashboardView';

declare const __API_SERVER__: string;
declare const __API_PORT__: string;

const API_BASE = (window.location.protocol.startsWith('http') && !window.location.origin.startsWith('capacitor://') && !window.location.origin.startsWith('http://localhost:80') && !window.location.origin.startsWith('file://'))
  ? ''
  : `http://${__API_SERVER__}:${__API_PORT__}`;

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [appName, setAppName] = useState('BeeChat');
  const [appVersion, setAppVersion] = useState('1.0.0');

  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  // Load app config from backend env
  useEffect(() => {
    fetch(API_BASE + '/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.appName) {
          setAppName(data.appName);
          document.title = data.appName;
        }
        if (data.appVersion) {
          setAppVersion(data.appVersion);
        }
      })
      .catch(err => console.error('Failed to load app config:', err));
  }, []);

  // Load blocked user list
  useEffect(() => {
    if (!currentUser) {
      setBlockedUsers([]);
      return;
    }
    const fetchBlocked = async () => {
      try {
        const res = await fetch(API_BASE + `/api/users/blocked?userId=${currentUser.id}`);
        if (res.ok) {
          setBlockedUsers(await res.json());
        }
      } catch (err) {
        console.error('Failed to load blocked list:', err);
      }
    };
    fetchBlocked();
  }, [currentUser]);
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'chats' | 'status' | 'calls' | 'community' | 'profile' | 'settings' | 'admin'>('chats');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Database States (persisted via PostgreSQL, cached in localStorage)
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('beechat_cached_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('beechat_cached_messages');
    return saved ? JSON.parse(saved) : [];
  });
  const [statusList, setStatusList] = useState<StatusUpdate[]>(() => {
    const saved = localStorage.getItem('beechat_cached_statuses');
    return saved ? JSON.parse(saved) : [];
  });
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>(() => {
    const saved = localStorage.getItem('beechat_cached_calls');
    return saved ? JSON.parse(saved) : [];
  });
  const [communities, setCommunities] = useState<Community[]>(() => {
    const saved = localStorage.getItem('beechat_cached_communities');
    return saved ? JSON.parse(saved) : [];
  });

  // Automatically sync state mutations to LocalStorage for offline-first load
  useEffect(() => {
    if (chats.length > 0) localStorage.setItem('beechat_cached_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem('beechat_cached_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (statusList.length > 0) localStorage.setItem('beechat_cached_statuses', JSON.stringify(statusList));
  }, [statusList]);

  useEffect(() => {
    if (callLogs.length > 0) localStorage.setItem('beechat_cached_calls', JSON.stringify(callLogs));
  }, [callLogs]);

  useEffect(() => {
    if (communities.length > 0) localStorage.setItem('beechat_cached_communities', JSON.stringify(communities));
  }, [communities]);

  // Theme & Wallpapers
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('beechat_dark_mode');
    return saved ? JSON.parse(saved) : true;
  });
  const [wallpaper, setWallpaper] = useState<string>(() => {
    return localStorage.getItem('beechat_wallpaper') || 'bg-neutral-950 text-white';
  });

  // Call simulation state
  const [activeCall, setActiveCall] = useState<{
    userId: string;
    userName: string;
    avatar: string;
    type: 'voice' | 'video';
    isIncoming: boolean;
  } | null>(null);

  // WebRTC state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [webrtcConnectionState, setWebrtcConnectionState] = useState<string>('new');
  const callStartTimeRef = useRef<number>(0);

  // Modal: Start New Chat
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [newChatType, setNewChatType] = useState<'direct' | 'group'>('direct');
  const [newChatDesc, setNewChatDesc] = useState('');

  // Combobox Search states for direct chat
  const [newChatSearchQuery, setNewChatSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Search users based on query
  useEffect(() => {
    if (newChatType !== 'direct' || !newChatSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(newChatSearchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out current user from search results
          setSearchResults(data.filter((u: any) => u.id !== currentUser?.id));
        }
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [newChatSearchQuery, newChatType, currentUser]);

  // Reset search state on modal toggle or chat type change
  useEffect(() => {
    setNewChatSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    if (newChatType === 'direct') {
      setNewChatName('');
    }
  }, [showNewChatModal, newChatType]);

  // Persist settings to localstorage
  useEffect(() => {
    localStorage.setItem('beechat_dark_mode', JSON.stringify(darkMode));
  }, [darkMode]);
  useEffect(() => {
    localStorage.setItem('beechat_wallpaper', wallpaper);
  }, [wallpaper]);

  // Load currentUser from session/storage if exists
  useEffect(() => {
    const savedUser = localStorage.getItem('beechat_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setCurrentUser(parsed);
      // Sync on startup
      fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      }).catch(err => console.error(err));
    }
  }, []);

  // Poll database every 5 seconds for updates
  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      try {
        // Ping online status heartbeat
        fetch(API_BASE + '/api/users/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id })
        }).catch(() => {});

        // Fetch Chats for current user
        const chatsRes = await fetch(API_BASE + `/api/chats?userId=${currentUser.id}`);
        if (chatsRes.ok) {
          const rawChats = await chatsRes.json();
          const decryptedChats = await Promise.all(
            rawChats.map(async (c: Chat) => {
              if (c.lastMessage && c.lastMessage.startsWith('e2ee:')) {
                const decLastMsg = await decryptMessage(c.lastMessage, c.id);
                return { ...c, lastMessage: decLastMsg };
              }
              return c;
            })
          );
          setChats(decryptedChats);
        }

        // Fetch Messages
        const messagesRes = await fetch(API_BASE + `/api/messages?userId=${currentUser.id}`);
        if (messagesRes.ok) {
          const rawMsgs = await messagesRes.json();
          const decryptedMsgs = await Promise.all(
            rawMsgs.map(async (m: Message) => {
              if (m.text && m.text.startsWith('e2ee:')) {
                const decText = await decryptMessage(m.text, m.chatId);
                return { ...m, text: decText };
              }
              return m;
            })
          );
          setMessages(decryptedMsgs);
        }

        // Fetch Statuses
        const statusRes = await fetch(API_BASE + '/api/status');
        if (statusRes.ok) {
          setStatusList(await statusRes.json());
        }

        // Fetch Calls
        const callsRes = await fetch(API_BASE + '/api/calls');
        if (callsRes.ok) {
          setCallLogs(await callsRes.json());
        }

        // Fetch Communities
        const commRes = await fetch(API_BASE + '/api/communities');
        if (commRes.ok) {
          setCommunities(await commRes.json());
        }
      } catch (err) {
        console.error('Error syncing database:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const handleLoginSuccess = async (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('beechat_user', JSON.stringify(user));
    try {
      await fetch(API_BASE + '/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
    } catch (err) {
      console.error('Failed to sync user on login:', err);
    }
  };

  const handleLogout = () => {
    webrtcService.destroy();
    setCurrentUser(null);
    setChats([]);
    setMessages([]);
    setStatusList([]);
    setCallLogs([]);
    setCommunities([]);
    setActiveChatId(null);
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    localStorage.removeItem('beechat_user');
    localStorage.removeItem('beechat_cached_chats');
    localStorage.removeItem('beechat_cached_messages');
    localStorage.removeItem('beechat_cached_statuses');
    localStorage.removeItem('beechat_cached_calls');
    localStorage.removeItem('beechat_cached_communities');
  };

  // Toggle Pinned status of a Chat
  const handleTogglePin = (chatId: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, isPinned: !c.isPinned } : c));
  };

  // Toggle Archived status of a Chat
  const handleToggleArchive = (chatId: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, isArchived: !c.isArchived } : c));
  };

  // Update a specific message attribute
  const handleUpdateMessage = (messageId: string, updated: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updated } : m));
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    try {
      await fetch(API_BASE + `/api/messages/${messageId}?userId=${currentUser?.id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  // Delete chat (Clear chat messages)
  const handleDeleteChat = async (chatId: string) => {
    if (!confirm('Apakah Anda yakin ingin membersihkan seluruh pesan di sarang chat ini? Seluruh pesan akan dihapus secara permanen. 🐝')) return;
    setMessages(prev => prev.filter(m => m.chatId !== chatId));
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, lastMessage: '', lastMessageTime: undefined } : c));
    try {
      await fetch(API_BASE + `/api/chats/${chatId}?userId=${currentUser?.id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  // Block contact
  const handleBlockUser = async (targetUserId: string) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE + '/api/users/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, blockedUserId: targetUserId })
      });
      setBlockedUsers(prev => [...prev, targetUserId]);
      alert('Kontak berhasil diblokir. 🐝');
    } catch (err) {
      console.error('Failed to block user:', err);
    }
  };

  // Unblock contact
  const handleUnblockUser = async (targetUserId: string) => {
    if (!currentUser) return;
    try {
      await fetch(API_BASE + '/api/users/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, blockedUserId: targetUserId })
      });
      setBlockedUsers(prev => prev.filter(id => id !== targetUserId));
      alert('Blokir kontak berhasil dibuka. 🐝');
    } catch (err) {
      console.error('Failed to unblock user:', err);
    }
  };

  // Send a message and handle Queen Bee AI replies
  const handleSendMessage = async (
    text: string,
    type: Message['type'] = 'text',
    pollQuestion?: string,
    pollOptions?: string[],
    fileName?: string,
    fileSize?: string,
    replyToId?: string,
    replyToText?: string
  ) => {
    if (!activeChatId || !currentUser) return;

    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) return;

    const newMessageId = 'm_' + Date.now();
    const newMsg: Message = {
      id: newMessageId,
      chatId: activeChatId,
      senderId: currentUser.id,
      text: text,
      type: type,
      timestamp: new Date().toISOString(),
      status: 'sending',
      pollQuestion: pollQuestion,
      pollOptions: pollOptions?.map((o, idx) => ({ id: 'opt_' + idx, text: o, votes: [] })),
      fileName: fileName,
      fileSize: fileSize,
      replyToId: replyToId,
      replyToText: replyToText
    };

    // 1. Add our message locally
    setMessages(prev => [...prev, newMsg]);

    // 2. Update last message in the chat list
    let displayLastMsg = text;
    if (type === 'poll') displayLastMsg = `📊 Jajak Pendapat: ${pollQuestion}`;
    if (type === 'image') displayLastMsg = '📷 Foto baru';
    if (type === 'video') displayLastMsg = '🎥 Video baru';
    if (type === 'document') displayLastMsg = `📄 Dokumen: ${fileName || 'Berkas'}`;
    if (type === 'voice') displayLastMsg = '🎤 Pesan suara';
    if (type === 'sticker') displayLastMsg = '🐝 Stiker';

    setChats(prev => prev.map(c => c.id === activeChatId ? {
      ...c,
      lastMessage: displayLastMsg,
      lastMessageTime: newMsg.timestamp
    } : c));

    // Send to Database (Encrypted)
    try {
      const encryptedMsg = {
        ...newMsg,
        status: 'sent' as const,
        text: ['text', 'image', 'video', 'document'].includes(type) ? await encryptMessage(text, activeChatId) : text
      };
      await fetch(API_BASE + '/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(encryptedMsg)
      });
      setMessages(prev => prev.map(m => m.id === newMessageId ? { ...m, status: 'sent' } : m));
    } catch (err) {
      console.error('Failed to send message to database:', err);
    }

    // 3. Trigger Queen Bee AI reply if chatting with the AI Assistant
    if (activeChat.type === 'ai' && type === 'text') {
      // Set AI to typing mode
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, typingUserIds: ['queen_ai'] } : c));

      try {
        // Collect message logs for context
        const chatLogs = messages
          .filter(m => m.chatId === activeChatId)
          .map(m => ({
            senderName: m.senderId === currentUser.id ? 'User' : 'Queen Bee AI',
            text: m.text
          }));
        
        chatLogs.push({ senderName: 'User', text: text });

        // Call the backend API to generate AI response using the real Gemini API key
        let responseText = '';
        try {
          const aiResponse = await fetch(API_BASE + '/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: chatLogs,
              currentUserId: currentUser.id
            })
          });
          if (aiResponse.ok) {
            const resData = await aiResponse.json();
            responseText = resData.text;
          } else {
            responseText = await simulateAiChat(chatLogs, currentUser.id);
          }
        } catch (err) {
          console.warn('Real AI endpoint failed, using simulation:', err);
          responseText = await simulateAiChat(chatLogs, currentUser.id);
        }

        const aiMsg: Message = {
          id: 'm_ai_' + Date.now(),
          chatId: activeChatId,
          senderId: 'queen_ai',
          text: responseText,
          type: 'text',
          timestamp: new Date().toISOString(),
          status: 'read'
        };

        setMessages(prev => [...prev, aiMsg]);
        setChats(prev => prev.map(c => c.id === activeChatId ? {
          ...c,
          lastMessage: responseText,
          lastMessageTime: aiMsg.timestamp,
          typingUserIds: []
        } : c));

        // Push AI reply to database (Encrypted)
        const encryptedAiMsg = {
          ...aiMsg,
          text: await encryptMessage(responseText, activeChatId)
        };
        await fetch(API_BASE + '/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(encryptedAiMsg)
        });
      } catch (err) {
        console.error('Error simulating AI chat:', err);
        // Clear typing
        setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, typingUserIds: [] } : c));
      }
    }
  };

  // Add status update
  const handleAddStatus = async (content: string, type: 'text' | 'image' | 'video', bgStyle?: string) => {
    if (!currentUser) return;
    const newStatus: StatusUpdate = {
      id: 'stat_' + Date.now(),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      type: type,
      content: content,
      bgStyle: bgStyle,
      timestamp: new Date().toISOString(),
      viewedBy: []
    };

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/api/status');
      xhr.setRequestHeader('Content-Type', 'application/json');

      // Track network upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        setUploadProgress(null);
        if (xhr.status >= 200 && xhr.status < 300) {
          setStatusList(prev => [newStatus, ...prev]);
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        setUploadProgress(null);
        reject(new Error('Network error during upload'));
      };

      xhr.send(JSON.stringify(newStatus));
    });
  };
  // --- WebRTC Initialization ---
  useEffect(() => {
    if (!currentUser) return;

    webrtcService.init(currentUser.id, {
      onIncomingCall: (data: IncomingCallData) => {
        setActiveCall({
          userId: data.callerId,
          userName: data.callerName,
          avatar: data.callerAvatar,
          type: data.callType,
          isIncoming: true
        });
        setWebrtcConnectionState('new');
      },
      onCallConnected: () => {
        setWebrtcConnectionState('connected');
        callStartTimeRef.current = Date.now();
      },
      onCallEnded: (reason) => {
        console.log('[App] Call ended, reason:', reason);
        // Save call log before clearing state
        setActiveCall(prev => {
          if (prev && currentUser) {
            const duration = callStartTimeRef.current > 0
              ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
              : 0;
            const mins = Math.floor(duration / 60).toString().padStart(2, '0');
            const secs = (duration % 60).toString().padStart(2, '0');

            const newLog: CallLog = {
              id: 'call_' + Date.now(),
              userId: prev.userId,
              userName: prev.userName,
              avatar: prev.avatar,
              type: prev.type,
              isOutgoing: !prev.isIncoming,
              timestamp: new Date().toISOString(),
              status: reason === 'rejected' ? 'declined' : reason === 'unavailable' ? 'missed' : 'completed',
              duration: `${mins}:${secs}`
            };
            setCallLogs(logs => [newLog, ...logs]);
            fetch(API_BASE + '/api/calls', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newLog)
            }).catch(err => console.error('Failed to save call log:', err));
          }
          return null;
        });
        setLocalStream(null);
        setRemoteStream(null);
        setWebrtcConnectionState('new');
        callStartTimeRef.current = 0;
      },
      onRemoteStream: (stream: MediaStream) => {
        setRemoteStream(stream);
      },
      onConnectionStateChange: (state: string) => {
        setWebrtcConnectionState(state);
      }
    });

    return () => {
      // Don't destroy on re-render, only on real unmount/logout
    };
  }, [currentUser?.id]);

  // Start Voice or Video Call (WebRTC)
  const handleStartCall = async (userId: string, userName: string, avatar: string, type: 'voice' | 'video') => {
    if (!currentUser) return;

    setActiveCall({
      userId,
      userName,
      avatar,
      type,
      isIncoming: false
    });
    setWebrtcConnectionState('connecting');

    const stream = await webrtcService.startCall(
      userId,
      currentUser.name,
      currentUser.avatar,
      type
    );

    if (stream) {
      setLocalStream(stream);
    } else {
      // Call failed to start
      setActiveCall(null);
      setWebrtcConnectionState('new');
    }
  };

  // Answer incoming call
  const handleAnswerCall = async () => {
    const stream = await webrtcService.answerCall();
    if (stream) {
      setLocalStream(stream);
      setActiveCall(prev => prev ? { ...prev, isIncoming: false } : null);
    }
  };

  // Reject incoming call
  const handleRejectCall = () => {
    webrtcService.rejectCall();
    if (activeCall && currentUser) {
      const newLog: CallLog = {
        id: 'call_' + Date.now(),
        userId: activeCall.userId,
        userName: activeCall.userName,
        avatar: activeCall.avatar,
        type: activeCall.type,
        isOutgoing: false,
        timestamp: new Date().toISOString(),
        status: 'declined',
        duration: '00:00'
      };
      setCallLogs(prev => [newLog, ...prev]);
      fetch(API_BASE + '/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      }).catch(err => console.error('Failed to save call log:', err));
    }
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setWebrtcConnectionState('new');
  };

  // Hangup call (WebRTC)
  const handleEndCall = async () => {
    if (!activeCall || !currentUser) return;

    const duration = callStartTimeRef.current > 0
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : 0;
    const mins = Math.floor(duration / 60).toString().padStart(2, '0');
    const secs = (duration % 60).toString().padStart(2, '0');

    // Log call
    const newLog: CallLog = {
      id: 'call_' + Date.now(),
      userId: activeCall.userId,
      userName: activeCall.userName,
      avatar: activeCall.avatar,
      type: activeCall.type,
      isOutgoing: !activeCall.isIncoming,
      timestamp: new Date().toISOString(),
      status: 'completed',
      duration: `${mins}:${secs}`
    };

    setCallLogs(prev => [newLog, ...prev]);
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setWebrtcConnectionState('new');
    callStartTimeRef.current = 0;

    webrtcService.endCall();

    try {
      await fetch(API_BASE + '/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
    } catch (err) {
      console.error('Failed to save call log to database:', err);
    }
  };

  // WebRTC media controls
  const handleToggleMute = (): boolean => {
    return webrtcService.toggleMute();
  };

  const handleToggleCamera = (): boolean => {
    return webrtcService.toggleCamera();
  };

  // Create new chat room (Group or direct)
  const handleCreateNewChat = async (e: FormEvent) => {
    e.preventDefault();
    if (newChatType === 'direct' && !selectedUser) return;
    if (newChatType === 'group' && !newChatName.trim()) return;

    // Check duplicate direct chat
    if (newChatType === 'direct' && selectedUser) {
      const existingDirectChat = chats.find(c => 
        !c.isGroup && c.type === 'direct' && c.members.includes(selectedUser.id)
      );
      if (existingDirectChat) {
        setActiveChatId(existingDirectChat.id);
        setShowNewChatModal(false);
        return;
      }
    }

    const newId = 'chat_' + Date.now();
    const newChat: Chat = {
      id: newId,
      name: newChatType === 'group' 
        ? newChatName + ' 🍯' 
        : selectedUser.name,
      avatar: newChatType === 'group'
        ? 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=150&auto=format&fit=crop&q=80'
        : (selectedUser.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'),
      isGroup: newChatType === 'group',
      isPinned: false,
      isArchived: false,
      unreadCount: 0,
      members: newChatType === 'group' ? [currentUser.id] : [currentUser.id, selectedUser.id],
      type: newChatType === 'group' ? 'group' : 'direct',
      description: newChatType === 'group' ? (newChatDesc || 'Tidak ada deskripsi sarang.') : `Obrolan pribadi dengan ${selectedUser.name}`,
      lastMessage: 'Sarang obrolan berhasil dibuat bzzzt! 🐝',
      lastMessageTime: new Date().toISOString()
    };

    setChats(prev => [newChat, ...prev]);
    
    // Create the chat room first
    try {
      await fetch(API_BASE + '/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChat)
      });
    } catch (err) {
      console.error('Failed to create new chat in database:', err);
    }

    // Add system message if group, after the chat room exists
    if (newChatType === 'group') {
      const sysMsg: Message = {
        id: 'm_sys_' + Date.now(),
        chatId: newId,
        senderId: 'system',
        text: `Anda membuat grup "${newChat.name}"`,
        type: 'system',
        timestamp: new Date().toISOString(),
        status: 'read'
      };
      setMessages(prev => [...prev, sysMsg]);

      try {
        await fetch(API_BASE + '/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sysMsg)
        });
      } catch (err) {
        console.error('Failed to save system message:', err);
      }
    }

    setNewChatName('');
    setNewChatDesc('');
    setShowNewChatModal(false);
    setActiveChatId(newId);
  };

  // Dispatch global Admin announcement to communities
  const handleDispatchAnnouncement = async (text: string) => {
    for (const comm of communities) {
      const newAnn = {
        id: 'ann_' + Date.now() + Math.floor(Math.random() * 1000),
        text: text,
        timestamp: new Date().toISOString()
      };
      try {
        await fetch(`/api/communities/${comm.id}/announcements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAnn)
        });
      } catch (err) {
        console.error('Failed to dispatch announcement:', err);
      }
    }
  };

  // Add a new community
  const handleAddCommunity = async (name: string, desc: string) => {
    const newComm: Community = {
      id: 'comm_' + Date.now(),
      name: name,
      description: desc,
      avatar: 'https://images.unsplash.com/photo-1508558934129-56633a41a2e5?w=150&auto=format&fit=crop&q=80',
      groupCount: 1,
      memberCount: 1,
      announcements: []
    };
    setCommunities(prev => [newComm, ...prev]);

    try {
      await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComm)
      });
    } catch (err) {
      console.error('Failed to create community in database:', err);
    }
  };

  // Handle splash completion
  if (showSplash) {
    return <Splash appName={appName} appVersion={appVersion} onComplete={() => setShowSplash(false)} />;
  }

  // Handle login/auth
  if (!currentUser) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  // Filtered Chats
  const filteredChats = chats.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'chats') {
      return matchesSearch && !c.isArchived;
    }
    return false;
  });

  const archivedChatsCount = chats.filter(c => c.isArchived).length;
  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-neutral-950 text-white' : 'bg-neutral-50 text-neutral-900'} flex font-sans`}>
      
      {/* 1. APP LAYOUT WINDOW CONTAINER */}
      <div className="w-full max-w-7xl mx-auto flex h-screen overflow-hidden shadow-2xl relative">
        
        {/* LEFT BAR: TAB SELECTOR (DESKTOP RAIL) */}
        <div className="hidden sm:flex flex-col items-center justify-between py-6 w-16 bg-neutral-900 border-r border-neutral-800">
          <div className="flex flex-col items-center space-y-6">
            {/* Logo */}
            <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-amber-400/20">
              <svg className="w-6 h-6 text-neutral-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2a10 10 0 0 1 10 10v4a2 2 0 0 1-2 2h-4l-4 4-4-4H4a2 2 0 0 1-2-2v-4A10 10 0 0 1 12 2z" />
              </svg>
            </div>

            {/* Nav Tabs */}
            <nav className="flex flex-col space-y-4 pt-4">
              {[
                { tab: 'chats' as const, icon: MessageSquare, label: 'Chat' },
                { tab: 'status' as const, icon: CircleDot, label: 'Status' },
                { tab: 'calls' as const, icon: Phone, label: 'Calls' },
                { tab: 'community' as const, icon: Users, label: 'Groups' },
                { tab: 'profile' as const, icon: User, label: 'Profil' },
                { tab: 'settings' as const, icon: Settings, label: 'Setelan' },
                { tab: 'admin' as const, icon: ShieldAlert, label: 'Admin' }
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => {
                    setActiveTab(item.tab);
                    setActiveChatId(null); // Clear active chat on tab shift on small views
                  }}
                  className={`p-3 rounded-xl transition-all cursor-pointer flex flex-col items-center ${
                    activeTab === item.tab
                      ? 'bg-amber-400 text-neutral-950 shadow-md shadow-amber-400/10'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                  title={item.label}
                >
                  <item.icon className="w-5 h-5" />
                </button>
              ))}
            </nav>
          </div>

          <div className="flex flex-col space-y-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-red-950/20 transition-colors"
              title="Keluar"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN BODY AREA: SIDEBAR CHATS & ACTIVE ROOM */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* SIDEBAR MAIN PANE (Visible on desktop, or on mobile when NO activeChatId) */}
          <div className={`w-full sm:w-80 md:w-96 flex flex-col h-full bg-neutral-950 border-r border-neutral-900 ${
            activeChatId ? 'hidden sm:flex' : 'flex'
          }`}>
            
            {/* TAB SELECTOR (MOBILE FOOTER NAVBAR) */}
            <div className="sm:hidden flex justify-around p-3 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-30">
              {[
                { tab: 'chats' as const, icon: MessageSquare },
                { tab: 'status' as const, icon: CircleDot },
                { tab: 'calls' as const, icon: Phone },
                { tab: 'community' as const, icon: Users },
                { tab: 'profile' as const, icon: User },
                { tab: 'settings' as const, icon: Settings },
                { tab: 'admin' as const, icon: ShieldAlert }
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => {
                    setActiveTab(item.tab);
                    setActiveChatId(null);
                  }}
                  className={`p-2 rounded-xl transition-all ${
                    activeTab === item.tab ? 'bg-amber-400 text-neutral-950' : 'text-neutral-400'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                </button>
              ))}
            </div>

            {/* TAB RENDERING IN SIDEBAR */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'chats' && (
                <div className="flex flex-col h-full">
                  {/* Search and Title */}
                  <div className="p-4 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10">
                    <div className="flex justify-between items-center mb-3">
                      <h2 className="text-xl font-bold font-sans">Sarang Chat 🐝</h2>
                      <button
                        onClick={() => setShowNewChatModal(true)}
                        className="p-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 rounded-full transition-colors cursor-pointer"
                        title="Buat Obrolan Baru"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari obrolan manis..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Chat Lists */}
                  <div className="flex-1 overflow-y-auto divide-y divide-neutral-900/40 p-2 space-y-1">
                    {/* Archived chats entry */}
                    {archivedChatsCount > 0 && (
                      <button className="w-full flex items-center space-x-3.5 p-3 hover:bg-neutral-900/40 rounded-xl text-neutral-400 text-xs font-semibold">
                        <Archive className="w-4 h-4 text-amber-400" />
                        <span>Obrolan Diarsipkan ({archivedChatsCount})</span>
                      </button>
                    )}

                    {filteredChats.length === 0 ? (
                      <div className="text-center py-12 text-neutral-500 text-xs">
                        Belum ada obrolan bzzzt... Klik "+" untuk membuat baru!
                      </div>
                    ) : (
                      filteredChats
                        .sort((a, b) => {
                          if (a.isPinned && !b.isPinned) return -1;
                          if (!a.isPinned && b.isPinned) return 1;
                          return new Date(b.lastMessageTime || '').getTime() - new Date(a.lastMessageTime || '').getTime();
                        })
                        .map(chat => {
                          const isActive = activeChatId === chat.id;
                          return (
                            <div
                              key={chat.id}
                              onClick={() => setActiveChatId(chat.id)}
                              className={`w-full flex items-center space-x-3.5 p-3.5 rounded-2xl transition-all cursor-pointer ${
                                isActive ? 'bg-amber-400 text-neutral-950 font-bold shadow' : 'hover:bg-neutral-900/60'
                              }`}
                            >
                              <div className="relative">
                                <img
                                  src={chat.avatar}
                                  alt={chat.name}
                                  className="w-12 h-12 rounded-full object-cover border border-neutral-800"
                                />
                                {chat.type === 'ai' && (
                                  <div className="absolute -bottom-1 -right-1 bg-amber-400 text-neutral-950 p-1.5 rounded-full border border-neutral-950">
                                    <Sparkles className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '4s' }} />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                  <h4 className="text-xs font-bold truncate flex items-center">
                                    {chat.name}
                                    {chat.isPinned && <Pin className="w-3 h-3 text-amber-500 ml-1.5 fill-current" />}
                                  </h4>
                                  <span className={`text-[10px] font-mono ${isActive ? 'text-neutral-900' : 'text-neutral-500'}`}>
                                    {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                  </span>
                                </div>
                                <p className={`text-xs truncate ${isActive ? 'text-neutral-800' : 'text-neutral-400'}`}>
                                  {chat.lastMessage}
                                </p>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'status' && (
                <StatusView
                  statuses={statusList}
                  currentUser={currentUser}
                  chats={chats}
                  uploadProgress={uploadProgress}
                  onAddStatus={handleAddStatus}
                />
              )}

              {activeTab === 'calls' && (
                <CallsView
                  callLogs={callLogs}
                  activeCall={activeCall}
                  onStartCall={(uid, uname, av, type) => handleStartCall(uid, uname, av, type)}
                  onEndCall={handleEndCall}
                  onAnswerCall={handleAnswerCall}
                  onRejectCall={handleRejectCall}
                  localStream={localStream}
                  remoteStream={remoteStream}
                  connectionState={webrtcConnectionState}
                  onToggleMute={handleToggleMute}
                  onToggleCamera={handleToggleCamera}
                />
              )}

              {activeTab === 'community' && (
                <CommunityView
                  communities={communities}
                  onAddCommunity={handleAddCommunity}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileView
                  profile={currentUser}
                  onUpdateProfile={(updated) => {
                    const next = { ...currentUser, ...updated };
                    setCurrentUser(next);
                    localStorage.setItem('beechat_user', JSON.stringify(next));
                  }}
                  onUnblockUser={handleUnblockUser}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  darkMode={darkMode}
                  onToggleDarkMode={() => setDarkMode(!darkMode)}
                  wallpaper={wallpaper}
                  onChangeWallpaper={(wp) => setWallpaper(wp)}
                  onLogout={handleLogout}
                />
              )}

              {activeTab === 'admin' && (
                <DashboardView
                  onDispatchAnnouncement={handleDispatchAnnouncement}
                />
              )}
            </div>
          </div>
          {/* RIGHT BAR: CHAT ROOM / DETAILS STAGE (Visible on desktop, or on mobile when activeChatId is SET) */}
          <div className={`flex-1 flex flex-col h-full bg-neutral-900 ${
            activeChatId ? 'flex' : 'hidden sm:flex'
          }`}>
            {activeChatId && activeChat ? (
              <ChatRoom
                chat={activeChat}
                messages={messages}
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
                onBack={() => setActiveChatId(null)}
                onStartCall={(type) => handleStartCall(activeChat.id, activeChat.name, activeChat.avatar, type)}
                onUpdateMessage={handleUpdateMessage}
                onDeleteMessage={handleDeleteMessage}
                onDeleteChat={handleDeleteChat}
                onBlockUser={handleBlockUser}
                onUnblockUser={handleUnblockUser}
                blockedUsers={blockedUsers}
              />
            ) : (
              /* LANDING DEFAULT SCREEN FOR DESKTOP */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-neutral-950 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/5 blur-3xl rounded-full"></div>
                
                {/* Honeycomb Centerpiece graphics */}
                <div className="w-28 h-28 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-amber-500/10 mb-6 relative">
                  <svg className="w-14 h-14 text-neutral-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2a10 10 0 0 1 10 10v4a2 2 0 0 1-2 2h-4l-4 4-4-4H4a2 2 0 0 1-2-2v-4A10 10 0 0 1 12 2z" />
                    <line x1="9" y1="11" x2="15" y2="11" stroke="black" strokeWidth="2" />
                    <line x1="9.5" y1="13" x2="14.5" y2="13" stroke="black" strokeWidth="2" />
                  </svg>
                </div>

                <h1 className="text-3xl font-extrabold tracking-tight">
                  Bee<span className="text-amber-400">Chat</span> Desktop
                </h1>
                <p className="text-neutral-400 text-sm mt-3.5 max-w-sm leading-relaxed font-sans">
                  Kirim dan terima pesan dengan cepat, buat polling sarang, bagikan status, atau minta bantuan asisten cerdas <strong>Queen Bee AI</strong>!
                </p>

                <div className="mt-8 flex items-center space-x-2.5 text-[10px] font-mono text-neutral-500 uppercase tracking-widest bg-neutral-900 px-4 py-2 rounded-2xl border border-neutral-800">
                  <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Terenkripsi End-to-End dengan Aman</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE NEW CHAT ROOM MODAL POPUP */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-50 bg-neutral-950/90 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl"
            >
              <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex justify-between items-center">
                <h3 className="font-bold text-sm flex items-center text-amber-400">
                  <MessageSquare className="w-4 h-4 mr-1.5" /> Buat Obrolan / Sarang Baru
                </h3>
                <button onClick={() => setShowNewChatModal(false)} className="text-neutral-400 hover:text-white font-bold">X</button>
              </div>

              <form onSubmit={handleCreateNewChat} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-300 font-medium">Tipe Obrolan</label>
                  <div className="grid grid-cols-2 gap-3 bg-neutral-950 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setNewChatType('direct')}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                        newChatType === 'direct' ? 'bg-amber-400 text-neutral-950' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Obrolan Pribadi (Direct)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewChatType('group')}
                      className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                        newChatType === 'group' ? 'bg-amber-400 text-neutral-950' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Grup Kelompok Kerja
                    </button>
                  </div>
                </div>

                {newChatType === 'direct' ? (
                  <div className="space-y-2 relative">
                    <label className="text-xs text-neutral-300 font-medium flex justify-between">
                      <span>Cari Anggota Lebah</span>
                      <span className="text-[10px] text-neutral-500">Berdasarkan Nama/Email/Telp</span>
                    </label>
                    
                    {selectedUser ? (
                      <div className="flex items-center justify-between bg-amber-400/10 border border-amber-400/30 p-3 rounded-xl">
                        <div className="flex items-center space-x-3">
                          {selectedUser.avatar ? (
                            <img src={selectedUser.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-400">🐝</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate">{selectedUser.name}</p>
                            <p className="text-[10px] text-neutral-400 truncate">@{selectedUser.username} • {selectedUser.phone || selectedUser.email || ''}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedUser(null)}
                          className="text-neutral-400 hover:text-amber-400 transition-colors font-bold text-xs p-1"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <input
                            type="text"
                            value={newChatSearchQuery}
                            onChange={(e) => setNewChatSearchQuery(e.target.value)}
                            placeholder="Ketik nama, email, atau nomor telepon..."
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                          />
                          {isSearching && (
                            <div className="absolute right-3 top-3 w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                          )}
                        </div>

                        {searchResults.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-xl shadow-xl divide-y divide-neutral-900">
                            {searchResults.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setNewChatName(u.name);
                                  setNewChatSearchQuery('');
                                  setSearchResults([]);
                                }}
                                className="w-full text-left p-3 hover:bg-neutral-900 transition-colors flex items-center space-x-3"
                              >
                                {u.avatar ? (
                                  <img src={u.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-400">🐝</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-white truncate">{u.name}</p>
                                  <p className="text-[10px] text-neutral-400 truncate">@{u.username} • {u.phone || u.email || ''}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {newChatSearchQuery.trim() !== '' && !isSearching && searchResults.length === 0 && (
                          <div className="p-3 text-center text-xs text-neutral-500 bg-neutral-950 border border-neutral-800 rounded-xl">
                            Tidak ada lebah pekerja yang cocok. 🐝
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-300 font-medium">Nama Grup Kelompok Kerja</label>
                    <input
                      type="text"
                      required
                      value={newChatName}
                      onChange={(e) => setNewChatName(e.target.value)}
                      placeholder="Contoh: Pekerja Seksi Timur"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                {newChatType === 'group' && (
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-300 font-medium">Deskripsi Kelompok</label>
                    <textarea
                      value={newChatDesc}
                      onChange={(e) => setNewChatDesc(e.target.value)}
                      placeholder="Tujuan atau target kelompok kerja ini..."
                      rows={2}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-amber-400 resize-none"
                    />
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowNewChatModal(false)}
                    className="px-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs transition-all shadow"
                  >
                    Buat Obrolan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CALL DIALOG FOR ACTIVE CALL (FOR OUTGOING CALL SOUND OR SCREEN ACTION) */}
      {/* We already render the CallsView overlay when activeCall is set. */}
    </div>
  );
}
