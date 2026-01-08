import mongoose from 'mongoose';

const batchCallSchema = new mongoose.Schema({
    realtorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },
    expected_calls: { type: Number, required: true },
    calls_done: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "completed"], default: "pending" },
    leadIds: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead"
        }],
        default: []
    }
})

export const BatchCallModel = mongoose.model("BatchCall", batchCallSchema);