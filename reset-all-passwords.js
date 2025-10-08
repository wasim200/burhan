require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('./models/User');

async function resetAllPasswords() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/electronic-signature');
    console.log('Connected to MongoDB');

    // الحصول على جميع المستخدمين
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      // إعادة تعيين كلمة المرور إلى "password123"
      const newPassword = 'password123';
      
      // إنشاء salt جديد
      const salt = crypto.randomBytes(16).toString('hex');
      
      // تشفير كلمة المرور
      const hashedPassword = crypto
        .pbkdf2Sync(newPassword, salt, 1000, 64, 'sha512')
        .toString('hex');
      
      // تحديث المستخدم
      user.password = hashedPassword;
      user.salt = salt;
      await user.save();

      console.log(`Reset password for ${user.email} to: ${newPassword}`);
    }

    console.log('Password reset completed for all users');
    console.log('You can now login with email and password "password123"');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting passwords:', error);
    process.exit(1);
  }
}

resetAllPasswords();