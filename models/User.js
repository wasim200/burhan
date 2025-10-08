const mongoose = require('mongoose');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'يرجى إدخال اسم المستخدم'],
    unique: true,
    trim: true,
    maxlength: [50, 'لا يمكن أن يزيد اسم المستخدم عن 50 حرفًا']
  },
  email: {
    type: String,
    required: [true, 'يرجى إدخال البريد الإلكتروني'],
    unique: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'يرجى إدخال بريد إلكتروني صحيح'
    ]
  },
  password: {
    type: String,
    required: [true, 'يرجى إدخال كلمة المرور'],
    minlength: [6, 'يجب أن تكون كلمة المرور至少 6 أحرف'],
    select: false
  },
  salt: {
    type: String,
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      default: 'basic'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired'],
      default: 'inactive'
    },
    startDate: Date,
    endDate: Date,
    paymentId: String
  },
  encryptionKey: {
    type: String,
    required: true
  },
  publicKey: {
    type: String,
    required: true
  },
  privateKey: {
    type: String,
    required: true
  },
  // معلومات اختيارية للملف الشخصي
  phone: {
    type: String,
  },
  avatarUrl: {
    type: String,
  },
  // معرف العميل في Stripe للدفع بالبطاقة
  stripeCustomerId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// تشفير كلمة المرور قبل الحفظ
UserSchema.pre('save', function(next) {
  // إذا لم يتم تعديل كلمة المرور، انتقل إلى middleware التالي
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // إنشاء salt عشوائي
    this.salt = crypto.randomBytes(16).toString('hex');
    
    // تشفير كلمة المرور
    this.password = crypto
      .pbkdf2Sync(this.password, this.salt, 1000, 64, 'sha512')
      .toString('hex');
    
    next();
  } catch (error) {
    next(error);
  }
});

// مقارنة كلمات المرور
UserSchema.methods.matchPassword = function(enteredPassword) {
  // إذا لم تكن هناك كلمة مرور مدخلة أو لا يوجد salt مخزن
  if (!enteredPassword || !this.salt) {
    return false;
  }
  
  try {
    // تشفير كلمة المرور المدخلة بنفس الـ salt
    const hash = crypto
      .pbkdf2Sync(enteredPassword, this.salt, 1000, 64, 'sha512')
      .toString('hex');
    
    return hash === this.password;
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

module.exports = mongoose.model('User', UserSchema);