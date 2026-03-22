import { query, queryOne } from '../pool';
import { UserRow } from '../../types/db.types';

/** Fetch a user + their role name by email (used at login) */
export async function findUserByEmail(email: string) {
  return queryOne<UserRow & { role_name: string }>(
    `SELECT u.user_id, u.email, u.password_hash, u.role_id,
            u.is_active, u.last_login, u.created_at,
            r.name AS role_name
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.email = ?`,
    [email],
  );
}

/** Fetch a user by ID (used for /me endpoint) */
export async function findUserById(userId: number) {
  return queryOne<UserRow & { role_name: string }>(
    `SELECT u.user_id, u.email, u.role_id, u.is_active,
            u.last_login, u.created_at,
            r.name AS role_name
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.user_id = ?`,
    [userId],
  );
}

/** Stamp last_login timestamp on successful login */
export async function updateLastLogin(userId: number): Promise<void> {
  await query('UPDATE users SET last_login = NOW() WHERE user_id = ?', [userId]);
}

/** Update a user's password hash */
export async function updatePasswordHash(userId: number, hash: string): Promise<void> {
  await query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hash, userId]);
}

/** Get full profile: doctor or staff details linked to this user */
export async function getUserProfile(userId: number) {
  // Try doctor first
  const doctor = await queryOne<{
    profile_type: string;
    first_name:   string;
    last_name:    string;
    phone:        string | null;
    specialization: string | null;
    department:   string | null;
  }>(
    `SELECT 'doctor' AS profile_type,
            d.first_name, d.last_name, d.phone,
            d.specialization,
            dep.name AS department
     FROM doctors d
     LEFT JOIN departments dep ON d.department_id = dep.department_id
     WHERE d.user_id = ?`,
    [userId],
  );

  if (doctor) return doctor;

  // Fall back to staff
  return queryOne<{
    profile_type: string;
    first_name:   string;
    last_name:    string;
    phone:        string | null;
    specialization: null;
    department:   string | null;
  }>(
    `SELECT 'staff' AS profile_type,
            s.first_name, s.last_name, s.phone,
            NULL AS specialization,
            dep.name AS department
     FROM staff s
     LEFT JOIN departments dep ON s.department_id = dep.department_id
     WHERE s.user_id = ?`,
    [userId],
  );
}
