import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User, Room, Booking } from "./models.js";
import { authenticate, allowRoles } from "./middleware.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 60 }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "staywise-api" }));

const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(100) });
const roomSchema = z.object({
  number: z.string().trim().min(1).max(12),
  type: z.enum(["Standard", "Deluxe", "Suite", "Family"]),
  floor: z.coerce.number().int().min(0).max(100),
  capacity: z.coerce.number().int().min(1).max(12),
  pricePerNight: z.coerce.number().min(0).max(10000000),
  status: z.enum(["available", "maintenance"]).default("available"),
  amenities: z.array(z.string().trim().max(40)).max(15).default([]),
  description: z.string().max(500).default("")
});
const bookingSchema = z.object({
  guestName: z.string().trim().min(2).max(100),
  guestEmail: z.string().email().max(254),
  guestPhone: z.string().max(30).optional().default(""),
  roomId: z.string().regex(/^[a-f\d]{24}$/i),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guests: z.coerce.number().int().min(1).max(12),
  notes: z.string().max(500).optional().default("")
});
const issueToken = user => jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
const publicUser = user => ({ id: user._id, name: user.name, email: user.email, role: user.role });

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Enter a valid email and password (at least 8 characters)." });
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash)))
      return res.status(401).json({ message: "Email or password is incorrect." });
    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (e) { next(e); }
});
app.get("/api/auth/me", authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

app.get("/api/rooms", authenticate, async (_req, res, next) => {
  try { res.json(await Room.find().sort({ number: 1 })); } catch (e) { next(e); }
});
app.post("/api/rooms", authenticate, allowRoles("admin", "staff"), async (req, res, next) => {
  try {
    const p = roomSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.issues[0]?.message || "Invalid room details." });
    res.status(201).json(await Room.create(p.data));
  } catch (e) { next(e); }
});
app.put("/api/rooms/:id", authenticate, allowRoles("admin", "staff"), async (req, res, next) => {
  try {
    const p = roomSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.issues[0]?.message || "Invalid room details." });
    const room = await Room.findByIdAndUpdate(req.params.id, p.data, { new: true, runValidators: true });
    if (!room) return res.status(404).json({ message: "Room not found." });
    res.json(room);
  } catch (e) { next(e); }
});
app.delete("/api/rooms/:id", authenticate, allowRoles("admin"), async (req, res, next) => {
  try {
    const active = await Booking.exists({ room: req.params.id, status: { $in: ["confirmed", "checked-in"] }, checkOut: { $gt: new Date() } });
    if (active) return res.status(409).json({ message: "This room has an active booking and cannot be deleted." });
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found." });
    res.json({ message: "Room deleted." });
  } catch (e) { next(e); }
});

app.get("/api/bookings", authenticate, async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status && ["confirmed", "checked-in", "checked-out", "cancelled"].includes(status)) filter.status = status;
    if (search) filter.$or = [
      { guestName: { $regex: String(search).slice(0, 80), $options: "i" } },
      { guestEmail: { $regex: String(search).slice(0, 80), $options: "i" } }
    ];
    const bookings = await Booking.find(filter).populate("room", "number type pricePerNight").sort({ createdAt: -1 }).limit(200);
    res.json(bookings);
  } catch (e) { next(e); }
});
app.post("/api/bookings", authenticate, async (req, res, next) => {
  try {
    const p = bookingSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ message: p.error.issues[0]?.message || "Invalid booking details." });
    const d = p.data, start = new Date(d.checkIn), end = new Date(d.checkOut);
    if (start < new Date(new Date().setHours(0,0,0,0))) return res.status(400).json({ message: "Check-in cannot be in the past." });
    if (end <= start) return res.status(400).json({ message: "Check-out must be after check-in." });
    const room = await Room.findById(d.roomId);
    if (!room) return res.status(404).json({ message: "Room not found." });
    if (room.status !== "available") return res.status(409).json({ message: "This room is under maintenance." });
    if (d.guests > room.capacity) return res.status(400).json({ message: `This room accommodates up to ${room.capacity} guests.` });
    const conflict = await Booking.exists({
      room: room._id, status: { $in: ["confirmed", "checked-in"] },
      checkIn: { $lt: end }, checkOut: { $gt: start }
    });
    if (conflict) return res.status(409).json({ message: "This room is already booked for those dates." });
    const nights = Math.ceil((end - start) / 86400000);
    const booking = await Booking.create({
      guestName: d.guestName, guestEmail: d.guestEmail, guestPhone: d.guestPhone,
      room: room._id, checkIn: start, checkOut: end, guests: d.guests,
      totalAmount: nights * room.pricePerNight, notes: d.notes, createdBy: req.user._id
    });
    res.status(201).json(await booking.populate("room", "number type pricePerNight"));
  } catch (e) { next(e); }
});
app.patch("/api/bookings/:id/status", authenticate, async (req, res, next) => {
  try {
    const allowed = ["confirmed", "checked-in", "checked-out", "cancelled"];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ message: "Invalid booking status." });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    const transitions = {
      confirmed: ["checked-in", "cancelled"],
      "checked-in": ["checked-out"],
      "checked-out": [],
      cancelled: []
    };
    if (!transitions[booking.status].includes(req.body.status))
      return res.status(409).json({ message: `Cannot change ${booking.status} to ${req.body.status}.` });
    booking.status = req.body.status;
    await booking.save();
    res.json(await booking.populate("room", "number type pricePerNight"));
  } catch (e) { next(e); }
});

app.get("/api/dashboard", authenticate, async (_req, res, next) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const [rooms, activeRooms, arrivals, departures, bookings, revenueRows] = await Promise.all([
      Room.countDocuments(), Room.countDocuments({ status: "available" }),
      Booking.countDocuments({ checkIn: { $gte: today, $lt: tomorrow }, status: "confirmed" }),
      Booking.countDocuments({ checkOut: { $gte: today, $lt: tomorrow }, status: "checked-in" }),
      Booking.find().populate("room", "number type").sort({ createdAt: -1 }).limit(6),
      Booking.aggregate([{ $match: { status: { $in: ["confirmed", "checked-in", "checked-out"] }, createdAt: { $gte: new Date(today.getFullYear(), today.getMonth(), 1) } } }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }])
    ]);
    const occupied = await Booking.distinct("room", { status: "checked-in" });
    res.json({ metrics: { rooms, availableRooms: activeRooms, occupiedRooms: occupied.length, occupancyRate: rooms ? Math.round(occupied.length / rooms * 100) : 0, arrivals, departures, monthlyRevenue: revenueRows[0]?.total || 0 }, recentBookings: bookings });
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === 11000) return res.status(409).json({ message: "That room number or email already exists." });
  if (err?.name === "CastError") return res.status(400).json({ message: "Invalid identifier." });
  res.status(500).json({ message: "Something went wrong. Please try again." });
});

const port = process.env.PORT || 5000;
if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
  console.error("Missing MONGODB_URI or JWT_SECRET. Copy .env.example to .env and configure it.");
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);
app.listen(port, () => console.log(`StayWise API listening on port ${port}`));
