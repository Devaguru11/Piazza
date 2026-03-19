import { Router } from 'express';
import multer from 'multer';
import { gamificationController } from '../controllers/gamificationController';
import { verifyJWT } from '../middleware/verifyJWT';
import { roleGuard } from '../middleware/roleGuard';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();
router.use(verifyJWT);

// ── Badges ─────────────────────────────────────────────────────────────────────
router.get('/badges/mine', gamificationController.myBadges);
router.get('/badges', gamificationController.listBadges);
router.post('/badges', roleGuard('ADMIN'), upload.single('image'), gamificationController.createBadge);

// ── Leaderboard ────────────────────────────────────────────────────────────────
router.get('/leaderboard/me', gamificationController.myRank);
router.get('/leaderboard', gamificationController.leaderboard);

// ── Challenges — ALL static routes MUST come before /:id routes ────────────────

// List all challenges
router.get('/challenges', gamificationController.listChallenges);

// Admin: create challenge with optional brief file
router.post('/challenges', roleGuard('ADMIN'), upload.single('brief'), gamificationController.createChallenge);

// ── CRITICAL: These static sub-routes MUST be before /challenges/:id ──────────

// Admin: list all submissions (GET /challenges/submissions)
// This MUST be before GET /challenges/:id or Express treats "submissions" as an :id
router.get('/challenges/submissions', roleGuard('ADMIN'), gamificationController.listSubmissions);

// Admin: approve a submission (POST /challenges/submissions/:id/approve)
router.post('/challenges/submissions/:id/approve', roleGuard('ADMIN'), gamificationController.approveSubmission);

// ── Challenge :id routes (after all static routes) ─────────────────────────────
router.get('/challenges/:id/progress', gamificationController.challengeProgress);
router.post('/challenges/:id/join', gamificationController.joinChallenge);

// Employee: submit challenge work with optional file
router.post('/challenges/:id/submit', upload.single('submissionFile'), gamificationController.submitChallenge);

export default router;