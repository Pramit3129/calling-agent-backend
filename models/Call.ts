import mongoose from "mongoose";

const callSchema = new mongoose.Schema({
    callId: { type: String, required: true, unique: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    status: { type: String, required: true },
    analysis: { type: mongoose.Schema.Types.Mixed }, // Store the full analysis JSON
    transcript: { type: String },
    recordingUrl: { type: String },
    durationMs: { type: Number },
    cost: { type: Number }, // Combined cost
    fromNumber: { type: String },
    toNumber: { type: String },
    createdAt: { type: Date, default: Date.now },
});

export const Call = mongoose.model("Call", callSchema);
