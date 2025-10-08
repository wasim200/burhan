const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const email = process.argv[2];
const testPassword = process.argv[3];

if (!email) {
  console.error('Usage: node scripts/printUser.js <email> [testPassword]');
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/electronic-signature';

(async () => {
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    });

    const user = await User.findOne({ email }).select('+password +salt');
    if (!user) {
      console.log(`User not found for email=${email}`);
      process.exit(0);
    }

    console.log('User found:');
    console.log('id:', user._id.toString());
    console.log('username:', user.username);
    console.log('email:', user.email);
    console.log('role:', user.role);
    console.log('subscription:', user.subscription);
    console.log('password (hash):', user.password ? user.password : '(none)');
    console.log('salt:', user.salt ? user.salt : '(none)');

    if (testPassword) {
      const matches = user.matchPassword(testPassword);
      console.log(`matchPassword('${testPassword}') =>`, matches);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(2);
  }
})();
