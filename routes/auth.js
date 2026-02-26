import express from "express";
import {
    register,
    driverRegister,
    login,
    forgetPassword,
    socialLogin,
    submitOtp,
    resendOtp,
    logout,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/driver-register", driverRegister);
router.post("/login", login);
router.post("/forget-password", forgetPassword);
router.post("/social-login", socialLogin);
router.post("/resend-otp", resendOtp);
router.post("/submit-otp", authenticate, submitOtp);
router.post("/logout", authenticate, logout);

export default router;


