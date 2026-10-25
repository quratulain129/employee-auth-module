import { Router } from 'express';
import { requireAuth, requireRole } from '../controllers/accessController.js';
import * as api from '../controllers/apiController.js';

const router = Router();
router.use(requireAuth); // everything below this line needs a valid session
router.get('/profile', api.profile);
router.get('/protected/example', api.protectedExample);
router.get('/admin/report', requireRole('admin'), api.adminReport);
export default router;
