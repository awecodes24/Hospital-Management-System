/**
 * Run with: npx ts-node src/scripts/hash-password.ts
 *
 * Outputs a bcrypt hash for "Hospital@123" and the SQL UPDATE
 * you need to run on your Railway DB before testing login.
 */

import bcrypt from 'bcrypt';

async function main() {
  const password = 'Hospital@123';
  const rounds   = 12;

  console.log(`\nGenerating bcrypt hash for: "${password}" (rounds: ${rounds})\n`);
  const hash = await bcrypt.hash(password, rounds);

  console.log('Hash:', hash);
  console.log('\n-- Paste this into MySQL Workbench to fix all seed users:\n');
  console.log(`UPDATE users SET password_hash = '${hash}';`);
  console.log('\n-- Or update a single user:\n');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'admin@himalaya.np';`);
}

main();
