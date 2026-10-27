require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());
const reactBuildCandidates = [
  path.join(__dirname, "..", "client", "dist"),
  path.join(__dirname, "client", "dist"),
  path.join(__dirname, "public")
];
const reactBuild = reactBuildCandidates.find(p => require("fs").existsSync(p)) || path.join(__dirname, "public");
app.use(express.static(reactBuild));

// Password Hashing Helpers
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    if (!stored || !stored.includes(":")) return false;
    const [salt, key] = stored.split(":");
    if (!salt || !key) return false;
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    const keyBuf = Buffer.from(key, "hex");
    const hashBuf = Buffer.from(hash, "hex");
    if (keyBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, hashBuf);
  } catch (e) {
    console.error("verifyPassword error:", e);
    return false;
  }
}

// User Schema (Stored in MongoDB "users" collection)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  phone: { type: String, default: "" },
  vehicleNumber: { type: String, default: "" }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

// Parking Slot Schema (Stored in MongoDB "slots" collection)
const slotSchema = new mongoose.Schema({
  slotNumber: { type: String, required: true, unique: true },
  vehicleType: { type: String, enum: ["Car", "Bike", "EV"], default: "Car" },
  status: { type: String, enum: ["Available", "Occupied"], default: "Available" },
  vehicleNumber: { type: String, default: "" },
  ownerName: { type: String, default: "" },
  bookedAt: { type: Date, default: null }
}, { timestamps: true });

const Slot = mongoose.model("Slot", slotSchema);

// Seed Initial Data
async function seedData() {
  // Seed Slots
  const slotCount = await Slot.countDocuments();
  if (!slotCount) {
    const seed = [];
    for (let i = 1; i <= 12; i++) {
      seed.push({
        slotNumber: `P-${String(i).padStart(2, "0")}`,
        vehicleType: i % 4 === 0 ? "EV" : (i % 3 === 0 ? "Bike" : "Car")
      });
    }
    await Slot.insertMany(seed);
    console.log("Seeded 12 parking slots in MongoDB Compass (collection: slots)");
  }

  // Seed Users
  const userCount = await User.countDocuments();
  if (!userCount) {
    await User.insertMany([
      {
        name: "Admin User",
        email: "admin@flexipark.com",
        password: hashPassword("admin123"),
        role: "admin",
        phone: "+91 98765 43210",
        vehicleNumber: "MH 31 AB 1234"
      },
      {
        name: "Alex Sharma",
        email: "alex@flexipark.com",
        password: hashPassword("user123"),
        role: "user",
        phone: "+91 91234 56789",
        vehicleNumber: "DL 01 CD 5678"
      }
    ]);
    console.log("Seeded default users in MongoDB Compass (collection: users)");
  }
}

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    dbName: mongoose.connection.name
  });
});

// Authentication Endpoints
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone, vehicleNumber } = req.body;
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }
    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      password: hashPassword(password),
      role: "user",
      phone: phone?.trim() || "",
      vehicleNumber: vehicleNumber?.trim().toUpperCase() || ""
    });
    await newUser.save();
    res.status(201).json({
      message: "Account created successfully!",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        vehicleNumber: newUser.vehicleNumber
      }
    });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    res.json({
      message: "Login successful!",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        vehicleNumber: user.vehicleNumber
      }
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ message: "Login failed." });
  }
});

app.get("/api/auth/users", async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: "Could not fetch users." });
  }
});

// Parking Slot Endpoints
app.get("/api/slots", async (req, res) => {
  try {
    const slots = await Slot.find().sort({ slotNumber: 1 });
    res.json(slots);
  } catch (e) {
    res.status(500).json({ message: "Could not load parking slots." });
  }
});

app.post("/api/slots/:id/book", async (req, res) => {
  try {
    const { ownerName, vehicleNumber } = req.body;
    if (!ownerName?.trim() || !vehicleNumber?.trim()) {
      return res.status(400).json({ message: "Enter owner name and vehicle number." });
    }
    const slot = await Slot.findById(req.params.id);
    if (!slot) return res.status(404).json({ message: "Parking slot not found." });
    if (slot.status === "Occupied") return res.status(409).json({ message: "This slot is already occupied." });
    slot.status = "Occupied";
    slot.ownerName = ownerName.trim();
    slot.vehicleNumber = vehicleNumber.trim().toUpperCase();
    slot.bookedAt = new Date();
    await slot.save();
    res.json(slot);
  } catch (e) {
    res.status(500).json({ message: "Booking failed." });
  }
});

app.post("/api/slots/:id/release", async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.id);
    if (!slot) return res.status(404).json({ message: "Parking slot not found." });
    slot.status = "Available";
    slot.ownerName = "";
    slot.vehicleNumber = "";
    slot.bookedAt = null;
    await slot.save();
    res.json(slot);
  } catch (e) {
    res.status(500).json({ message: "Could not release slot." });
  }
});

// Catch-all route to serve the Single Page Application
app.get("*", (req, res) => {
  const fs = require("fs");
  const candidates = [
    path.join(__dirname, "..", "client", "dist", "index.html"),
    path.join(__dirname, "client", "dist", "index.html"),
    path.join(__dirname, "public", "index.html")
  ];
  const targetIndex = candidates.find(p => fs.existsSync(p)) || path.join(__dirname, "public", "index.html");
  res.sendFile(targetIndex);
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/flexi_parking";

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB:", mongoose.connection.name);
    await seedData();
    app.listen(PORT, () => console.log(`FLEXI Parking running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("MongoDB connection failed. Check that MongoDB Server is running and MONGODB_URI is correct.");
    console.error(err.message);
    process.exit(1);
  });
