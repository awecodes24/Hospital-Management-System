import { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';
import { AppError } from './errorHandler';

// Simple in-process cache: role_id → Set<permission_name>
// Populated on first use, lives for the process lifetime.
// For production you'd use Redis; for a semester project this is fine.
const permissionCache = new Map<number, Set<string>>();

async function getPermissionsForRole(roleId: number): Promise<Set<string>> {
  if (permissionCache.has(roleId)) {
    return permissionCache.get(roleId)!;
  }

  const rows = await query<{ name: string }>(
    `SELECT p.name
     FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.permission_id
     WHERE rp.role_id = ?`,
    [roleId],
  );

  const perms = new Set(rows.map((r) => r.name));
  permissionCache.set(roleId, perms);
  return perms;
}

/**
 * authorize('billing.create')
 * Attach after authenticate() on any route that needs a permission check.
 */
export function authorize(permission: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    try {
      const perms = await getPermissionsForRole(req.user.role_id);

      if (!perms.has(permission)) {
        return next(
          new AppError(`Forbidden — requires permission: ${permission}`, 403),
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Clear the cache (useful in tests or after role changes) */
export function clearPermissionCache(): void {
  permissionCache.clear();
}
