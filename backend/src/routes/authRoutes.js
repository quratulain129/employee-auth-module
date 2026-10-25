import { Router } from 'express';
import * as auth from '../controllers/authController.js';

const router = Router();
router.get('/google', auth.googleStart);
router.get('/google/callback', auth.googleCallback);
router.get('/microsoft', auth.microsoftStart);
router.get('/microsoft/callback', auth.microsoftCallback);
router.get('/session', auth.sessionStatus);
router.post('/logout', auth.logout); // POST because logout changes state; GET links could be triggered by other sites
export default router;
