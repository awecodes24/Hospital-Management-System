import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { loginSchema, changePasswordSchema } from './auth.schema';
import {
  findUserByEmail,
  findUserById,
  updateLastLogin,
  updatePasswordHash,
  getUserProfile,
} from '../../db/queries/auth.queries';

// ── POST /api/auth/login ───────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await findUserByEmail(email);
    if (!user) throw new AppError('Invalid email or password', 401);
    if (!user.is_active) throw new AppError('Account is deactivated', 403);

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) throw new AppError('Invalid email or password', 401);

    const payload = {
      user_id:   user.user_id,
      email:     user.email,
      role_id:   user.role_id,
      role_name: user.role_name,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    await updateLastLogin(user.user_id);

    res.json({
      success: true,
      data: {
        token,
        user: {
          user_id:   user.user_id,
          email:     user.email,
          role:      user.role_name,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/auth/me ───────────────────────────────────────────
export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.user_id;

    const user = await findUserById(userId);
    if (!user) throw new AppError('User not found', 404);

    const profile = await getUserProfile(userId);

    res.json({
      success: true,
      data: {
        user_id:    user.user_id,
        email:      user.email,
        role:       user.role_name,
        is_active:  user.is_active,
        last_login: user.last_login,
        profile,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/auth/change-password ───────────────────────────
export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { current_password, new_password } = changePasswordSchema.parse(req.body);
    const userId = req.user!.user_id;

    const user = await findUserByEmail(req.user!.email);
    if (!user) throw new AppError('User not found', 404);

    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) throw new AppError('Current password is incorrect', 401);

    const newHash = await bcrypt.hash(new_password, env.BCRYPT_ROUNDS);
    await updatePasswordHash(userId, newHash);

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
}
