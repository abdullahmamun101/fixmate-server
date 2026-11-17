import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

let db;
export const collections = {};

async function connectDB() {
  await client.connect();
  db = client.db(process.env.DB_NAME);
  collections.users = db.collection("user");
  collections.services = db.collection("services");
  collections.bookings = db.collection("bookings");
  collections.payments = db.collection("payments");
  console.log("MongoDB connected");
}

app.get("/", (req, res) => res.send("FixMate server is running"));

connectDB()
  .then(() => app.listen(port, () => console.log(`Server on ${port}`)))
  .catch((err) => console.error(err));