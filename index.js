
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
  collections.authUsers = db.collection("authUsers");
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

// Create booking
app.post("/api/bookings", verifyToken, async (req, res) => {
  try {
    const {
      serviceId,
      phone,
      address,
      preferredDate,
      problemDescription,
    } = req.body;

    if (
      !serviceId ||
      !phone?.trim() ||
      !address?.trim() ||
      !preferredDate ||
      !problemDescription?.trim()
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (!ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        message: "Invalid service ID",
      });
    }

    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can book services",
      });
    }

    const date = new Date(preferredDate);

    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).json({
        message: "Please select a valid future date",
      });
    }

    const service = await collections.services.findOne({
      _id: new ObjectId(serviceId),
      approvalStatus: "approved",
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found or unavailable",
      });
    }

    if (service.technicianEmail === req.user.email) {
      return res.status(403).json({
        message: "You cannot book your own service",
      });
    }

    const existingBooking = await collections.bookings.findOne({
      serviceId: new ObjectId(serviceId),
      customerEmail: req.user.email,
      status: { $in: ["requested", "accepted", "in-progress"] },
    });

    if (existingBooking) {
      return res.status(409).json({
        message: "You already have an active booking for this service",
      });
    }

    const booking = {
      serviceId: new ObjectId(serviceId),
      serviceTitle: service.title,
      technicianEmail: service.technicianEmail,
      customerEmail: req.user.email,
      customerName: req.user.name,
      phone: phone.trim(),
      address: address.trim(),
      preferredDate: date,
      problemDescription: problemDescription.trim(),
      status: "requested",
      paymentStatus: "unpaid",
      finalAmount: null,
      createdAt: new Date(),
    };

    const result = await collections.bookings.insertOne(booking);

    res.status(201).json({
      message: "Booking request submitted successfully",
      bookingId: result.insertedId,
    });
  } catch (err) {
    console.error("Booking creation error:", err);

    res.status(500).json({
      message: "Failed to create booking",
    });
  }
});


// Get logged-in customer's bookings
app.get("/api/bookings/my-bookings", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can view their bookings",
      });
    }

    const bookings = await collections.bookings
      .find({ customerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(bookings);
  } catch (err) {
    console.error("Fetch bookings error:", err);

    res.status(500).json({
      message: "Failed to fetch bookings",
    });
  }
});


// Cancel customer's booking
app.patch("/api/bookings/:id/cancel", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can cancel bookings",
      });
    }

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

    const result = await collections.bookings.updateOne(
      {
        _id: new ObjectId(id),
        customerEmail: req.user.email,
        status: "requested",
      },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Booking not found or cannot be cancelled",
      });
    }

    res.json({
      message: "Booking cancelled successfully",
    });
  } catch (err) {
    console.error("Cancel booking error:", err);

    res.status(500).json({
      message: "Failed to cancel booking",
    });
  }
});


// Get technician's booking requests
app.get("/api/technician/requests", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        message: "Only technicians can view booking requests",
      });
    }

    const requests = await collections.bookings
      .find({ technicianEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(requests);
  } catch (err) {
    console.error("Fetch technician requests error:", err);

    res.status(500).json({
      message: "Failed to fetch booking requests",
    });
  }
});


app.patch("/api/technician/requests/:id/status", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        message: "Only technicians can update booking status",
      });
    }

    const { id } = req.params;
    const { status, finalAmount } = req.body;

    const allowedStatuses = [
      "accepted",
      "rejected",
      "in-progress",
      "completed",
    ];

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid booking status",
      });
    }

    const booking = await collections.bookings.findOne({
      _id: new ObjectId(id),
      technicianEmail: req.user.email,
    });

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    const allowedTransitions = {
      requested: ["accepted", "rejected"],
      accepted: ["in-progress"],
      "in-progress": ["completed"],
    };

    if (!allowedTransitions[booking.status]?.includes(status)) {
      return res.status(400).json({
        message: "This status change is not allowed",
      });
    }

    const updateData = {
      status,
      updatedAt: new Date(),
    };

    if (status === "completed") {
      const amount = Number(finalAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          message: "A valid final amount is required",
        });
      }

      updateData.finalAmount = amount;
      updateData.completedAt = new Date();
    }

  const result = await collections.bookings.updateOne(
  {
    _id: new ObjectId(id),
    technicianEmail: req.user.email,
    status: booking.status,
  },
  { $set: updateData }
);

if (result.matchedCount === 0) {
  return res.status(409).json({
    message: "Booking status has changed. Please refresh and try again.",
  });
}

res.json({
  message: "Booking status updated successfully",
});

    
  } catch (err) {
    console.error("Update booking status error:", err);

    res.status(500).json({
      message: "Failed to update booking status",
    });
  }
});


app.get("/api/technician/my-services", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        message: "Only technicians can view their services",
      });
    }

    const services = await collections.services
      .find({ technicianEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(services);
  } catch (err) {
    console.error("Fetch technician services error:", err);

    res.status(500).json({
      message: "Failed to fetch your services",
    });
  }
});


app.post("/api/technician/services", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        message: "Only technicians can add services",
      });
    }

    const {
      title,
      category,
      description,
      basePrice,
      serviceMode,
    } = req.body;

    if (
      !title?.trim() ||
      !category?.trim() ||
      !description?.trim() ||
      !serviceMode?.trim() ||
      basePrice === undefined
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const price = Number(basePrice);

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        message: "Please provide a valid base price",
      });
    }

    const newService = {
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      basePrice: price,
      serviceMode: serviceMode.trim(),
      technicianEmail: req.user.email,
      approvalStatus: "pending",
      isAvailable: true,
      createdAt: new Date(),
    };

    const result = await collections.services.insertOne(newService);

    res.status(201).json({
      message: "Service submitted for admin approval",
      serviceId: result.insertedId,
    });
  } catch (err) {
    console.error("Add service error:", err);

    res.status(500).json({
      message: "Failed to add service",
    });
  }
});


app.patch("/api/technician/services/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        message: "Only technicians can edit services",
      });
    }

    const { id } = req.params;
    const {
      title,
      category,
      description,
      basePrice,
      serviceMode,
    } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid service ID",
      });
    }

    const price = Number(basePrice);

    if (
      !title?.trim() ||
      !category?.trim() ||
      !description?.trim() ||
      !serviceMode?.trim() ||
      basePrice === undefined ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return res.status(400).json({
        message: "Please provide valid service information",
      });
    }

    const result = await collections.services.updateOne(
      {
        _id: new ObjectId(id),
        technicianEmail: req.user.email,
      },
      {
        $set: {
          title: title.trim(),
          category: category.trim(),
          description: description.trim(),
          basePrice: price,
          serviceMode: serviceMode.trim(),
          approvalStatus: "pending",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    res.json({
      message: "Service updated and submitted for approval",
    });
  } catch (err) {
    console.error("Edit service error:", err);

    res.status(500).json({
      message: "Failed to update service",
    });
  }
});


app.delete("/api/technician/services/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        message: "Only technicians can delete services",
      });
    }

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid service ID",
      });
    }

    const service = await collections.services.findOne({
      _id: new ObjectId(id),
      technicianEmail: req.user.email,
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    const activeBooking = await collections.bookings.findOne({
      serviceId: new ObjectId(id),
      status: { $in: ["requested", "accepted", "in-progress"] },
    });

    if (activeBooking) {
      return res.status(409).json({
        message: "Cannot delete a service with active bookings",
      });
    }

    await collections.services.deleteOne({
      _id: new ObjectId(id),
      technicianEmail: req.user.email,
    });

    res.json({
      message: "Service deleted successfully",
    });
  } catch (err) {
    console.error("Delete service error:", err);

    res.status(500).json({
      message: "Failed to delete service",
    });
  }
});

// Admin: Get all users
app.get("/api/admin/users", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view users",
      });
    }

    const users = await collections.authUsers
      .find(
        {},
        {
          projection: {
            name: 1,
            email: 1,
            role: 1,
            image: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.json(users);
  } catch (err) {
    console.error("Admin users error:", err);

    res.status(500).json({
      message: "Failed to fetch users",
    });
  }
});


app.patch("/api/admin/users/:id/role", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can update user roles",
      });
    }

    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ["customer", "technician", "admin"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid user role",
      });
    }

    const result = await collections.authUsers.updateOne(
      { _id: id },
      {
        $set: {
          role,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      message: "User role updated successfully",
    });
  } catch (err) {
    console.error("Update user role error:", err);

    res.status(500).json({
      message: "Failed to update user role",
    });
  }
});


app.get("/api/admin/services", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view services",
      });
    }

    const services = await collections.services
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(services);
  } catch (err) {
    console.error("Admin services error:", err);

    res.status(500).json({
      message: "Failed to fetch services",
    });
  }
});


app.patch("/api/admin/services/:id/status", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can update service status",
      });
    }

    const { id } = req.params;
    const { approvalStatus } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid service ID",
      });
    }

    if (!["approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({
        message: "Invalid approval status",
      });
    }

    const result = await collections.services.updateOne(
      {
        _id: new ObjectId(id),
        approvalStatus: "pending",
      },
      {
        $set: {
          approvalStatus,
          reviewedAt: new Date(),
          reviewedBy: req.user.email,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Pending service not found",
      });
    }

    res.json({
      message: `Service ${approvalStatus} successfully`,
    });
  } catch (err) {
    console.error("Service approval error:", err);

    res.status(500).json({
      message: "Failed to update service status",
    });
  }
});


app.get("/api/admin/bookings", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view bookings",
      });
    }

    const bookings = await collections.bookings
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(bookings);
  } catch (err) {
    console.error("Admin bookings error:", err);

    res.status(500).json({
      message: "Failed to fetch bookings",
    });
  }
});


app.get("/api/admin/transactions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view transactions",
      });
    }

    const transactions = await collections.payments
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(transactions);
  } catch (err) {
    console.error("Admin transactions error:", err);

    res.status(500).json({
      message: "Failed to fetch transactions",
    });
  }
});



connectDB()
  .then(() => {
    app.listen(port, () => console.log(`Server on ${port}`));
  })
  .catch((err) => console.error(err));
