import { pool } from "./db.js";
import { sendEvent } from "../kafka/producer.js";

export const LeaderboardRepo = {
  async updateLeaderboard(username, result) {
    try {
      if (result === "win") {
        await pool.query(
          `INSERT INTO leaderboard (username, wins, losses)
           VALUES ($1, 1, 0)
           ON CONFLICT (username)
           DO UPDATE SET wins = leaderboard.wins + 1;`,
          [username]
        );
      } else if (result === "loss") {
        await pool.query(
          `INSERT INTO leaderboard (username, wins, losses)
           VALUES ($1, 0, 1)
           ON CONFLICT (username)
           DO UPDATE SET losses = leaderboard.losses + 1;`,
          [username]
        );
      }

      //Emit Kafka leaderboard event
      await sendEvent({
        type: "leaderboard_update",
        username,
        result,
        timestamp: new Date().toISOString(),
      });
      console.log(`[Kafka] Leaderboard update event sent for ${username}`);
    } catch (err) {
      console.error("[LeaderboardRepo] Error:", err.message);
    }
  },

  async getLeaderboard(limit = 10) {
    try {
      const result = await pool.query(`SELECT username, wins, losses FROM leaderboard ORDER BY wins DESC LIMIT $1;`, [limit]);
      return result.rows;
    } 
    catch (err) {
      console.error("[LeaderboardRepo.getLeaderboard] Error:", err.message);
      return [];
    }
  },
};
