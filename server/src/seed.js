import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Room, Booking } from "./models.js";

if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI in .env first.");
await mongoose.connect(process.env.MONGODB_URI);
const email = "admin@staywise.demo";
let admin = await User.findOne({ email });
if (!admin) admin = await User.create({
  name: "StayWise Admin", email, passwordHash: await bcrypt.hash("StaywiseDemo123!", 12), role: "admin"
});
if (await Room.countDocuments() === 0) {
  await Room.insertMany([
    { number: "101", type: "Standard", floor: 1, capacity: 2, pricePerNight: 2800, amenities: ["Wi-Fi", "Breakfast", "AC"], description: "A comfortable room for a relaxed stay." },
    { number: "102", type: "Deluxe", floor: 1, capacity: 2, pricePerNight: 4200, amenities: ["Wi-Fi", "Breakfast", "AC", "City view"], description: "Extra space with thoughtful amenities." },
    { number: "201", type: "Suite", floor: 2, capacity: 3, pricePerNight: 7800, amenities: ["Wi-Fi", "Breakfast", "Lounge", "Bathtub"], description: "A premium suite for a special stay." },
    { number: "202", type: "Family", floor: 2, capacity: 5, pricePerNight: 6200, amenities: ["Wi-Fi", "Breakfast", "AC", "Extra beds"], description: "A spacious choice for families." },
    { number: "301", type: "Deluxe", floor: 3, capacity: 2, pricePerNight: 4500, amenities: ["Wi-Fi", "Breakfast", "Balcony"], description: "Bright room with a private balcony." },
    { number: "302", type: "Standard", floor: 3, capacity: 2, pricePerNight: 2600, status: "maintenance", amenities: ["Wi-Fi", "AC"], description: "Currently being refreshed by housekeeping." }
  ]);
}
console.log("Seed complete. Demo login: admin@staywise.demo / StaywiseDemo123!");
await mongoose.disconnect();
