
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);

const seedServices = [
  {
    title: "Professional AC Installation",
    category: "AC Repair",
    description: "Professional air conditioner installation service.",
    basePrice: 2500,
    estimatedDuration: "2 hours",
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1000",
  },
  {
    title: "AC Deep Cleaning",
    category: "AC Repair",
    description: "Complete AC cleaning and maintenance service.",
    basePrice: 1500,
    estimatedDuration: "1.5 hours",
    image: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Emergency Plumbing Service",
    category: "Plumbing",
    description: "Professional pipe leakage and plumbing repair.",
    basePrice: 1200,
    estimatedDuration: "2 hours",
    image: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Electrical Wiring Service",
    category: "Electrical",
    description: "Safe electrical wiring and troubleshooting.",
    basePrice: 1800,
    estimatedDuration: "3 hours",
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Home Deep Cleaning",
    category: "Cleaning",
    description: "Complete home cleaning service.",
    basePrice: 3000,
    estimatedDuration: "4 hours",
    image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Interior Wall Painting",
    category: "Painting",
    description: "Professional interior wall painting service.",
    basePrice: 5000,
    estimatedDuration: "1 day",
    image: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Furniture Repair",
    category: "Carpentry",
    description: "Furniture repair and maintenance service.",
    basePrice: 1500,
    estimatedDuration: "2 hours",
    image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Refrigerator Repair",
    category: "Appliance Repair",
    description: "Refrigerator diagnosis and repair service.",
    basePrice: 2000,
    estimatedDuration: "2 hours",
    image: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Washing Machine Repair",
    category: "Appliance Repair",
    description: "Washing machine troubleshooting and repair.",
    basePrice: 1800,
    estimatedDuration: "2 hours",
    image: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Water Tank Cleaning",
    category: "Cleaning",
    description: "Professional water tank cleaning service.",
    basePrice: 2200,
    estimatedDuration: "3 hours",
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Home Electrical Maintenance",
    category: "Electrical",
    description: "Home electrical inspection and maintenance.",
    basePrice: 1600,
    estimatedDuration: "2 hours",
    image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1000&q=80",
  },
];

async function runSeed() {
  try {
    await client.connect();

    const db = client.db(process.env.DB_NAME);
    const servicesCollection = db.collection("services");

    const now = new Date();

    for (const [index, service] of seedServices.entries()) {
      const existingService = await servicesCollection.findOne({
        title: service.title,
        category: service.category,
      });

      if (existingService) {
        await servicesCollection.updateOne(
          { _id: existingService._id },
          { $set: { image: service.image } }
        );

        console.log(`Image updated: ${service.title}`);
      } else {
        await servicesCollection.insertOne({
          ...service,
          serviceMode: "both",
          serviceArea: "Dhaka",
          technicianEmail:
            index % 2 === 0
              ? "technician@gmail.com"
              : "test@gmail.com",
          approvalStatus: "approved",
          isAvailable: true,
          createdAt: now,
          updatedAt: now,
          approvedBy: "admin@gmail.com",
        });

        console.log(`New service inserted: ${service.title}`);
      }
    }

    console.log("All service images processed successfully.");
  } catch (error) {
    console.error("Seed error:", error);
  } finally {
    await client.close();
  }
}

runSeed();

