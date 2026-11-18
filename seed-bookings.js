
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);
const seedTag = "fixmate-assignment-demo";

async function runSeed() {
  try {
    await client.connect();

    const db = client.db(process.env.DB_NAME);
    const users = db.collection("user");
    const services = db.collection("services");
    const bookings = db.collection("bookings");

    const alreadySeeded = await bookings.findOne({ seedTag });

    if (alreadySeeded) {
      console.log("Sample bookings already exist. No duplicates inserted.");
      return;
    }

    const customer = await users.findOne({
      email: "customer@gmail.com",
    });

    if (!customer) {
      throw new Error("Customer account not found.");
    }

    const serviceList = await services
      .find({
        approvalStatus: "approved",
        isAvailable: true,
      })
      .limit(5)
      .toArray();

    if (serviceList.length < 5) {
      throw new Error("At least 5 approved services are required.");
    }

    const statuses = [
      "requested",
      "accepted",
      "in-progress",
      "completed",
      "rejected",
    ];

    const now = new Date();

    const documents = serviceList.map((service, index) => ({
      serviceId: service._id,
      serviceTitle: service.title,
      technicianEmail: service.technicianEmail,
      customerEmail: customer.email,
      customerName: customer.name,
      phone: "01700000000",
      address: "Dhanmondi, Dhaka",
      preferredDate: new Date(
        now.getTime() + (index + 3) * 24 * 60 * 60 * 1000
      ),
      problemDescription: `Sample booking for ${service.title}`,
      status: statuses[index],
      paymentStatus: "unpaid",
      finalAmount:
        statuses[index] === "completed"
          ? Number(service.basePrice) + 300
          : null,
      createdAt: now,
      seedTag,
    }));

    const result = await bookings.insertMany(documents);

    console.log(`${result.insertedCount} sample bookings inserted.`);
  } catch (error) {
    console.error("Booking seed error:", error);
  } finally {
    await client.close();
  }
}

runSeed();
