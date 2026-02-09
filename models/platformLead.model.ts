import mongoose from "mongoose";

const platformLeadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    trialLeft: { type: Number, default: 5 },
});

platformLeadSchema.index({ email: 1, phoneNumber: 1 }, { unique: true });

export const PlatformLead = mongoose.model("PlatformLead", platformLeadSchema);