import kafka from "./kafkaClient.js";
import { AnalyticsRepo } from "../persistence/analyticsRepo.js";

const TOPIC = process.env.KAFKA_TOPIC || "game-events";
const consumer = kafka.consumer({ groupId: "analytics-group" });

const metrics = {
  totalGames: 0,
  totalDuration: 0,
  gamesPerHour: {},
  winners: {},
  userStats: {},
};

function getHourKey(timestamp) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:00`;
}

function processEvent(event) {
  const { type } = event;

  switch (type) {
    case "game_started":
      console.log(`Game started: ${event.gameId} (${event.players.join(" vs ")})`);
      break;

    case "move_made":
      console.log(`Move made by ${event.player} in game ${event.gameId}`);
      break;

    case "game_saved":
      metrics.totalGames += 1;
      metrics.totalDuration += event.duration_seconds || 0;

      const hourKey = getHourKey(event.timestamp);
      metrics.gamesPerHour[hourKey] = (metrics.gamesPerHour[hourKey] || 0) + 1;

      if (event.winner && event.winner !== "Draw" && event.winner !== "Bot") {
        metrics.winners[event.winner] = (metrics.winners[event.winner] || 0) + 1;
      }

      console.log(
        `Game saved: ${event.player1} vs ${event.player2} | Winner: ${event.winner}`
      );
      break;

    case "leaderboard_update":
      if (!metrics.userStats[event.username]) {
        metrics.userStats[event.username] = { wins: 0, losses: 0 };
      }
      if (event.result === "win") metrics.userStats[event.username].wins++;
      if (event.result === "loss") metrics.userStats[event.username].losses++;

      console.log(`Leaderboard update: ${event.username} -> ${event.result}`);
      break;

    case "game_over":
      console.log(`Game over: ${event.players.join(" vs ")} | Winner: ${event.winner}`);
      break;

    default:
      console.log(`Unhandled event: ${type}`);
  }

  printLiveStats();

  if (metrics.totalGames % 5 === 0) {
    saveAnalyticsSnapshot();
  }
}

function printLiveStats() {
  const avgDuration =
    metrics.totalGames > 0
      ? (metrics.totalDuration / metrics.totalGames).toFixed(2)
      : 0;

  console.clear();
  console.log("=== Real-time Game Analytics ===");
  console.log(`Total Games: ${metrics.totalGames}`);
  console.log(`Average Duration: ${avgDuration}s`);
  console.log("Most Frequent Winners:", metrics.winners);
  console.log("Games per Hour:", metrics.gamesPerHour);
  console.log("User Stats:", metrics.userStats);
  console.log("=================================");
}

async function saveAnalyticsSnapshot() {
  const avgDuration =
    metrics.totalGames > 0
      ? (metrics.totalDuration / metrics.totalGames).toFixed(2)
      : 0;

  const snapshot = {
    totalGames: metrics.totalGames,
    avgDuration: Number(avgDuration),
    mostFrequentWinners: metrics.winners,
    gamesPerHour: metrics.gamesPerHour,
    userStats: metrics.userStats,
  };

  await AnalyticsRepo.saveSnapshot(snapshot);
  console.log("Analytics snapshot saved.");
}

export async function startAnalyticsService() {
  try {
    await consumer.connect();
    console.log("Kafka Analytics Service connected");

    await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value.toString());
          processEvent(event);
        } catch (err) {
          console.error("Error parsing Kafka message:", err.message);
        }
      },
    });
  } catch (err) {
    console.error("Kafka Analytics Service error:", err.message);
  }
}

startAnalyticsService();
