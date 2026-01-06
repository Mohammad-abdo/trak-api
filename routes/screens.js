import express from "express";
import {
    getScreenList,
    createScreen,
    updateScreen,
    deleteScreen,
} from "../controllers/screenController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getScreenList);
router.post("/", authenticate, authorize("admin"), createScreen);
router.put("/:id", authenticate, authorize("admin"), updateScreen);
router.delete("/:id", authenticate, authorize("admin"), deleteScreen);

export default router;



