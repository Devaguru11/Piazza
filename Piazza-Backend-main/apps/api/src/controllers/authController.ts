import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import redis from '../utils/redis';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/verifyJWT';
import { emailService } from '../services/emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_SESSION_TTL = parseInt(process.env.JWT_SESSION_TTL || '604800', 10);

// ── Generate a 6-digit OTP ────────────────────────────────────────────────────
function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export const authController = {

    // ── REGISTER ──────────────────────────────────────────────────────────────
    // Creates account + sends OTP email
    // Employee cannot log in until email is verified
    async register(req: Request, res: Response) {
        try {
            const { name, email, password, role, department } = req.body;

            if (!name || !email || !password) {
                return sendError(res, 'Name, email, and password are required', 400);
            }

            // Basic email format check
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return sendError(res, 'Please enter a valid email address', 400);
            }

            if (password.length < 6) {
                return sendError(res, 'Password must be at least 6 characters', 400);
            }

            const existing = await prisma.employee.findUnique({ where: { email } });
            if (existing) {
                // If already registered but not verified, resend OTP
                if (!existing.isEmailVerified) {
                    const otp = generateOtp();
                    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

                    await prisma.employee.update({
                        where: { email },
                        data: { emailOtp: otp, emailOtpExpiry: otpExpiry },
                    });

                    await emailService.sendVerificationOtp(email, existing.name, otp);

                    return sendSuccess(res, { email, requiresVerification: true },
                        'Account exists but is not verified. A new OTP has been sent to your email.', 200);
                }
                return sendError(res, 'Email already registered', 409);
            }

            const assignedRole = role || (email.toLowerCase().endsWith('@admin.com') ? 'ADMIN' : 'EMPLOYEE');
            const isSuperAdminEmail = email.toLowerCase() === 'adminsample123@admin.com';

            const passwordHash = await bcrypt.hash(password, 12);
            const otp = generateOtp();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

            const employee = await prisma.employee.create({
                data: {
                    name,
                    email,
                    passwordHash,
                    role: assignedRole,
                    department,
                    totalPoints: 0,
                    streakCount: 0,
                    level: 1,
                    isAdminApproved: assignedRole === 'ADMIN' ? isSuperAdminEmail : true,
                    isSuperAdmin: isSuperAdminEmail,
                    // Admins skip email verification — only employees need OTP
                    isEmailVerified: assignedRole === 'ADMIN' ? true : false,
                    emailOtp: assignedRole === 'ADMIN' ? null : otp,
                    emailOtpExpiry: assignedRole === 'ADMIN' ? null : otpExpiry,
                },
            });

            // Send OTP email only for employees
            if (assignedRole !== 'ADMIN') {
                await emailService.sendVerificationOtp(email, name, otp);
            }

            return sendSuccess(res, {
                id: employee.id,
                name: employee.name,
                email: employee.email,
                role: employee.role,
                requiresVerification: assignedRole !== 'ADMIN',
            }, assignedRole === 'ADMIN'
                ? 'Admin registered successfully. Await super admin approval to login.'
                : 'Registration successful! Please check your email for the verification OTP.',
                201);
        } catch (error: any) {
            console.error('Registration Error', error);
            return sendError(res, error?.message || 'Registration failed', 500);
        }
    },

    // ── VERIFY EMAIL ──────────────────────────────────────────────────────────
    // POST /auth/verify-email  body: { email, otp }
    async verifyEmail(req: Request, res: Response) {
        try {
            const { email, otp } = req.body;

            if (!email || !otp) {
                return sendError(res, 'Email and OTP are required', 400);
            }

            const employee = await prisma.employee.findUnique({ where: { email } });
            if (!employee) {
                return sendError(res, 'Account not found', 404);
            }

            if (employee.isEmailVerified) {
                return sendSuccess(res, { verified: true }, 'Email already verified. You can log in.');
            }

            if (!employee.emailOtp || !employee.emailOtpExpiry) {
                return sendError(res, 'No OTP found. Please register again or request a new OTP.', 400);
            }

            // Check expiry
            if (new Date() > employee.emailOtpExpiry) {
                return sendError(res, 'OTP has expired. Please request a new one.', 400);
            }

            // Check OTP match
            if (employee.emailOtp !== otp.toString().trim()) {
                return sendError(res, 'Invalid OTP. Please check your email and try again.', 400);
            }

            // Mark as verified and clear OTP
            await prisma.employee.update({
                where: { email },
                data: {
                    isEmailVerified: true,
                    emailOtp: null,
                    emailOtpExpiry: null,
                },
            });

            return sendSuccess(res, { verified: true },
                'Email verified successfully! You can now log in.');
        } catch (error: any) {
            return sendError(res, error.message, 500);
        }
    },

    // ── RESEND OTP ────────────────────────────────────────────────────────────
    // POST /auth/resend-otp  body: { email }
    async resendOtp(req: Request, res: Response) {
        try {
            const { email } = req.body;
            if (!email) return sendError(res, 'Email is required', 400);

            const employee = await prisma.employee.findUnique({ where: { email } });
            if (!employee) return sendError(res, 'Account not found', 404);

            if (employee.isEmailVerified) {
                return sendSuccess(res, { verified: true }, 'Email is already verified.');
            }

            const otp = generateOtp();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

            await prisma.employee.update({
                where: { email },
                data: { emailOtp: otp, emailOtpExpiry: otpExpiry },
            });

            await emailService.sendVerificationOtp(email, employee.name, otp);

            return sendSuccess(res, { sent: true },
                'A new OTP has been sent to your email.');
        } catch (error: any) {
            return sendError(res, error.message, 500);
        }
    },

    // ── LOGIN ─────────────────────────────────────────────────────────────────
    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return sendError(res, 'Email and password are required', 400);
            }

            const employee = await prisma.employee.findUnique({ where: { email } });
            if (!employee || employee.isDeleted) {
                return sendError(res, 'Invalid credentials', 401);
            }

            const isMatch = await bcrypt.compare(password, employee.passwordHash);
            if (!isMatch) {
                return sendError(res, 'Invalid credentials', 401);
            }

            // Block unverified emails — skip check for admins
            if (!employee.isEmailVerified && employee.role !== 'ADMIN') {
                return sendError(res,
                    'Please verify your email first. Check your inbox for the OTP we sent during registration.',
                    403);
            }

            // Block unapproved admins
            if (employee.role === 'ADMIN' && !employee.isAdminApproved) {
                return sendError(res,
                    'Your admin account is pending approval from the Super Admin.',
                    403);
            }

            const payload = {
                id: employee.id,
                email: employee.email,
                role: employee.role,
                isSuperAdmin: employee.isSuperAdmin,
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });

            // Store session in Redis
            await redis.set(`session_${employee.id}`, token, 'EX', JWT_SESSION_TTL);

            return sendSuccess(res, {
                token,
                employee: {
                    id: employee.id,
                    name: employee.name,
                    email: employee.email,
                    role: employee.role,
                    department: employee.department,
                    isSuperAdmin: employee.isSuperAdmin,
                },
            }, 'Login successful');
        } catch (error: any) {
            console.error('Login Error', error);
            return sendError(res, error?.message || 'Login failed', 500);
        }
    },

    // ── LOGOUT ────────────────────────────────────────────────────────────────
    async logout(req: AuthRequest, res: Response) {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token || !req.user) {
                return sendError(res, 'Not authenticated', 401);
            }
            await redis.set(`bl_${token}`, '1', 'EX', JWT_SESSION_TTL);
            await redis.del(`session_${req.user.id}`);
            return sendSuccess(res, null, 'Logged out successfully');
        } catch (error: any) {
            return sendError(res, error.message, 500);
        }
    },

    // ── ME ────────────────────────────────────────────────────────────────────
    async me(req: AuthRequest, res: Response) {
        try {
            if (!req.user) return sendError(res, 'Not authenticated', 401);

            const employee = await prisma.employee.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    department: true,
                    level: true,
                    totalPoints: true,
                    streakCount: true,
                    isSuperAdmin: true,
                    createdAt: true,
                },
            });

            if (!employee) return sendError(res, 'Employee not found', 404);
            return sendSuccess(res, employee);
        } catch (error: any) {
            return sendError(res, error.message, 500);
        }
    },
};