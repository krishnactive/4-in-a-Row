import { Kafka } from "kafkajs";
import dotenv from "dotenv";
dotenv.config();

const BROKERS = (process.env.KAFKA_BROKER || "localhost:9092").split(",");
const CLIENT_ID = process.env.KAFKA_CLIENT_ID || "fourinarow-backend";
const TOPIC = process.env.KAFKA_TOPIC || "game-events";

const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: BROKERS,
});

const producer = kafka.producer();
let connected = false;

export async function startProducer() {
  if (connected) return;
  try {
    await producer.connect();
    connected = true;
    console.log("Kafka producer connected");
  } catch (err) {
    console.error("Kafka producer connect error:", err?.message ?? err);
  }
}

export async function sendEvent(event) {
  try {
    if (!connected) await startProducer();
    const msg = {...event,timestamp: event.timestamp||new Date().toISOString(),};

    const key =event.gameId !== undefined && event.gameId !== null? String(event.gameId): null;

    await producer.send({
      topic: TOPIC,
      messages: [
        { key, value: JSON.stringify(msg) },
      ],
    });
  } catch (err) {
    //loging error in kafaka
    console.error("Kafka sendEvent error:", err?.message??err);
  }
}

export async function stopProducer() {
  if (!connected) return;
  try {
    await producer.disconnect();
    connected = false;
    console.log("Kafka producer disconnected");
  } catch (err) {
    console.error("Kafka stopProducer error:", err?.message ?? err);
  }
}
