require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function debugPasswords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/electronic-signature');
    console.log('Connected to MongoDB');

    // ابحث عن المستخدم
    const user = await User.findOne({ email: 'ws1im1232@gmail.com' }).select('+password');
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User found:', user.email);
    console.log('Stored password hash:', user.password);
    
    // جرب التحقق بكلمة مرور مختلفة
    const testPasswords = ['password123', '123456', 'testpassword', 'ws1im1232'];
    
    for (const testPassword of testPasswords) {
      const isValid = await bcrypt.compare(testPassword, user.password);
      console.log(`Password "${testPassword}": ${isValid ? 'VALID' : 'INVALID'}`);
    }

    // إذا لم تنجح أي من كلمات المرور، قم بإعادة تعيينها
    const newPassword = 'newpassword123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    user.password = hashedPassword;
    await user.save();
    
    console.log(`\nPassword has been reset to: ${newPassword}`);
    console.log(`New hash: ${hashedPassword}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error debugging passwords:', error);
    process.exit(1);
  }
}

debugPasswords();