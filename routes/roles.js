import express from "express";
import {
    getRoleList,
    createRole,
    updateRole,
    deleteRole,
} from "../controllers/roleController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getRoleList);
router.post("/", authenticate, authorize("admin"), createRole);
router.put("/:id", authenticate, authorize("admin"), updateRole);
router.delete("/:id", authenticate, authorize("admin"), deleteRole);

export default router;



