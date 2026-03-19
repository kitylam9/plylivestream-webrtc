import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';

interface StreamContextType {
  socket: Socket | null;
  peer: Peer.Instance | null;
  status: string;
  currentFrame: string;
  stats: { frames: number; lastFrameTime: number };
  isBroadcaster: boolean;
  isStreaming: boolean;
  folderPath: string;
  fps: number;
  setFolderPath: (path: string) => void;
  setFps: (fps: number) => void;
  startStreaming: () => void;
  stopStreaming: () => void;
  initPeer: (initiator: boolean) => void;
}

const StreamContext = createContext<StreamContextType | null>(null);

export const useStream = () => {
  const context = useContext(StreamContext);
  if (!context) throw new Error('useStream must be used within a StreamProvider');
  return context;
};

export const StreamProvider: React.FC<{ children: React.ReactNode; isBroadcaster: boolean }> = ({ children, isBroadcaster }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const [folderPath, setFolderPath] = useState('/tmp');
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
    
    geometry.computeBoundingSphere();
    const center = geometry.boundingSphere?.center;
    if (center) {
        points.position.sub(center);
    }

    sceneRef.current?.add(points);
    pointsRef.current = points;
  };

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
      const base64 = data.toString();
      renderPly(base64);
      setStats(prev => ({ ...prev, frames: prev.frames + 1 }));
    });

    setPeer(newPeer);
  };

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
      if (isBroadcaster) {
        if (peer && peer.connected) {
          peer.send(frame.data);
        }
        renderPly(frame.data);
        setCurrentFrame(frame.name);
        setStats(prev => ({ ...prev, frames: prev.frames + 1 }));
      } else {
        if (!peer || !peer.connected) {
          renderPly(frame.data);
          setCurrentFrame(frame.name);
          setStats(prev => ({ ...prev, frames: prev.frames + 1 }));
        }
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

  // Auto-init peer for receiver if broadcaster signals
  useEffect(() => {
    if (!socket) return;
    const handleSignal = () => {
      if (!isBroadcaster && !peer) {
        initPeer(false);
      }
    };
    socket.on('signal', handleSignal);
    return () => {
      socket.off('signal', handleSignal);
    };
  }, [socket, isBroadcaster, peer]);

  const startStreaming = () => {
    if (!socket) return;
    setIsStreaming(true);
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

  return (
    <StreamContext.Provider value={{
      socket, peer, status, currentFrame, stats, isBroadcaster, isStreaming,
      folderPath, fps, setFolderPath, setFps, startStreaming, stopStreaming, initPeer
    }}>
      <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
        <div ref={containerRef} className="absolute inset-0 z-0" />
        <div className="absolute inset-0 z-10 pointer-events-none">
          {children}
        </div>
      </div>
    </StreamContext.Provider>
  );
};
