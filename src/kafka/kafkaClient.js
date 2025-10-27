import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  clientId: "fourinarow-backend",
  brokers: ["localhost:9092"], //same as your docker-compose setup
});

export const kafkaProducer = kafka.producer();
export const kafkaConsumer = kafka.consumer({ groupId: "analytics-group" });

export const connectKafka = async () => {
  try {
    await kafkaProducer.connect();
    console.log("Kafka Producer connected");
  } catch (err) {
    console.error("Kafka connection failed:", err.message);
  }
};
