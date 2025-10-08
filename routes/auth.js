const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// إنشاء توكن JWT
const sendTokenResponse = (user, statusCode, res) => {
  // إنشاء التوكن
  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET || 'fallback_jwt_secret',
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );

  const options = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        subscription: user.subscription
      }
    });
};

// تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // التحقق من وجود المستخدم مسبقًا
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم أو البريد الإلكتروني موجود مسبقًا'
      });
    }

    // إنشاء المستخدم
    const user = await User.create({
      username,
      email,
      password
    });

    // تخزين بيانات المستخدم في الجلسة
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;

    sendTokenResponse(user, 201, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء الحساب',
      error: error.message
    });
  }
});

// تسجيل الدخول
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // التحقق من وجود البريد الإلكتروني وكلمة المرور
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور'
      });
    }

    // البحث عن المستخدم مع تضمين كلمة المرور
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    // تخزين بيانات المستخدم في الجلسة
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تسجيل الدخول',
      error: error.message
    });
  }
});

// تسجيل الخروج
router.get('/logout', (req, res) => {
  // مسح التوكن من الكوكيز
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  // تدمير الجلسة
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'خطأ في تسجيل الخروج'
      });
    }
    
    res.clearCookie('connect.sid');
    res.status(200).json({
      success: true,
      message: 'تم تسجيل الخروج بنجاح'
    });
  });
});

// الحصول على بيانات المستخدم الحالي
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في الحصول على بيانات المستخدم'
    });
  }
});

// تحديث بيانات المستخدم
router.put('/updatedetails', protect, async (req, res) => {
  try {
    const fieldsToUpdate = {
      username: req.body.username,
      email: req.body.email
    };

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث البيانات'
    });
  }
});

// تحديث كلمة المرور
router.put('/updatepassword', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // التحقق من كلمة المرور الحالية
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'كلمة المرور الحالية غير صحيحة'
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث كلمة المرور'
    });
  }
});

// نسيان كلمة المرور
router.post('/forgotpassword', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'لا يوجد حساب بهذا البريد الإلكتروني'
      });
    }

    // إنشاء توكن إعادة التعيين
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // هنا سيتم إرسال البريد الإلكتروني مع رابط إعادة التعيين
    // const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/resetpassword/${resetToken}`;
    // const message = `لقد تلقيت طلبًا لإعادة تعيين كلمة المرور. يرجى عمل PUT request إلى: \n\n ${resetUrl}`;

    // await sendEmail({
    //   email: user.email,
    //   subject: 'إعادة تعيين كلمة المرور',
    //   message
    // });

    res.status(200).json({
      success: true,
      message: 'تم إرسال بريد إلكتروني لإعادة تعيين كلمة المرور',
      data: resetToken // في الواقع، لن نرسل التوكن بل سيتم إرساله عبر البريد
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    res.status(500).json({
      success: false,
      message: 'خطأ في إرسال البريد الإلكتروني'
    });
  }
});

// إعادة تعيين كلمة المرور
router.put('/resetpassword/:resettoken', async (req, res) => {
  try {
    // الحصول على التوكن المشفر
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'توكن إعادة التعيين غير صالح أو منتهي الصلاحية'
      });
    }

    // تعيين كلمة المرور الجديدة
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في إعادة تعيين كلمة المرور'
    });
  }
});


module.exports = router;