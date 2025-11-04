# 🎯 4 in a Row — Real-Time Multiplayer Game

A full-stack **real-time multiplayer game** (Connect Four) built using **Node.js, React, Socket.IO, PostgreSQL, Docker, and Kafka (Redpanda)**.  
This project demonstrates scalable backend design, real-time gameplay, persistent storage, and **decoupled analytics** using Kafka.
[video]([Walk through](https://drive.google.com/drive/folders/1RYeSsKLxrTvxqEzirGYcl7YOklkHpHYn?usp=sharing))

---

## 🌍 Deployment

| Layer | Platform | URL |
|-------|-----------|-----|
| **Frontend** | Vercel | [https://4-in-a-row-lovat.vercel.app/](https://4-in-a-row-lovat.vercel.app/) |
| **Backend API** | Render | [https://four-in-a-row-x2y5.onrender.com](https://four-in-a-row-x2y5.onrender.com) |
| **Database** | Neon PostgreSQL | Cloud hosted |
| **Kafka** | Redpanda Cloud | SASL_SSL secured |

---

## 🧠 Overview

**4 in a Row** lets two players (or a player vs bot) compete in real-time.  
If no player joins within 10 seconds, a **competitive AI bot** steps in.  
The system supports **reconnections**, **leaderboard tracking**, and **Kafka-powered analytics**.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React + Vite + Socket.IO Client |
| Backend | Node.js + Express + Socket.IO |
| Database | PostgreSQL (Neon) |
| Realtime | WebSockets (Socket.IO) |
| Analytics | Kafka (via Redpanda Cloud) |
| Containerization | Docker + Docker Compose |

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repository

```bash
git clone https://github.com/krishnactive/4-in-a-row.git
cd 4-in-a-row
```

### 2️⃣ Configure Environment

Create `.env` in `/backend`:

```env
# Server Configuration
PORT=5000

# PostgreSQL (Neon)
DATABASE_URL=postgresql://<username>:<password>@<neon-host>/<database>?sslmode=require

# Kafka (Redpanda Cloud)
KAFKA_BROKER=<your-redpanda-broker-host>:9092
KAFKA_TOPIC=game-events
KAFKA_CLIENT_ID=fourinarow-backend
KAFKA_ANALYTICS_CLIENT_ID=fourinarow-analytics

# Authentication (Set these in your deployment environment)
KAFKA_USERNAME=<your-kafka-username>
KAFKA_PASSWORD=<your-kafka-password>
KAFKA_SASL_MECHANISM=SCRAM-SHA-256
KAFKA_SECURITY_PROTOCOL=SASL_SSL

```
Create `.env` in `/frontend`:
```
VITE_BACKEND_URL=http://localhost:5000
```

### 3️⃣ Start Services via Docker

```bash
cd backend
docker compose up -d
```

This starts **Kafka (Redpanda)** and **Zookeeper** locally.

### 4️⃣ Run Backend

```bash
npm install
npm run dev
```

### 5️⃣ Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend → http://localhost:5173  
Backend → http://localhost:5000

---

## 🧩 Architecture Overview

```
React (Frontend)
   ↓ WebSocket
Node.js Backend (Socket.IO + Express)
   ↓
PostgreSQL ←→ Kafka Producer → Redpanda Cloud Topic → Kafka Consumer (Analytics)
```

### 🔹 Flow Summary

1. Players join matchmaking with usernames.  
2. Matched players (or bot) begin game.  
3. Moves sync instantly via Socket.IO.  
4. Completed games → stored in PostgreSQL.  
5. Kafka producer logs game events.  
6. Kafka consumer aggregates analytics.

---

## 🧠 Key Features

✅ Real-time multiplayer gameplay  
✅ Competitive bot fallback (10s timeout)  
✅ Persistent leaderboard (PostgreSQL)  
✅ 30s player reconnection window  
✅ Kafka analytics tracking  
✅ Rematch & session management  
✅ Dockerized local setup  

---

## 📡 API Endpoints

### **GET /api/leaderboard**
Fetches leaderboard sorted by wins.

```json
[
  { "username": "Krishna", "wins": 8, "losses": 3 },
  { "username": "KK", "wins": 5, "losses": 4 }
]
```

### **GET /api/games/recent**
Fetches recently completed games.

```json
[
  {
    "id": 1,
    "player1": "Krishna",
    "player2": "Bot",
    "winner": "Krishna",
    "status": "finished",
    "duration_seconds": 32,
    "total_moves": 17
  }
]
```

### **GET /api/analytics**
Returns real-time metrics consumed from Kafka.

```json
{
  "totalGames": 120,
  "avgDuration": 43,
  "topWinners": { "Krishna": 10, "Aman": 8 },
  "gamesPerHour": { "14": 15, "15": 12 }
}
```

---

## 🧩 Backend File Descriptions

| File | Purpose |
|------|----------|
| `/src/game/gameManager.js` | Core game logic (start, move, win/draw, reconnect, Kafka event emission) |
| `/src/game/sessionManager.js` | Tracks player sessions and reconnect status |
| `/src/matchmaking/matchmaking.js` | Handles matchmaking and bot fallback |
| `/src/socket/socketServer.js` | Socket.IO setup and event routing |
| `/src/persistence/gamesRepo.js` | Saves completed games to DB |
| `/src/persistence/leaderboardRepo.js` | Manages wins/losses leaderboard |
| `/src/kafka/producer.js` | Kafka producer for emitting events |
| `/src/kafka/analyticsService.js` | Kafka consumer for analytics aggregation |
| `/src/persistence/db.js` | PostgreSQL pool connection |

---

## 🧠 Kafka Analytics (Redpanda Cloud)

### Producer Events
- `game_started`
- `move_made`
- `game_over`
- `leaderboard_update`

### Consumer Analytics
- Total games
- Average game duration
- Frequent winners
- Games per hour
- Per-user win/loss stats

Example console output:

```
=== Real-time Game Analytics ===
Total Games: 4
Average Duration: 39s
Top Winners: { Krishna: 2, Aman: 1 }
Games per Hour: { 18: 3, 19: 1 }
User Stats: { Krishna: { wins: 2 }, Aman: { wins: 1 } }
```

---

## 🧰 Future Enhancements

- Deploy backend via **AWS or Render autoscaling**
- Add **JWT Authentication**
- Expose analytics via REST API
- Build **match history UI**
- Upgrade bot logic

---

## 🏁 Conclusion

This project demonstrates a **production-level real-time system** integrating:

✅ WebSockets (Socket.IO)  
✅ Event-driven Kafka analytics  
✅ Persistent PostgreSQL storage  
✅ Reactive frontend (React + Vite)  
✅ Cloud-deployed architecture (Vercel + Render + Neon + Redpanda)

A complete demonstration of scalable backend architecture, distributed event systems, and real-time multiplayer synchronization — built with production-ready technologies.
