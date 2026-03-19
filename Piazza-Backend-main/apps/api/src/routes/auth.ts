import { Router } from 'express';
import { authController } from '../controllers/authController';
import { verifyJWT } from '../middleware/verifyJWT';

const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-otp', authController.resendOtp);

// Protected routes
router.post('/logout', verifyJWT, authController.logout);
router.get('/me', verifyJWT, authController.me);

export default router;