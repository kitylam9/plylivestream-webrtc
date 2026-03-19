import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Cpu, Play, Square, Folder } from 'lucide-react';
import { StreamProvider, useStream } from '../components/StreamProvider';

const ServerUI = () => {
  const { 
    status, stats, currentFrame, isStreaming, folderPath, fps, 
    setFolderPath, setFps, startStreaming, stopStreaming 
  } = useStream();

  return (
    <div className="flex flex-col justify-between h-full p-6">
      {/* Header */}
      <div className="flex justify-between items-start pointer-events-auto">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-2xl"
        >
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="text-emerald-400 w-5 h-5" />
            POINT CLOUD STREAMER (SERVER)
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${status.includes('Connected') ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <p className="text-xs text-white/60 uppercase tracking-widest font-medium">{status}</p>
          </div>
        </motion.div>
      </div>

      {/* Controls Panel */}
      <div className="flex justify-center pointer-events-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col gap-4 min-w-[400px]"
        >
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1 block">Sequence Folder</label>
              <div className="relative">
                <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input 
                  type="text" 
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="/path/to/ply/files"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
            </div>
            <div className="w-24">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1 block">FPS</label>
              <input 
                type="number" 
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-2">
            {!isStreaming ? (
              <button 
                onClick={startStreaming}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                START STREAM
              </button>
            ) : (
              <button 
                onClick={stopStreaming}
                className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Square className="w-4 h-4 fill-current" />
                STOP STREAM
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Stats Bar */}
      <div className="flex justify-between items-end pointer-events-auto">
        <div className="flex gap-4">
          <div className="bg-black/40 backdrop-blur-sm border border-white/5 p-3 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Frames Streamed</p>
            <p className="text-xl font-mono font-medium">{stats.frames.toLocaleString()}</p>
          </div>
          {currentFrame && (
            <div className="bg-black/40 backdrop-blur-sm border border-white/5 p-3 rounded-xl">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Streaming File</p>
              <p className="text-sm font-mono text-emerald-400 truncate max-w-[150px]">{currentFrame}</p>
            </div>
          )}
        </div>

        <div className="bg-black/40 backdrop-blur-sm border border-white/5 p-3 rounded-xl flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Engine</p>
            <p className="text-xs font-bold">THREE.JS WEBGL</p>
          </div>
          <Cpu className="w-5 h-5 text-white/20" />
        </div>
      </div>
    </div>
  );
};

export default function ServerPage() {
  return (
    <StreamProvider isBroadcaster={true}>
      <ServerUI />
    </StreamProvider>
  );
}
