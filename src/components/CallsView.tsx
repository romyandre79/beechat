import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Video, PhoneOff, Mic, MicOff, Volume2, VolumeX, Camera, CameraOff, Shield, Users, Monitor, Circle, Wifi, WifiOff } from 'lucide-react';
import { CallLog } from '../types';

interface CallsViewProps {
  callLogs: CallLog[];
  activeCall: {
    userId: string;
    userName: string;
    avatar: string;
    type: 'voice' | 'video';
    isIncoming: boolean;
  } | null;
  onStartCall: (userId: string, userName: string, avatar: string, type: 'voice' | 'video') => void;
  onEndCall: () => void;
  onAnswerCall: () => void;
  onRejectCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: string;
  onToggleMute: () => boolean;
  onToggleCamera: () => boolean;
  activeCallOnly?: boolean;
}

export default function CallsView({
  callLogs, activeCall, onStartCall, onEndCall, onAnswerCall, onRejectCall,
  localStream, remoteStream, connectionState, onToggleMute, onToggleCamera,
  activeCallOnly = false
}: CallsViewProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callTimer, setCallTimer] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video/audio element
  useEffect(() => {
    if (remoteStream) {
      if (activeCall?.type === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, activeCall?.type]);

  // Handle speaker toggle on audio/video element
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isSpeakerOn;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isSpeakerOn;
    }
  }, [isSpeakerOn]);

  // Call timer - starts when connected
  useEffect(() => {
    let timer: any;
    if (activeCall && connectionState === 'connected') {
      timer = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    }
    if (!activeCall) {
      setCallTimer(0);
      setIsMuted(false);
      setIsCameraOn(true);
      setIsSpeakerOn(true);
    }
    return () => clearInterval(timer);
  }, [activeCall, connectionState]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleToggleMute = () => {
    const muted = onToggleMute();
    setIsMuted(muted);
  };

  const handleToggleCamera = () => {
    const cameraOn = onToggleCamera();
    setIsCameraOn(cameraOn);
  };

  const getStatusText = () => {
    if (activeCall?.isIncoming && connectionState !== 'connected') {
      return 'Panggilan Masuk...';
    }
    switch (connectionState) {
      case 'connecting':
      case 'new':
        return 'Menghubungkan...';
      case 'connected':
        return formatTimer(callTimer);
      case 'disconnected':
        return 'Terputus...';
      case 'failed':
        return 'Koneksi Gagal';
      default:
        return 'Memanggil...';
    }
  };

  const getConnectionIcon = () => {
    if (connectionState === 'connected') {
      return <Wifi className="w-3 h-3 text-emerald-400" />;
    }
    if (connectionState === 'failed' || connectionState === 'disconnected') {
      return <WifiOff className="w-3 h-3 text-red-400" />;
    }
    return <Wifi className="w-3 h-3 text-amber-400 animate-pulse" />;
  };

  const renderActiveCallScreen = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 bg-neutral-950 flex flex-col justify-between"
    >
      {/* Hidden audio element for voice calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Security Banner */}
      <div className="p-4 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between z-20">
        <div className="flex items-center space-x-2 bg-neutral-900/60 backdrop-blur px-3 py-1.5 rounded-full border border-neutral-800">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-semibold text-neutral-300 tracking-wider uppercase font-mono">Terenkripsi End-To-End</span>
        </div>
        <div className="flex items-center space-x-2">
          {/* Connection quality indicator */}
          <div className="flex items-center space-x-1.5 bg-neutral-900/60 backdrop-blur px-2 py-1 rounded-full border border-neutral-800">
            {getConnectionIcon()}
            <span className="text-[9px] font-mono text-neutral-400 uppercase">
              {connectionState === 'connected' ? 'P2P' : connectionState}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Circle className="w-2.5 h-2.5 text-emerald-500 fill-current animate-ping" />
            <span className="text-xs font-mono font-bold text-neutral-300">Live</span>
          </div>
        </div>
      </div>

      {/* CALL CENTER STAGE */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {activeCall?.type === 'video' ? (
          /* VIDEO CALL LAYOUT */
          <div className="w-full h-full max-h-[60vh] max-w-sm rounded-3xl overflow-hidden relative border border-neutral-800 shadow-2xl bg-neutral-900">
            {/* Remote video stream */}
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                <div className="flex flex-col items-center space-y-4">
                  <img
                    src={activeCall.avatar}
                    alt={activeCall.userName}
                    className="w-24 h-24 rounded-full object-cover border-4 border-neutral-700"
                  />
                  <p className="text-sm text-neutral-400 font-mono animate-pulse">
                    {activeCall.isIncoming ? 'Menunggu jawaban...' : 'Menghubungkan video...'}
                  </p>
                </div>
              </div>
            )}
            
            {/* Local video feed PIP (Picture-In-Picture) */}
            {isCameraOn && localStream && (
              <div className="absolute top-4 right-4 w-28 h-40 bg-neutral-950 rounded-2xl border-2 border-amber-400 overflow-hidden shadow-lg z-10 transition-transform hover:scale-105">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              </div>
            )}

            {/* Remote user floating name card */}
            <div className="absolute bottom-4 left-4 right-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex justify-between items-end">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center">
                  {activeCall.userName} <span className="text-xs font-normal text-amber-400 ml-2">({activeCall.type})</span>
                </h3>
                <p className="text-xs text-neutral-300 font-mono mt-1">
                  {getStatusText()}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* VOICE CALL LAYOUT WITH RIPPLES */
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center w-40 h-40">
              {/* Animated waves */}
              {connectionState === 'connected' && (
                <>
                  <div className="absolute inset-0 border border-amber-400/20 rounded-full animate-ping scale-150" style={{ animationDuration: '3s' }} />
                  <div className="absolute inset-0 border border-amber-400/40 rounded-full animate-ping scale-110" style={{ animationDuration: '2s' }} />
                </>
              )}
              {connectionState !== 'connected' && (
                <div className="absolute inset-0 border-2 border-amber-400/30 rounded-full animate-pulse scale-125" />
              )}
              
              <img
                src={activeCall?.avatar}
                alt={activeCall?.userName}
                className="w-28 h-28 rounded-full object-cover border-4 border-amber-400 relative z-10 shadow-lg shadow-amber-400/20"
              />
            </div>

            <h3 className="text-2xl font-extrabold mt-8 text-neutral-100">{activeCall?.userName}</h3>
            <p className="text-sm font-mono text-amber-400 mt-2 font-bold uppercase tracking-wider">
              {activeCall?.type === 'voice' ? 'Panggilan Suara' : 'Video Call'} • {getStatusText()}
            </p>
          </div>
        )}
      </div>

      {/* CALL CONTROLS TRAY */}
      <div className="p-8 bg-gradient-to-t from-black to-neutral-900 border-t border-neutral-800 rounded-t-3xl flex flex-col items-center space-y-6">
        {/* Additional Toggles for Video call */}
        {activeCall?.type === 'video' && !activeCall.isIncoming && (
          <div className="flex space-x-3.5 bg-neutral-950 p-2 rounded-2xl border border-neutral-800/40">
            <button
              onClick={handleToggleCamera}
              className={`p-3 rounded-xl transition-all text-xs flex flex-col items-center space-y-1 cursor-pointer ${
                isCameraOn ? 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800' : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
              title="Kamera"
            >
              {isCameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
              <span className="text-[9px] font-mono">{isCameraOn ? 'Kamera' : 'Mati'}</span>
            </button>
          </div>
        )}

        {/* Main controls (Mute, Speaker, Answer/Hangup) */}
        <div className="flex items-center space-x-6">
          {/* Mute button */}
          <button
            onClick={handleToggleMute}
            className={`p-4 rounded-full transition-all cursor-pointer ${
              isMuted ? 'bg-neutral-800 text-red-500 border border-red-500/30' : 'bg-neutral-900 text-white hover:bg-neutral-800'
            }`}
            title="Bisukan"
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {activeCall?.isIncoming && connectionState !== 'connected' ? (
            /* INCOMING CALL ACTIONS */
            <div className="flex space-x-4">
              <button
                onClick={onRejectCall}
                className="p-5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all shadow-lg shadow-red-600/20 cursor-pointer"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <button
                onClick={onAnswerCall}
                className="p-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-all shadow-lg shadow-emerald-500/20 cursor-pointer animate-pulse"
              >
                <Phone className="w-7 h-7" />
              </button>
            </div>
          ) : (
            /* OUTGOING / RUNNING HANGUP */
            <button
              onClick={onEndCall}
              className="p-5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all shadow-lg shadow-red-600/20 scale-110 hover:scale-120 cursor-pointer"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          )}

          {/* Speaker button */}
          <button
            onClick={() => setIsSpeakerOn(prev => !prev)}
            className={`p-4 rounded-full transition-all cursor-pointer ${
              isSpeakerOn ? 'bg-amber-400 text-neutral-950 font-bold' : 'bg-neutral-900 text-white hover:bg-neutral-800'
            }`}
            title="Speaker"
          >
            {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </motion.div>
  );

  if (activeCallOnly) {
    return activeCall ? renderActiveCallScreen() : null;
  }


  return (
    <div className="flex flex-col h-full bg-neutral-950 font-sans text-white overflow-y-auto relative">
      {/* Hidden audio element for voice calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* View Header */}
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-sans">Panggilan</h2>
          <p className="text-xs text-neutral-400">Hubungi lebah terdekat dalam sekejap</p>
        </div>
      </div>

      {/* Logs list */}
      <div className="p-4 space-y-4 flex-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">Riwayat Panggilan</h3>
        
        {callLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-500">
            <Phone className="w-10 h-10 mb-3 text-neutral-600" />
            <p className="text-sm font-medium">Belum ada riwayat panggilan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {callLogs.map(log => {
              const date = new Date(log.timestamp);
              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-neutral-900/40 hover:bg-neutral-900/80 rounded-2xl border border-neutral-900 transition-all"
                >
                  <div className="flex items-center space-x-3.5">
                    <img
                      src={log.avatar}
                      alt={log.userName}
                      className="w-11 h-11 rounded-full object-cover border border-neutral-800"
                    />
                    <div>
                      <h4 className="font-bold text-sm text-neutral-200">{log.userName}</h4>
                      <div className="flex items-center space-x-1.5 mt-1 text-xs text-neutral-500">
                        {log.isOutgoing ? (
                          <span className="text-amber-500 font-medium">Keluar •</span>
                        ) : (
                          <span className={log.status === 'missed' ? 'text-red-500 font-medium' : 'text-emerald-500 font-medium'}>
                            {log.status === 'missed' ? 'Tak Terjawab •' : 'Masuk •'}
                          </span>
                        )}
                        <span>
                          {date.toLocaleDateString([], { day: 'numeric', month: 'short' })} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => onStartCall(log.userId, log.userName, log.avatar, 'voice')}
                      className="p-2.5 bg-neutral-800 hover:bg-amber-400 hover:text-neutral-950 rounded-xl transition-colors cursor-pointer"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onStartCall(log.userId, log.userName, log.avatar, 'video')}
                      className="p-2.5 bg-neutral-800 hover:bg-amber-400 hover:text-neutral-950 rounded-xl transition-colors cursor-pointer"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTIVE CALL OVERLAY SCREEN */}
      <AnimatePresence>
        {activeCall && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 bg-neutral-950 flex flex-col justify-between"
          >
            {/* Top Security Banner */}
            <div className="p-4 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between z-20">
              <div className="flex items-center space-x-2 bg-neutral-900/60 backdrop-blur px-3 py-1.5 rounded-full border border-neutral-800">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-semibold text-neutral-300 tracking-wider uppercase font-mono">Terenkripsi End-To-End</span>
              </div>
              <div className="flex items-center space-x-2">
                {/* Connection quality indicator */}
                <div className="flex items-center space-x-1.5 bg-neutral-900/60 backdrop-blur px-2 py-1 rounded-full border border-neutral-800">
                  {getConnectionIcon()}
                  <span className="text-[9px] font-mono text-neutral-400 uppercase">
                    {connectionState === 'connected' ? 'P2P' : connectionState}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Circle className="w-2.5 h-2.5 text-emerald-500 fill-current animate-ping" />
                  <span className="text-xs font-mono font-bold text-neutral-300">Live</span>
                </div>
              </div>
            </div>

            {/* CALL CENTER STAGE */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
              {activeCall.type === 'video' ? (
                /* VIDEO CALL LAYOUT */
                <div className="w-full h-full max-h-[60vh] max-w-sm rounded-3xl overflow-hidden relative border border-neutral-800 shadow-2xl bg-neutral-900">
                  {/* Remote video stream */}
                  {remoteStream ? (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                      <div className="flex flex-col items-center space-y-4">
                        <img
                          src={activeCall.avatar}
                          alt={activeCall.userName}
                          className="w-24 h-24 rounded-full object-cover border-4 border-neutral-700"
                        />
                        <p className="text-sm text-neutral-400 font-mono animate-pulse">
                          {activeCall.isIncoming ? 'Menunggu jawaban...' : 'Menghubungkan video...'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Local video feed PIP (Picture-In-Picture) */}
                  {isCameraOn && localStream && (
                    <div className="absolute top-4 right-4 w-28 h-40 bg-neutral-950 rounded-2xl border-2 border-amber-400 overflow-hidden shadow-lg z-10 transition-transform hover:scale-105">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover mirror"
                        style={{ transform: 'scaleX(-1)' }}
                      />
                    </div>
                  )}

                  {/* Remote user floating name card */}
                  <div className="absolute bottom-4 left-4 right-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex justify-between items-end">
                    <div>
                      <h3 className="font-bold text-lg text-white flex items-center">
                        {activeCall.userName} <span className="text-xs font-normal text-amber-400 ml-2">({activeCall.type})</span>
                      </h3>
                      <p className="text-xs text-neutral-300 font-mono mt-1">
                        {getStatusText()}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* VOICE CALL LAYOUT WITH RIPPLES */
                <div className="flex flex-col items-center">
                  <div className="relative flex items-center justify-center w-40 h-40">
                    {/* Animated waves */}
                    {connectionState === 'connected' && (
                      <>
                        <div className="absolute inset-0 border border-amber-400/20 rounded-full animate-ping scale-150" style={{ animationDuration: '3s' }} />
                        <div className="absolute inset-0 border border-amber-400/40 rounded-full animate-ping scale-110" style={{ animationDuration: '2s' }} />
                      </>
                    )}
                    {connectionState !== 'connected' && (
                      <div className="absolute inset-0 border-2 border-amber-400/30 rounded-full animate-pulse scale-125" />
                    )}
                    
                    <img
                      src={activeCall.avatar}
                      alt={activeCall.userName}
                      className="w-28 h-28 rounded-full object-cover border-4 border-amber-400 relative z-10 shadow-lg shadow-amber-400/20"
                    />
                  </div>

                  <h3 className="text-2xl font-extrabold mt-8 text-neutral-100">{activeCall.userName}</h3>
                  <p className="text-sm font-mono text-amber-400 mt-2 font-bold uppercase tracking-wider">
                    {activeCall.type === 'voice' ? 'Panggilan Suara' : 'Video Call'} • {getStatusText()}
                  </p>
                </div>
              )}
            </div>

            {/* CALL CONTROLS TRAY */}
            <div className="p-8 bg-gradient-to-t from-black to-neutral-900 border-t border-neutral-800 rounded-t-3xl flex flex-col items-center space-y-6">
              {/* Additional Toggles for Video call */}
              {activeCall.type === 'video' && !activeCall.isIncoming && (
                <div className="flex space-x-3.5 bg-neutral-950 p-2 rounded-2xl border border-neutral-800/40">
                  <button
                    onClick={handleToggleCamera}
                    className={`p-3 rounded-xl transition-all text-xs flex flex-col items-center space-y-1 cursor-pointer ${
                      isCameraOn ? 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                    title="Kamera"
                  >
                    {isCameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                    <span className="text-[9px] font-mono">{isCameraOn ? 'Kamera' : 'Mati'}</span>
                  </button>
                </div>
              )}

              {/* Main controls (Mute, Speaker, Answer/Hangup) */}
              <div className="flex items-center space-x-6">
                {/* Mute button */}
                <button
                  onClick={handleToggleMute}
                  className={`p-4 rounded-full transition-all cursor-pointer ${
                    isMuted ? 'bg-neutral-800 text-red-500 border border-red-500/30' : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                  title="Bisukan"
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                {activeCall.isIncoming && connectionState !== 'connected' ? (
                  /* INCOMING CALL ACTIONS */
                  <div className="flex space-x-4">
                    <button
                      onClick={onRejectCall}
                      className="p-5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all shadow-lg shadow-red-600/20 cursor-pointer"
                    >
                      <PhoneOff className="w-7 h-7" />
                    </button>
                    <button
                      onClick={onAnswerCall}
                      className="p-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-all shadow-lg shadow-emerald-500/20 cursor-pointer animate-pulse"
                    >
                      <Phone className="w-7 h-7" />
                    </button>
                  </div>
                ) : (
                  /* OUTGOING / RUNNING HANGUP */
                  <button
                    onClick={onEndCall}
                    className="p-5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all shadow-lg shadow-red-600/20 scale-110 hover:scale-120 cursor-pointer"
                  >
                    <PhoneOff className="w-7 h-7" />
                  </button>
                )}

                {/* Speaker button */}
                <button
                  onClick={() => setIsSpeakerOn(prev => !prev)}
                  className={`p-4 rounded-full transition-all cursor-pointer ${
                    isSpeakerOn ? 'bg-amber-400 text-neutral-950 font-bold' : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                  title="Speaker"
                >
                  {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
