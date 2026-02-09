import mongoose from "mongoose";

const platformLeadSchema = new mongoose.Schema({
    name: String,
    email: String,
    phoneNumber: String,
    createdAt: { type: Date, default: Date.now },
});

export const PlatformLead = mongoose.model("PlatformLead", platformLeadSchema);