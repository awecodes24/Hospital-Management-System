import mysql from 'mysql2/promise';
import type { ExecuteValues } from 'mysql2/typings/mysql/lib/protocol/sequences/Query';
import { env } from '../config/env';

export const pool = mysql.createPool({
  host:               env.DB_HOST,
  port:               env.DB_PORT,
  user:               env.DB_USER,
  password:           env.DB_PASSWORD,
  database:           env.DB_NAME,
  connectionLimit:    env.DB_CONNECTION_LIMIT,
  waitForConnections: true,
  queueLimit:         0,
  timezone:           '+00:00',
  dateStrings:        false,
});

// mysql2 execute() rejects non-integer numbers for LIMIT/OFFSET.
// Convert every number param to a strict integer before sending.
function sanitiseParams(params?: ExecuteValues): ExecuteValues | undefined {
  if (!Array.isArray(params)) return params;
  return params.map((p) => {
    if (typeof p === 'number') return parseInt(String(p), 10);
    return p;
  }) as ExecuteValues;
}

export async function query<T>(sql: string, params?: ExecuteValues): Promise<T[]> {
  const [rows] = await pool.execute(sql, sanitiseParams(params));
  return rows as T[];
}

export async function queryOne<T>(sql: string, params?: ExecuteValues): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

export async function callProc<T>(
  callSql: string,
  callParams: ExecuteValues,
  selectSql: string,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.execute(callSql, callParams);
    const [rows] = await conn.execute(selectSql);
    return (rows as T[])[0];
  } finally {
    conn.release();
  }
}

export async function testConnection(): Promise<void> {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
}