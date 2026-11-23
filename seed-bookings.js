
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
      .sort({ createdAt: -1 })
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

    const documents = [];

    for (const [index, service] of serviceList.entries()) {
      const technician = await users.findOne({
        email: service.technicianEmail,
      });

      documents.push({
        serviceId: service._id.toString(),
        serviceTitle: service.title,
        serviceImage: service.image || "",
        category: service.category,
        basePrice: Number(service.basePrice),
        technicianName:
          service.technicianName ||
          technician?.name ||
          "FixMate Technician",
        technicianEmail: service.technicianEmail,
        customerName: customer.name || "",
        customerEmail: customer.email,
        customerPhone: "01700000000",
        address: "Dhanmondi, Dhaka",
        preferredDate: new Date(
          now.getTime() + (index + 3) * 24 * 60 * 60 * 1000
        ),
        problemDescription: `Sample booking request for ${service.title}`,
        status: statuses[index],
        paymentStatus: "unpaid",
        finalAmount:
          statuses[index] === "completed"
            ? Number(service.basePrice) + 300
            : null,
        createdAt: now,
        seedTag,
      });
    }

    // Remove only previous demo bookings created by this seed script
    await bookings.deleteMany({ seedTag });

    const result = await bookings.insertMany(documents);

    console.log(`${result.insertedCount} sample bookings inserted successfully.`);
  } catch (error) {
    console.error("Booking seed error:", error);
  } finally {
    await client.close();
  }
}

runSeed();
