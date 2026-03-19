import React from 'react';
import { motion } from 'motion/react';
import { Activity, Cpu } from 'lucide-react';
import { StreamProvider, useStream } from '../components/StreamProvider';

const ClientUI = () => {
  const { status, stats, currentFrame, peer, initPeer } = useStream();

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
            POINT CLOUD STREAMER
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${status.includes('Connected') ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <p className="text-xs text-white/60 uppercase tracking-widest font-medium">{status}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex gap-2"
        >
          {!peer?.connected && (
            <button 
              onClick={() => initPeer(false)}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-all"
            >
              CONNECT TO STREAM
            </button>
          )}
        </motion.div>
      </div>

      {/* Stats Bar */}
      <div className="flex justify-between items-end pointer-events-auto">
        <div className="flex gap-4">
          <div className="bg-black/40 backdrop-blur-sm border border-white/5 p-3 rounded-xl">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Frames Received</p>
            <p className="text-xl font-mono font-medium">{stats.frames.toLocaleString()}</p>
          </div>
          {currentFrame && (
            <div className="bg-black/40 backdrop-blur-sm border border-white/5 p-3 rounded-xl">
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Current File</p>
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

export default function ClientPage() {
  return (
    <StreamProvider isBroadcaster={false}>
      <ClientUI />
    </StreamProvider>
  );
}
