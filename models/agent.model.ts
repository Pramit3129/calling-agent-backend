import mongoose from "mongoose";

const agentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    retellAgentId: {
        type: String,
        required: true,
    }
});

export const agentModel = mongoose.model("AgentModel", agentSchema);