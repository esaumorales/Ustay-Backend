const crypto = require('crypto');

const secret = crypto.randomBytes(64).toString('hex');
console.log('Tu nuevo JWT_SECRET:');
console.log(secret);