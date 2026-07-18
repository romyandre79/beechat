export interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  email: string;
  phone: string;
  isOnline: boolean;
  lastSeen?: string;
  coverPhoto?: string;
}

export type MessageType = 'text' | 'image' | 'voice' | 'poll' | 'sticker' | 'system' | 'video' | 'document';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // User IDs who voted for this option
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  type: MessageType;
  timestamp: string;
  status: MessageStatus;
  mediaUrl?: string;
  fileName?: string; // For documents
  fileSize?: string; // For documents/videos
  duration?: number; // For voice notes/videos (seconds)
  pollQuestion?: string;
  pollOptions?: PollOption[];
  isStarred?: boolean;
  isPinned?: boolean;
  reactions?: MessageReaction[];
  replyToId?: string; // ID of message being replied to
  replyToText?: string;
}

export interface Chat {
  id: string;
  name: string;
  avatar: string;
  isGroup: boolean;
  isPinned: boolean;
  isArchived: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  members: string[]; // User IDs
  type: 'direct' | 'group' | 'ai';
  description?: string;
  typingUserIds?: string[]; // IDs of users currently typing
}

export interface CallLog {
  id: string;
  userId: string; // The user we called or who called us
  userName: string;
  avatar: string;
  type: 'voice' | 'video';
  isOutgoing: boolean;
  timestamp: string;
  status: 'missed' | 'completed' | 'declined';
  duration?: string;
}

export interface StatusUpdate {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'text' | 'image' | 'video';
  content: string; // Text, Image URL, or Video URL/Base64
  bgStyle?: string; // Tailwind class like bg-gradient-to-r from-amber-500 to-yellow-400
  timestamp: string;
  viewedBy: string[]; // User IDs
}

export interface Community {
  id: string;
  name: string;
  description: string;
  avatar: string;
  groupCount: number;
  memberCount: number;
  announcements?: {
    id: string;
    text: string;
    timestamp: string;
  }[];
}

export interface Sticker {
  id: number;
  url: string;
  userId?: string;
  label?: string;
}
