require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function resetPasswords() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/electronic-signature');
    console.log('Connected to MongoDB');

    // الحصول على جميع المستخدمين
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      // تخطي المستخدمين الذين لديهم كلمات مرور مشفرة بالفعل
      if (user.password && user.password.startsWith('$2')) {
        console.log(`Skipping user ${user.email} (already has bcrypt hash)`);
        continue;
      }

      // إعادة تعيين كلمة المرور إلى "password123" (أو أي كلمة مرور تريدها)
      const newPassword = 'password123';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // تحديث المستخدم
      user.password = hashedPassword;
      await user.save();

      console.log(`Reset password for ${user.email} to: ${newPassword}`);
    }

    console.log('Password reset completed');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting passwords:', error);
    process.exit(1);
  }
}

resetPasswords();