import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./persistence/db.js";
import { initSocket } from "./socket/socketServer.js";
import { gameManager } from "./game/gameManager.js";

dotenv.config();

const app = express();
global.gameManager = gameManager;
app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "4-in-a-Row Backend Running!",
      dbTime: result.rows[0].now,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT username, wins, losses, draws, total_games, win_rate
      FROM leaderboard
      ORDER BY wins DESC
      LIMIT 10;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/games", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT player1, player2, winner, total_moves, duration_seconds, created_at
      FROM games
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const server = http.createServer(app);

//web socket attach
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL, 
    methods: ["GET", "POST"],
  },
});

initSocket(io);

const PORT = process.env.PORT || 8080;
server.listen(PORT, async () => {
  try {
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected successfully");
  } catch (err) {
    console.error("PostgreSQL connection failed:", err.message);
  }
  console.log(`Server running on port ${PORT}`);
});
