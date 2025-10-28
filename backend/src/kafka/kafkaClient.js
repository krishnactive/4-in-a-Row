import { Kafka } from "kafkajs";
import dotenv from "dotenv";
dotenv.config();

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || "fourinarow-backend",
  brokers: (process.env.KAFKA_BROKER || "localhost:9092").split(","),
  ssl: true,
  sasl: {
    mechanism: process.env.KAFKA_SASL_MECHANISM || "SCRAM-SHA-256",
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
});

export default kafka;
