import mongoose from "mongoose";

const leadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

export const Lead = mongoose.model("Lead", leadSchema);
