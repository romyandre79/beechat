import { io, Socket } from 'socket.io-client';

declare const __API_SERVER__: string;
declare const __API_PORT__: string;

const API_BASE = (window.location.protocol.startsWith('http') && !window.location.origin.startsWith('capacitor://') && !window.location.origin.startsWith('http://localhost:80') && !window.location.origin.startsWith('file://'))
  ? ''
  : `http://${__API_SERVER__}:${__API_PORT__}`;

// --- Types ---

export interface IncomingCallData {
  callerId: string;
  callerName: string;
  callerAvatar: string;
  callType: 'voice' | 'video';
}

export interface WebRTCCallbacks {
  onIncomingCall: (data: IncomingCallData) => void;
  onCallConnected: () => void;
  onCallEnded: (reason: 'remote-hangup' | 'rejected' | 'unavailable' | 'error') => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: string) => void;
}

// --- WebRTC Service Class ---

export class WebRTCService {
  private socket: Socket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private iceServers: RTCIceServer[] = [];
  private currentUserId: string = '';
  private currentTargetUserId: string = '';
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private callbacks: WebRTCCallbacks | null = null;

  // Store incoming call SDP for later use when answering
  private pendingOffer: RTCSessionDescriptionInit | null = null;
  private pendingCallType: 'voice' | 'video' = 'voice';

  // --- Initialization ---

  async init(userId: string, callbacks: WebRTCCallbacks) {
    this.currentUserId = userId;
    this.callbacks = callbacks;

    // Fetch ICE config from server
    try {
      const res = await fetch(API_BASE + '/api/ice-config');
      if (res.ok) {
        const data = await res.json();
        this.iceServers = data.iceServers || [];
        console.log('[WebRTC] ICE servers loaded:', this.iceServers.length);
      }
    } catch (err) {
      console.warn('[WebRTC] Failed to load ICE config, using defaults:', err);
      this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    }

    // Connect to Socket.IO signaling server
    const socketUrl = API_BASE || window.location.origin;
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('[WebRTC] Socket.IO connected:', this.socket?.id);
      this.socket?.emit('register', this.currentUserId);
    });

    this.socket.on('reconnect', () => {
      console.log('[WebRTC] Socket.IO reconnected, re-registering...');
      this.socket?.emit('register', this.currentUserId);
    });

    // Handle incoming call offer
    this.socket.on('call-incoming', (data: {
      callerId: string;
      callerName: string;
      callerAvatar: string;
      callType: 'voice' | 'video';
      sdpOffer: RTCSessionDescriptionInit;
    }) => {
      console.log('[WebRTC] Incoming call from:', data.callerId);
      this.pendingOffer = data.sdpOffer;
      this.pendingCallType = data.callType;
      this.currentTargetUserId = data.callerId;
      this.callbacks?.onIncomingCall({
        callerId: data.callerId,
        callerName: data.callerName,
        callerAvatar: data.callerAvatar,
        callType: data.callType
      });
    });

    // Handle call answered
    this.socket.on('call-answered', async (data: {
      answererId: string;
      sdpAnswer: RTCSessionDescriptionInit;
    }) => {
      console.log('[WebRTC] Call answered by:', data.answererId);
      try {
        if (this.peerConnection && this.peerConnection.signalingState === 'have-local-offer') {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdpAnswer));
          // Flush pending ICE candidates
          this.flushPendingIceCandidates();
          this.callbacks?.onCallConnected();
        }
      } catch (err) {
        console.error('[WebRTC] Error setting remote answer:', err);
      }
    });

    // Handle ICE candidates
    this.socket.on('ice-candidate', async (data: {
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      try {
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          // Queue candidate until remote description is set
          this.pendingIceCandidates.push(data.candidate);
        }
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    });

    // Handle call rejected
    this.socket.on('call-rejected', () => {
      console.log('[WebRTC] Call was rejected');
      this.cleanup();
      this.callbacks?.onCallEnded('rejected');
    });

    // Handle call ended by remote
    this.socket.on('call-ended', () => {
      console.log('[WebRTC] Call ended by remote');
      this.cleanup();
      this.callbacks?.onCallEnded('remote-hangup');
    });

    // Handle target unavailable
    this.socket.on('call-unavailable', () => {
      console.log('[WebRTC] Target user is unavailable');
      this.cleanup();
      this.callbacks?.onCallEnded('unavailable');
    });
  }

  // --- Start Call (Caller side) ---

  async startCall(
    targetUserId: string,
    callerName: string,
    callerAvatar: string,
    callType: 'voice' | 'video'
  ): Promise<MediaStream | null> {
    this.currentTargetUserId = targetUserId;
    this.pendingCallType = callType;

    // Check if mediaDevices API is available (only in secure contexts like HTTPS/localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = 'Akses kamera/mikrofon diblokir oleh browser karena koneksi tidak aman (HTTP). Silakan gunakan HTTPS atau localhost untuk melakukan panggilan WebRTC! 🐝';
      alert(errMsg);
      console.error('[WebRTC]', errMsg);
      this.callbacks?.onCallEnded('error');
      return null;
    }

    try {
      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false
      });

      // Create peer connection
      this.createPeerConnection();

      // Add local tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Create and send offer
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video'
      });
      await this.peerConnection!.setLocalDescription(offer);

      // Send offer via signaling
      this.socket?.emit('call-offer', {
        targetUserId,
        callerId: this.currentUserId,
        callerName,
        callerAvatar,
        callType,
        sdpOffer: offer
      });

      console.log('[WebRTC] Call offer sent to:', targetUserId);
      return this.localStream;
    } catch (err: any) {
      console.error('[WebRTC] Error starting call:', err);
      this.cleanup();
      this.callbacks?.onCallEnded('error');
      return null;
    }
  }

  // --- Answer Call (Receiver side) ---

  async answerCall(): Promise<MediaStream | null> {
    if (!this.pendingOffer) {
      console.error('[WebRTC] No pending offer to answer');
      return null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = 'Akses kamera/mikrofon tidak tersedia karena koneksi tidak aman (HTTP). Gunakan HTTPS! 🐝';
      alert(errMsg);
      this.cleanup();
      this.callbacks?.onCallEnded('error');
      return null;
    }

    try {
      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: this.pendingCallType === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false
      });


      // Create peer connection
      this.createPeerConnection();

      // Add local tracks
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Set remote description (the offer)
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));

      // Flush any queued ICE candidates
      this.flushPendingIceCandidates();

      // Create and send answer
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);

      this.socket?.emit('call-answer', {
        callerId: this.currentTargetUserId,
        sdpAnswer: answer
      });

      this.pendingOffer = null;
      this.callbacks?.onCallConnected();
      console.log('[WebRTC] Call answered successfully');
      return this.localStream;
    } catch (err: any) {
      console.error('[WebRTC] Error answering call:', err);
      this.cleanup();
      this.callbacks?.onCallEnded('error');
      return null;
    }
  }

  // --- Reject Call ---

  rejectCall() {
    this.socket?.emit('call-reject', {
      callerId: this.currentTargetUserId
    });
    this.pendingOffer = null;
    this.cleanup();
  }

  // --- End Call ---

  endCall() {
    this.socket?.emit('call-end', {
      targetUserId: this.currentTargetUserId
    });
    this.cleanup();
  }

  // --- Media Controls ---

  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // return true if muted
      }
    }
    return false;
  }

  toggleCamera(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled; // return true if camera is on
      }
    }
    return false;
  }

  toggleSpeaker(): boolean {
    // Speaker toggling is handled by the <audio>/<video> element's volume
    // This is a no-op at the WebRTC level; UI handles it
    return true;
  }

  // --- Getters ---

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // --- Private: Create Peer Connection ---

  private createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    // Remote stream handling
    this.remoteStream = new MediaStream();

    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind);
      event.streams[0].getTracks().forEach(track => {
        this.remoteStream!.addTrack(track);
      });
      this.callbacks?.onRemoteStream(this.remoteStream!);
    };

    // ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket?.emit('ice-candidate', {
          targetUserId: this.currentTargetUserId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    // Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'unknown';
      console.log('[WebRTC] Connection state:', state);
      this.callbacks?.onConnectionStateChange(state);

      if (state === 'failed' || state === 'disconnected') {
        console.warn('[WebRTC] Connection failed/disconnected');
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', this.peerConnection?.iceConnectionState);
    };
  }

  // --- Private: Flush queued ICE candidates ---

  private flushPendingIceCandidates() {
    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift()!;
      this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
        console.warn('[WebRTC] Error adding queued ICE candidate:', err);
      });
    }
  }

  // --- Private: Cleanup ---

  private cleanup() {
    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.pendingIceCandidates = [];
    this.currentTargetUserId = '';
  }

  // --- Destroy (on logout) ---

  destroy() {
    this.cleanup();
    this.pendingOffer = null;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentUserId = '';
  }
}

// Singleton instance
export const webrtcService = new WebRTCService();
