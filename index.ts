import express from "express";
import Retell from "retell-sdk";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import { Lead } from "./models/Lead.js";
import { Call } from "./models/Call.js";

dotenv.config();

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/call-genie";
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const RETELL_API_KEY = process.env.RETELL_API_KEY;
if (!RETELL_API_KEY) throw new Error("RETELL_API_KEY is not set");

const AGENT_ID = process.env.AGENT_ID;
if (!AGENT_ID) throw new Error("AGENT_ID is not set");

const retellClient = new Retell({ apiKey: RETELL_API_KEY });


/**
 * POST /call-lead
 */
app.post("/call-lead", async (req, res) => {
  try {
    const { name, email, phoneNumber, subject } = req.body;
    if (!name || !email || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "name, email, and phoneNumber are required",
      });
    }

    // 1. Create or Update Lead
    let lead = await Lead.findOne({ email });
    if (!lead) {
      lead = new Lead({ name, email, phoneNumber });
      await lead.save();
    } else {
      // Update phone/name if changed? For now just use existing lead
      lead.name = name;
      lead.phoneNumber = phoneNumber;
      await lead.save();
    }

    const phoneCallResponse = await retellClient.call.createPhoneCall({
      from_number: "+14385331002",
      to_number: phoneNumber,
      override_agent_id: AGENT_ID,
      retell_llm_dynamic_variables: {
        name,
        email,
        phone_number: phoneNumber,
        subject: subject ?? "",
      },
    });

    // 2. Create Call Record
    try {
      const newCall = new Call({
        callId: phoneCallResponse.call_id,
        leadId: lead._id,
        status: 'registered',
      });
      console.log("New call record:", newCall);
      await newCall.save();
    } catch (error) {
      console.error("Failed to create call record:", error);
    }

    console.log("Phone call response:", phoneCallResponse);

    return res.status(200).json({
      success: true,
      message: "Call initiated successfully",
      data: phoneCallResponse,
    });
  } catch (error) {
    console.error("Retell call error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to initiate call",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /leads
 * Fetch all leads with their latest calls
 */
app.get("/leads", async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 }).lean();

    // For each lead, fetch their calls
    const leadsWithCalls = await Promise.all(leads.map(async (lead) => {
      const calls = await Call.find({ leadId: lead._id }).sort({ createdAt: -1 });
      return { ...lead, calls };
    }));

    return res.status(200).json({
      success: true,
      data: leadsWithCalls,
    });
  } catch (error) {
    console.error("Fetch leads error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch leads" });
  }
});

/**
 * GET /call/:callId
 * Fetch call details from Retell and update DB
 */
app.get("/call/:callId", async (req, res) => {
  try {
    const { callId } = req.params;
    if (!callId) {
      return res.status(400).json({
        success: false,
        message: "callId is required",
      });
    }

    const callRecordData = await Call.findOne({ callId });
    if (callRecordData && callRecordData.analysis) {
      console.log("Call record data found in DB:", callRecordData.callId);

      // Map DB fields to match Retell SDK response structure expected by frontend
      const mappedData = {
        call_id: callRecordData.callId,
        call_status: callRecordData.status,
        call_analysis: callRecordData.analysis,
        transcript: callRecordData.transcript,
        duration_ms: callRecordData.durationMs,
        from_number: callRecordData.fromNumber,
        to_number: callRecordData.toNumber,
        call_cost: {
          combined_cost: callRecordData.cost
        },
        recording_url: callRecordData.recordingUrl
      };

      return res.status(200).json({
        success: true,
        data: mappedData,
      });
    }
    // 1. Fetch from Retell
    const callResponse = await retellClient.call.retrieve(callId);

    // 2. Update DB
    const callRecord = await Call.findOne({ callId });
    if (callRecord) {
      callRecord.status = callResponse.call_status;
      callRecord.analysis = callResponse.call_analysis;
      callRecord.transcript = callResponse.transcript;
      callRecord.recordingUrl = callResponse.recording_url;
      callRecord.durationMs = callResponse.duration_ms;
      callRecord.cost = callResponse.call_cost?.combined_cost;

      if (callResponse.call_type === 'phone_call') {
        callRecord.fromNumber = callResponse.from_number;
        callRecord.toNumber = callResponse.to_number;
      }

      await callRecord.save();
    }

    return res.status(200).json({
      success: true,
      data: callResponse,
    });
  } catch (error) {
    console.error("Fetch call error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch call details" });
  }
});

// ... (batch call endpoint)

/**
 * POST /create-batch-call
 * Body:
 * {
 *   "from_number": "+14157774444",
 *   "numbers": ["+12137774445", "+15556667777"],
 *   "name": "Optional Name",
 *   "trigger_timestamp": 1234567890
 * }
 */
app.post("/create-batch-call", async (req, res) => {
  const from_number = "+14385331002";
  try {
    const { leads, trigger_timestamp } = req.body;

    if (!from_number || !leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "from_number and leads (non-empty array) are required",
      });
    }

    // 1. Process Leads (Save/Update in DB)
    const tasks = [];
    for (const leadData of leads) {
      const { name, email, phoneNumber } = leadData;

      if (!phoneNumber) continue; // Skip invalid leads

      let lead = await Lead.findOne({ phoneNumber });
      if (!lead) {
        lead = new Lead({ name, email, phoneNumber });
        await lead.save();
      } else {
        lead.name = name || lead.name;
        lead.phoneNumber = phoneNumber;
        await lead.save();
      }

      tasks.push({
        to_number: phoneNumber,
        override_agent_id: AGENT_ID,
        retell_llm_dynamic_variables: {
          name,
          email,
          phone_number: phoneNumber,
        }
      });
    }

    if (tasks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid leads provided",
      });
    }

    const batchCallResponse = await retellClient.batchCall.createBatchCall({
      from_number,
      tasks,
      trigger_timestamp,
    });

    return res.status(201).json({
      success: true,
      message: "Batch call created successfully",
      data: batchCallResponse,
    });
  } catch (error) {
    console.error("Retell batch call error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create batch call",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`📞 Retell Call API running on port ${PORT}`);
});



// async function debugGetCall() {
//   try {
//     const callId = "call_a1ea162588da0e46014485d54aa";

//     const callResponse = await retellClient.call.retrieve(callId);

//     console.log("===== CALL META =====");
//     console.log({
//       call_id: callResponse.call_id,
//       status: callResponse.call_status,
//       duration_ms: callResponse.duration_ms,
//       from: callResponse.call_type === 'phone_call' ? callResponse.from_number : undefined,
//       to: callResponse.call_type === 'phone_call' ? callResponse.to_number : undefined,
//     });

//     console.log("\n===== COLLECTED DYNAMIC VARIABLES =====");
//     console.log(callResponse.collected_dynamic_variables);

//     console.log("\n===== CALL ANALYSIS =====");
//     console.log(callResponse.call_analysis);

//     console.log("\n===== TRANSCRIPT =====");
//     console.log(callResponse.transcript);

//   } catch (error) {
//     console.error("Failed to retrieve call:", error);
//   }
// }

// call it explicitly
// debugGetCall();

// Phone call response: {
//   call_id: "call_a2ff263e57ad4d711fa8cd2bbc9",
//   call_type: "phone_call",
//   agent_id: "agent_79e638ba5680f8e8863983a4e6",
//   agent_version: 4,
//   agent_name: "Single-Prompt Agent",
//   retell_llm_dynamic_variables: {
//     name: "Pramit Manna",
//     email: "pramitmanna19@gmail.com",
//     phone_number: "+918777562720",
//     subject: "condo",
//   },
//   custom_sip_headers: {},
//   call_status: "registered",
//   latency: {},
//   call_cost: {
//     product_costs: [],
//     total_duration_seconds: 0,
//     total_duration_unit_price: 0,
//     combined_cost: 0,
//   },
//   data_storage_setting: "everything",
//   opt_in_signed_url: false,
//   from_number: "+14385331002",
//   to_number: "+918777562720",
//   direction: "outbound",
// }
