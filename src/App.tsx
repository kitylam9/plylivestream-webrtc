import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClientPage from './pages/ClientPage';
import ServerPage from './pages/ServerPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientPage />} />
        <Route path="/streamer-admin" element={<ServerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

