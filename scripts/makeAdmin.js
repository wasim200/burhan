const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/makeAdmin.js <email>');
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

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User not found for email=${email}`);
      process.exit(0);
    }

    user.role = 'admin';
    user.subscription.status = 'active';
    await user.save();
    console.log(`User ${email} is now admin with active subscription.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(2);
  }
})();
