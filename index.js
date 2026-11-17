
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import verifyToken from "./src/middleware/verifyToken.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
export const collections = {};

async function connectDB() {
  await client.connect();
  db = client.db(process.env.DB_NAME);

  collections.users = db.collection("users");
  collections.services = db.collection("services");
  collections.bookings = db.collection("bookings");
  collections.payments = db.collection("payments");

  console.log("MongoDB connected");
}

app.get("/", (req, res) => {
  res.send("FixMate server is running");
});

// Protected JWT test route
app.get("/api/test-auth", verifyToken, (req, res) => {
  res.json({
    message: "JWT verified successfully",
    user: req.user,
  });
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Get approved and available services
app.get("/api/services", async (req, res) => {
  try {
    const { search, category, serviceMode, sort, limit } = req.query;

    const query = {
      approvalStatus: "approved",
      isAvailable: true,
    };

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query.$or = [{ title: regex }, { category: regex }];
    }

    if (category) query.category = category;
    if (serviceMode) query.serviceMode = serviceMode;

    const sortOptions = {
      "price-asc": { basePrice: 1 },
      "price-desc": { basePrice: -1 },
      newest: { createdAt: -1 },
    };

    let cursor = collections.services
      .find(query)
      .sort(sortOptions[sort] || sortOptions.newest);

    const n = parseInt(limit);
    if (n > 0) cursor = cursor.limit(n);

    res.json(await cursor.toArray());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch services" });
  }
});

// Get single service
app.get("/api/services/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Service not found" });
    }

    const service = await collections.services.findOne({
      _id: new ObjectId(req.params.id),
      approvalStatus: "approved",
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json(service);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch service" });
  }
});

connectDB()
  .then(() => {
    app.listen(port, () => console.log(`Server on ${port}`));
  })
  .catch((err) => console.error(err));
