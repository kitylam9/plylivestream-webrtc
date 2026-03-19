import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { Play, Square, Folder, Settings, Activity, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [folderPath, setFolderPath] = useState('/tmp'); // Default path
  const [fps, setFps] = useState(30);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const [currentFrame, setCurrentFrame] = useState('');
  const [stats, setStats] = useState({ frames: 0, lastFrameTime: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const loader = new PLYLoader();

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, []);

  // Socket and WebRTC Setup
  useEffect(() => {
    const newSocket = io({
      transports: ['websocket'],
      upgrade: false
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setStatus('Connected to Signaling Server');
    });

    newSocket.on('signal', (data) => {
      if (peer) peer.signal(data);
    });

    newSocket.on('ply-frame', (frame: { data: string, name: string }) => {
      // If we are the receiver, we render the frame
      if (!isBroadcaster) {
        renderPly(frame.data);
        setCurrentFrame(frame.name);
        setStats(prev => ({ ...prev, frames: prev.frames + 1 }));
      }
    });

    newSocket.on('error', (msg) => {
      alert(`Error: ${msg}`);
      setIsStreaming(false);
    });

    return () => {
      newSocket.close();
    };
  }, [isBroadcaster, peer]);

  const initPeer = (initiator: boolean) => {
    const newPeer = new Peer({
      initiator,
      trickle: false,
    });

    newPeer.on('signal', (data) => {
      socket?.emit('signal', data);
    });

    newPeer.on('connect', () => {
      setStatus('WebRTC Connected');
    });

    newPeer.on('data', (data) => {
      // Receive PLY data over WebRTC
      const base64 = data.toString();
      renderPly(base64);
      setStats(prev => ({ ...prev, frames: prev.frames + 1 }));
    });

    setPeer(newPeer);
  };

  const renderPly = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const geometry = loader.parse(bytes.buffer);
    
    if (pointsRef.current) {
      sceneRef.current?.remove(pointsRef.current);
      pointsRef.current.geometry.dispose();
    }

    const material = new THREE.PointsMaterial({ 
      size: 0.01, 
      vertexColors: geometry.hasAttribute('color') 
    });
    const points = new THREE.Points(geometry, material);
    
    // Center the points
    geometry.computeBoundingSphere();
    const center = geometry.boundingSphere?.center;
    if (center) {
        points.position.sub(center);
    }

    sceneRef.current?.add(points);
    pointsRef.current = points;
  };

  // Handle incoming socket frames and forward to peer if we are broadcaster
  useEffect(() => {
    if (!socket) return;

    const handleFrame = (frame: { data: string, name: string }) => {
      if (isBroadcaster) {
        // Forward to WebRTC peer if connected
        if (peer && peer.connected) {
          peer.send(frame.data);
        }
        // Also render locally for preview
        renderPly(frame.data);
        setCurrentFrame(frame.name);
        setStats(prev => ({ ...prev, frames: prev.frames + 1 }));
      } else {
        // If we are receiver and not using WebRTC yet, fallback to socket
        if (!peer || !peer.connected) {
          renderPly(frame.data);
          setCurrentFrame(frame.name);
          setStats(prev => ({ ...prev, frames: prev.frames + 1 }));
        }
      }
    };

    socket.on('ply-frame', handleFrame);
    return () => {
      socket.off('ply-frame', handleFrame);
    };
  }, [socket, isBroadcaster, peer]);

  const startStreaming = () => {
    if (!socket) return;
    setIsStreaming(true);
    // When starting as broadcaster, we might want to initiate WebRTC
    if (isBroadcaster && !peer) {
      initPeer(true);
    }
    socket.emit('start-stream', { folderPath, fps });
  };

  const stopStreaming = () => {
    if (!socket) return;
    setIsStreaming(false);
    socket.emit('stop-stream');
  };

  // Auto-init peer for receiver if broadcaster signals
  useEffect(() => {
    if (!socket) return;
    socket.on('signal', () => {
      if (!isBroadcaster && !peer) {
        initPeer(false);
      }
    });
  }, [socket, isBroadcaster, peer]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
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
            {!isBroadcaster && !peer?.connected && (
              <button 
                onClick={() => initPeer(false)}
                className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-all"
              >
                CONNECT TO STREAM
              </button>
            )}
            <button 
              onClick={() => setIsBroadcaster(!isBroadcaster)}
              className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${isBroadcaster ? 'bg-emerald-500 border-emerald-400 text-black' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
            >
              {isBroadcaster ? 'MODE: SERVER' : 'MODE: CLIENT'}
            </button>
          </motion.div>
        </div>

        {/* Controls Panel */}
        <div className="flex justify-center pointer-events-auto">
          <AnimatePresence mode="wait">
            {isBroadcaster && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
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
            )}
          </AnimatePresence>
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
    </div>
  );
}
