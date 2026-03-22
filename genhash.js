const bcrypt = require('bcrypt');

bcrypt.hash('Hospital@123', 12).then(function(hash) {
  console.log('Hash:', hash);
  console.log('');
  console.log('Run this in SQL Workbench:');
  console.log("UPDATE users SET password_hash = '" + hash + "' WHERE user_id > 0;");
});
