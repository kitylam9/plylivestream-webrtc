import express from "express";
import cors from "cors";
import { createServer as createHttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  app.use(cors({
    origin: true,
    credentials: true
  }));
  const httpServer = createHttpServer(app);
  const io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow all origins, including null/undefined
        callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true
    },
    allowEIO3: true
  });

  const PORT = 3000;

  // WebRTC Signaling
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("signal", (data) => {
      socket.broadcast.emit("signal", data);
    });

    socket.on("start-stream", async ({ folderPath, fps }) => {
      console.log(`Starting stream from ${folderPath} at ${fps} FPS`);
      
      try {
        if (!fs.existsSync(folderPath)) {
            socket.emit("error", "Folder does not exist");
            return;
        }

        const files = fs.readdirSync(folderPath)
          .filter(f => f.endsWith(".ply"))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        if (files.length === 0) {
          socket.emit("error", "No PLY files found in folder");
          return;
        }

        let currentIndex = 0;
        const interval = setInterval(() => {
          const filePath = path.join(folderPath, files[currentIndex]);
          const data = fs.readFileSync(filePath);
          
          socket.emit("ply-frame", {
            name: files[currentIndex],
            data: data.toString("base64"),
            index: currentIndex,
            total: files.length
          });

          currentIndex = (currentIndex + 1) % files.length;
        }, 1000 / fps);

        socket.on("stop-stream", () => {
          clearInterval(interval);
        });

        socket.on("disconnect", () => {
          clearInterval(interval);
        });

      } catch (err) {
        socket.emit("error", (err as Error).message);
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        cors: true // Enable CORS in Vite
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
