const jwt = require('jsonwebtoken');
const User = require('../models/User');

// التحقق من أن المستخدم مسجل الدخول
exports.protect = async (req, res, next) => {
  try {
    let token;

    // التحقق من وجود التوكن في الرأس
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('✅ protect: token found in Authorization header');
    }
    // أو التحقق من وجود التوكن في الكوكيز (الان يتم تعيينه في /login)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('✅ protect: token found in cookie');
    }
    // أو التحقق من وجود التوكن في الجلسة (fallback)
    else if (req.session && req.session.token) {
      token = req.session.token;
      console.log('✅ protect: token found in session');
    }

    // التأكد من وجود التوكن
    if (!token) {
      console.log('❌ protect: no token found');
      console.log('   cookies:', req.cookies);
      console.log('   session:', req.session);
      console.log('   headers.authorization:', req.headers.authorization);
      
      // إذا كان الطلب HTML، أعد التوجيه لصفحة تسجيل الدخول
      if (req.accepts(['html', 'json']) === 'html') {
        return res.redirect('/login?message=الرجاء تسجيل الدخول للوصول إلى هذه الصفحة');
      }
      
      return res.status(401).json({
        success: false,
        message: 'غير مصرح بالوصول، يرجى تسجيل الدخول'
      });
    }

    try {
      // التحقق من صحة التوكن
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_jwt_secret');
      console.log('✅ protect: decoded token id=', decoded && decoded.id);
      
      // الحصول على بيانات المستخدم من التوكن
      req.user = await User.findById(decoded.id);
      
      if (!req.user) {
        console.log('❌ protect: user not found for id:', decoded.id);
        return res.status(401).json({
          success: false,
          message: 'لم يعد هذا المستخدم موجودًا'
        });
      }
      
      console.log('✅ protect: user authenticated:', req.user.username);
      next();
    } catch (error) {
      console.log('❌ protect: token verification failed:', error.message);
      
      // إذا كان الطلب HTML، أعد التوجيه لصفحة تسجيل الدخول
      if (req.accepts(['html', 'json']) === 'html') {
        return res.redirect('/login?message=جلسة العمل منتهية، الرجاء تسجيل الدخول مرة أخرى');
      }
      
      return res.status(401).json({
        success: false,
        message: 'جلسة العمل غير صالحة، يرجى تسجيل الدخول مرة أخرى'
      });
    }
  } catch (error) {
    console.log('❌ protect: unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ في المصادقة'
    });
  }
};

// التحقق من صلاحية الاشتراك
exports.requireActiveSubscription = async (req, res, next) => {
  try {
    // التحقق من انتهاء صلاحية الاشتراك بناءً على endDate
    if (req.user.subscription.endDate) {
      const now = new Date();
      const endDate = new Date(req.user.subscription.endDate);
      
      // إذا انتهت المدة، تحديث الحالة
      if (now > endDate && req.user.subscription.status === 'active') {
        req.user.subscription.status = 'expired';
        await req.user.save();
        console.log(`⏰ Subscription expired for user: ${req.user.username}`);
      }
    }
    
    // التحقق من حالة الاشتراك
    const subscriptionStatus = req.user.subscription.status;
    
    if (subscriptionStatus !== 'active') {
      console.log(`⚠️ User ${req.user.username} subscription status: ${subscriptionStatus}`);
      
      // إذا كان الطلب HTML، وجه حسب الحالة
      if (req.accepts(['html', 'json']) === 'html') {
        // حالة منتهي → صفحة انتهاء الاشتراك
        if (subscriptionStatus === 'expired') {
          console.log(`   → Redirecting to /subscription/expired`);
          return res.redirect('/subscription/expired');
        } 
        // حالة غير نشط → صفحة المراجعة
        else if (subscriptionStatus === 'inactive') {
          console.log(`   → Redirecting to /register/pending (inactive)`);
          return res.redirect('/register/pending');
        }
        // حالة قيد المراجعة → صفحة المراجعة
        else if (subscriptionStatus === 'pending') {
          console.log(`   → Redirecting to /register/pending (pending)`);
          return res.redirect('/register/pending');
        }
        // أي حالة أخرى → صفحة المراجعة
        else {
          console.log(`   → Redirecting to /register/pending (unknown: ${subscriptionStatus})`);
          return res.redirect('/register/pending');
        }
      } else {
        // رد JSON للـ API requests
        return res.status(403).json({
          success: false,
          message: 'يجب أن يكون لديك اشتراك نشط للوصول إلى هذه الميزة',
          status: subscriptionStatus
        });
      }
    }
    
    next();
  } catch (error) {
    console.log('❌ requireActiveSubscription error:', error);
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