import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Lead } from "../models/Lead";
import { Call } from "../models/Call";

export class LeadController {
    static async bulkCreateLeads(req: Request, res: Response) {
        try {
            const { leads } = req.body;
            if (!leads || !Array.isArray(leads) || leads.length === 0) {
                return res.status(400).json({ success: false, message: "leads array is required" });
            }

            const user = req.user as any;
            const operations = leads.map(lead => ({
                updateOne: {
                    filter: { phoneNumber: lead.phoneNumber, userId: user._id },
                    update: { $set: { name: lead.name, email: lead.email, phoneNumber: lead.phoneNumber, userId: user._id } },
                    upsert: true
                }
            }));

            const result = await Lead.bulkWrite(operations);

            return res.status(200).json({
                success: true,
                message: `Successfully saved ${result.upsertedCount + result.modifiedCount} leads`,
                data: result
            });
        } catch (error) {
            console.error("Bulk save leads error:", error);
            return res.status(500).json({ success: false, message: "Failed to save leads" });
        }
    }

    static async deleteLead(req: Request, res: Response) {
        try {
            const user = req.user as any;
            const { phoneNumber } = req.params; // This param name is defined in route, but we can treat it as idOrPhone

            if (!phoneNumber) {
                return res.status(400).json({ success: false, message: "Phone number or ID is required" });
            }

            let query: any = { userId: user._id };
            if (mongoose.Types.ObjectId.isValid(phoneNumber)) {
                query._id = phoneNumber;
            } else {
                query.phoneNumber = phoneNumber;
            }

            const result = await Lead.deleteOne(query);

            if (result.deletedCount === 0) {
                return res.status(404).json({ success: false, message: "Lead not found" });
            }

            return res.status(200).json({ success: true, message: "Lead deleted successfully" });
        } catch (error) {
            console.error("Delete lead error:", error);
            return res.status(500).json({ success: false, message: "Failed to delete lead" });
        }
    }

    static async updateLead(req: Request, res: Response) {
        try {
            const user = req.user as any;
            const { phoneNumber } = req.params;
            if (!phoneNumber) {
                return res.status(400).json({ success: false, message: "Phone number or ID is required" });
            }
            const { name, email, address, phoneNumber: newPhoneNumber } = req.body;

            console.log(`[updateLead] Params phoneNumber: '${phoneNumber}'`);
            console.log(`[updateLead] Body:`, req.body);

            const updateData: any = { name, email, address };
            if (newPhoneNumber) {
                updateData.phoneNumber = newPhoneNumber;
            }

            let query: any = { userId: user._id };
            if (mongoose.Types.ObjectId.isValid(phoneNumber)) {
                query._id = phoneNumber;
            } else {
                query.phoneNumber = phoneNumber;
            }

            console.log(`[updateLead] Query:`, JSON.stringify(query));

            const lead = await Lead.findOneAndUpdate(
                query,
                { $set: updateData },
                { new: true }
            );

            if (!lead) {
                console.log(`[updateLead] Lead not found for query:`, JSON.stringify(query));

                // Debug: Check if lead exists at all
                const leadExists = await Lead.findOne({ phoneNumber: query.phoneNumber || query._id });
                if (leadExists) {
                    console.log(`[updateLead] Lead EXISTS but mismatch. Lead User: ${leadExists.userId}, Request User: ${user._id}`);
                } else {
                    console.log(`[updateLead] Lead does NOT exist in DB.`);
                }

                return res.status(404).json({ success: false, message: "Lead not found" });
            }

            return res.status(200).json({ success: true, message: "Lead updated successfully", data: lead });
        } catch (error) {
            console.error("Update lead error:", error);
            return res.status(500).json({ success: false, message: "Failed to update lead" });
        }
    }

    static async getLeads(req: Request, res: Response) {
        try {
            const user = req.user as any;
            if (!user || !user._id) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
            const leads = await Lead.find({ userId: user._id }).sort({ createdAt: -1 }).lean();

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
    }
}
