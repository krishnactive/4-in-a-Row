import express from "express";
import { LeaderboardRepo } from "../persistence/leaderboardRepo.js";
import { GameRepo } from "../persistence/gamesRepo.js";

const router = express.Router();

router.get("/games", async (req, res) => {
  try {
    const games = await GameRepo.getRecentGames(10);
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/leaderboard", async (req, res) => {
  try {
    const leaderboard = await LeaderboardRepo.getTopPlayers(10);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
