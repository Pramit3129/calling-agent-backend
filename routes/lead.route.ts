import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { LeadController } from '../controllers/lead.controller';

const router = express.Router();

router.use(authMiddleware);

router.post("/bulk", LeadController.bulkCreateLeads);
router.put("/:phoneNumber", LeadController.updateLead);
router.delete("/:phoneNumber", LeadController.deleteLead);
router.get("/", LeadController.getLeads);

export default router;
