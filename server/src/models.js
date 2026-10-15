import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "staff"], default: "staff" }
}, { timestamps: true });

const roomSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, trim: true },
  type: { type: String, enum: ["Standard", "Deluxe", "Suite", "Family"], required: true },
  floor: { type: Number, min: 0, max: 100, default: 1 },
  capacity: { type: Number, min: 1, max: 12, required: true },
  pricePerNight: { type: Number, min: 0, required: true },
  status: { type: String, enum: ["available", "maintenance"], default: "available" },
  amenities: [{ type: String, trim: true }],
  description: { type: String, maxlength: 500, default: "" }
}, { timestamps: true });

const bookingSchema = new mongoose.Schema({
  guestName: { type: String, required: true, trim: true, maxlength: 100 },
  guestEmail: { type: String, required: true, trim: true, lowercase: true },
  guestPhone: { type: String, trim: true, maxlength: 30, default: "" },
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  guests: { type: Number, min: 1, max: 12, default: 1 },
  totalAmount: { type: Number, min: 0, required: true },
  status: { type: String, enum: ["confirmed", "checked-in", "checked-out", "cancelled"], default: "confirmed" },
  notes: { type: String, maxlength: 500, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1, status: 1 });
export const User = mongoose.model("User", userSchema);
export const Room = mongoose.model("Room", roomSchema);
export const Booking = mongoose.model("Booking", bookingSchema);
