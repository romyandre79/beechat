import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface SplashProps {
  appName?: string;
  appVersion?: string;
  onComplete: () => void;
}

export default function Splash({ appName = 'BeeChat', appVersion = '1.0.0', onComplete }: SplashProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    const timer = setTimeout(() => {
      onComplete();
    }, 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center text-white select-none z-50">
      {/* Background Glowing Orb */}
      <div className="absolute w-72 h-72 bg-amber-500/10 blur-3xl rounded-full top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
      
      {/* Animated Bee Logo */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [1, 1.1, 1], opacity: 1 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
        className="relative mb-6 flex items-center justify-center"
      >
        <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl scale-125 animate-pulse"></div>
        {/* Decorative Golden Rings */}
        <div className="w-32 h-32 border-4 border-dashed border-amber-500/30 rounded-full animate-spin absolute" style={{ animationDuration: '20s' }}></div>
        
        {/* Core Bee Logo Card */}
        <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-500/20 z-10">
          <svg className="w-14 h-14 text-neutral-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 0 1 10 10v4a2 2 0 0 1-2 2h-4l-4 4-4-4H4a2 2 0 0 1-2-2v-4A10 10 0 0 1 12 2z" />
            <path d="m14 8-4 4" />
            <path d="m10 8 4 4" />
            {/* Custom little wings and stripes */}
            <ellipse cx="12" cy="11" rx="4" ry="2" fill="currentColor" opacity="0.15" />
            <line x1="9" y1="11" x2="15" y2="11" stroke="black" strokeWidth="2" />
            <line x1="9.5" y1="13" x2="14.5" y2="13" stroke="black" strokeWidth="2" />
          </svg>
        </div>
      </motion.div>

      {/* Brand Title */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="text-center"
      >
        <h1 className="text-4xl font-extrabold tracking-tight font-sans">
          {appName === 'BeeChat' ? (
            <>
              Bee<span className="text-amber-400">Chat</span>
            </>
          ) : (
            appName
          )}
        </h1>
        <p className="text-neutral-400 text-sm mt-2 max-w-xs font-medium tracking-wide">
          Sarang Obrolan Terenkripsi & Pintar
        </p>
      </motion.div>

      {/* Animated Honeycomb Drippings or Dots */}
      <div className="absolute bottom-16 flex flex-col items-center">
        {/* Custom Progress Bar with Hexagon indicator */}
        <div className="w-48 h-1 bg-neutral-800 rounded-full overflow-hidden mb-3 relative">
          <motion.div
            initial={{ left: '-100%' }}
            animate={{ left: '100%' }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-amber-400 to-transparent"
          />
        </div>
        
        <p className="text-neutral-500 text-xs font-mono tracking-widest uppercase">
          Menghubungkan ke Sarang{dots}
        </p>
      </div>

      {/* Version Indicator */}
      <div className="absolute bottom-6 text-neutral-600 text-xs font-mono">
        v{appVersion} • Terenkripsi End-to-End
      </div>
    </div>
  );
}
