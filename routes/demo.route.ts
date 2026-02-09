import { Router } from "express";
import { RetellService } from "../services/retell.services";
import { getCanadaDateContext } from "../utils/dateTime";
import { PlatformLead } from '../models/platformLead.model'
import { rateLimit } from "express-rate-limit";

const router = Router();

const limiter = rateLimit({
    windowMs: 120 * 60 * 1000,
    limit: 6,
    message: "Too many calls from this IP, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
});

router.post("/createCall", limiter, async (req, res) => {
    try {
        const { name, email, toNumber, fromNumber, retellAgentId } = req.body;
        if (!name || !email || !toNumber || !fromNumber || !retellAgentId) {
            return res.status(400).json({
                success: false,
                message: "name, email, toNumber, fromNumber, and retellAgentId are required",
            });
        }
        const updatedLead = await PlatformLead.findOneAndUpdate(
            { email, phoneNumber: toNumber, trialLeft: { $gt: 0 } },
            { $inc: { trialLeft: -1 } },
            { new: true }
        );

        if (updatedLead) {
            console.log("Lead already exists");
        } else {
            const existingLead = await PlatformLead.findOne({ email, phoneNumber: toNumber });
            if (existingLead) {
                return res.status(400).json({
                    success: false,
                    message: "Trial limit reached, Please contact us for more usage",
                });
            } else {
                try {
                    const newLeadForPlatform = new PlatformLead({ name, email, phoneNumber: toNumber, trialLeft: 5 });
                    await newLeadForPlatform.save();
                } catch (error: any) {
                    if (error.code === 11000) {
                        const retryUpdate = await PlatformLead.findOneAndUpdate(
                            { email, phoneNumber: toNumber, trialLeft: { $gt: 0 } },
                            { $inc: { trialLeft: -1 } },
                            { new: true }
                        );
                        if (!retryUpdate) {
                            const checkLead = await PlatformLead.findOne({ email, phoneNumber: toNumber });
                            if (checkLead && checkLead.trialLeft === 0) {
                                return res.status(400).json({
                                    success: false,
                                    message: "Trial limit reached, Please contact us for more usage",
                                });
                            }
                        }
                    } else {
                        throw error;
                    }
                }
            }
        }
        let phoneCallResponse;
        const dateContext = getCanadaDateContext();
        try {
            const dynamicVariables: any = {
                name,
                email,
                phone_number: toNumber,
                today_day: dateContext.today_day,
                today_date: dateContext.today_date,
                today_iso: dateContext.today_iso,
                timezone: dateContext.timezone,
            };
            phoneCallResponse = await RetellService.createPhoneCall({
                from_number: fromNumber,
                to_number: toNumber,
                override_agent_id: retellAgentId,
                retell_llm_dynamic_variables: dynamicVariables,
            });
            res.status(200).json({ success: true, message: "Call initiated successfully", data: phoneCallResponse });
        } catch (error) {
            console.error("Retell API error:", error);
            return res.status(500).json({ success: false, message: "Failed to initiate call with Retell" });
        }
    } catch (error) {
        console.error("Error creating call:", error);
        res.status(500).json({ success: false, message: "Failed to create call" });
    }
});

export default router;