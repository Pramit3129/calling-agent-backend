import mongoose from "mongoose";

const leadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, index: true },
    phoneNumber: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
    address: { type: String },
    type: { type: String, enum: ['buyer', 'seller'], required: true }
});

export const Lead = mongoose.model("Lead", leadSchema);
