import { Router } from 'express';
import { login, me, changePassword } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';

export const authRouter = Router();

// Public
authRouter.post('/login', login);

// Protected
authRouter.get('/me',              authenticate, me);
authRouter.patch('/change-password', authenticate, changePassword);
