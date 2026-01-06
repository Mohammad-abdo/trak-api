import express from "express";
import {
    getComplaintCommentList,
    saveComplaintComment,
    updateComplaintComment,
} from "../controllers/complaintCommentController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/complaintcomment-list", authenticate, getComplaintCommentList);
router.post("/save-complaintcomment", authenticate, saveComplaintComment);
router.post("/update-complaintcomment/:id", authenticate, updateComplaintComment);

export default router;



