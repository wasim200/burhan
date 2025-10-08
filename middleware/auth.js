const jwt = require('jsonwebtoken');
const User = require('../models/User');

// التحقق من أن المستخدم مسجل الدخول
exports.protect = async (req, res, next) => {
  try {
    let token;

 

    // التحقق من وجود التوكن في الرأس
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('protect: token found in Authorization header');
    }
    // أو التحقق من وجود التوكن في الكوكيز (الان يتم تعيينه في /login)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('protect: token found in cookie');
    }
    // أو التحقق من وجود التوكن في الجلسة (fallback)
    else if (req.session && req.session.token) {
      token = req.session.token;
      console.log('protect: token found in session');
    }

    // التأكد من وجود التوكن
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'غير مصرح بالوصول، يرجى تسجيل الدخول'
      });
    }

    try {
      // التحقق من صحة التوكن
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_jwt_secret');
  console.log('protect: decoded token id=', decoded && decoded.id);
      
      // الحصول على بيانات المستخدم من التوكن
      req.user = await User.findById(decoded.id);
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'لم يعد هذا المستخدم موجودًا'
        });
      }
      
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'جلسة العمل غير صالحة، يرجى تسجيل الدخول مرة أخرى'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'خطأ في المصادقة'
    });
  }
};

// التحقق من صلاحية الاشتراك
exports.requireActiveSubscription = async (req, res, next) => {
  try {
    if (req.user.subscription.status !== 'active') {
      // إذا كان الطلب HTML (وليس API/AJAX)، وجه المستخدم لصفحة قيد المراجعة
      if (req.accepts(['html', 'json']) === 'html') {
        return res.redirect('/register/pending');
      } else {
        return res.status(403).json({
          success: false,
          message: 'يجب أن يكون لديك اشتراك نشط للوصول إلى هذه الميزة'
        });
      }
    }
    next();
  } catch (error) {
    // في حالة الخطأ، أعد توجيه المستخدم لصفحة المراجعة إذا كان HTML
    if (req.accepts(['html', 'json']) === 'html') {
      return res.redirect('/register/pending');
    } else {
      return res.status(500).json({
        success: false,
        message: 'خطأ في التحقق من الاشتراك'
      });
    }
  }
};

// التحقق من صلاحية المسؤول
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `دور المستخدم ${req.user.role} غير مصرح له بالوصول إلى هذا المسار`
      });
    }
    next();
  };
};