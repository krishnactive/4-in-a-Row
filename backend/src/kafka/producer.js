import kafka from "./kafkaClient.js";

const TOPIC = process.env.KAFKA_TOPIC || "game-events";
const producer = kafka.producer();
let connected = false;

export async function startProducer() {
  if (connected) return;
  try {
    await producer.connect();
    connected = true;
    console.log("Kafka producer connected");
  } catch (err) {
    console.error("Kafka producer connection error:", err.message);
  }
}

export async function sendEvent(event) {
  try {
    if (!connected) await startProducer();

    const message = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    const key =
      event.gameId !== undefined && event.gameId !== null
        ? String(event.gameId)
        : null;

    await producer.send({
      topic: TOPIC,
      messages: [{ key, value: JSON.stringify(message) }],
    });

    console.log(`Kafka event sent: ${event.type || "unknown"}`);
  } catch (err) {
    console.error("Kafka sendEvent error:", err.message);
  }
}

export async function stopProducer() {
  if (!connected) return;
  try {
    await producer.disconnect();
    connected = false;
    console.log("Kafka producer disconnected");
  } catch (err) {
    console.error("Kafka producer disconnection error:", err.message);
  }
}
