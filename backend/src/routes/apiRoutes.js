import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import * as api from '../controllers/apiController.js';
import * as tool from '../controllers/toolController.js';

const router = Router();
router.use(requireAuth); // everything below this line needs a valid session
router.get('/profile', api.profile);
router.get('/protected/example', api.protectedExample);
router.get('/admin/report', requireRole('admin'), api.adminReport);

// Object Detection / Cap Detection Tool endpoints
router.get('/tools/cap-detection/status', tool.getStatus);
router.post('/tools/cap-detection/detect', tool.detect);

export default router;
