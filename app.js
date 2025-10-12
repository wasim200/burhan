const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo');
const crypto = require('crypto');
require('dotenv').config();
const jwt = require('jsonwebtoken');

// استيراد Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const barcodeRoutes = require('./routes/barcode');
const bankTransferRoutes = require('./routes/bankTransfer');
const paymentRoutes = require('./routes/payment');
const notificationsRoutes = require('./routes/notifications');
const User = require('./models/User');

// تهيئة التطبيق
const app = express();

// الاتصال بقاعدة البيانات مع إعدادات أكثر تفصيلاً
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/electronic-signature', {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // استخدام IPv4
})
.then(() => console.log('Connected to MongoDB successfully'))
.catch(err => {
  console.error('MongoDB connection error:', err);
});

// إعدادات التطبيق
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// NOTE: Stripe webhook يحتاج raw body، لذا نُركّب مسارات الدفع قبل JSON العام
app.use('/payment', paymentRoutes);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/electronic-signature',
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: { 
    secure: false, // ضع false للتطوير المحلي
    maxAge: 24 * 60 * 60 * 1000 // 24 ساعة
  }
}));

// إعداد مجلد رفع الصور للملفات الشخصية (بعد تعريف المتطلبات)
const avatarUploadDir = path.join(__dirname, 'public', 'uploads', 'avatars');
fs.mkdirSync(avatarUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${req.session.userId || 'user'}_${Date.now()}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('صيغة ملف غير مسموح بها'));
};

const uploadAvatar = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

// إضافة سجلات للتصحيح
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// middleware لتعيين متغيرات القوالب الافتراضية
app.use((req, res, next) => {
  res.locals.message = null;
  res.locals.error = null;
  next();
});

// middleware لتعيين متغيرات القوالب من الجلسة
app.use((req, res, next) => {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role
  } : null;
  res.locals.currentPage = '';
  next();
});

// ضمان القيم الافتراضية للعرض (يمنع أخطاء في partials إذا لم تُمرَّر متغيرات)
app.use((req, res, next) => {
  if (typeof res.locals.user === 'undefined') res.locals.user = null;
  if (typeof res.locals.currentPage === 'undefined') res.locals.currentPage = '';
  next();
});

// middleware للتحقق من الجلسة (للصفحات التي تحتاج مصادقة)
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

// middleware للتحقق من صلاحية الاشتراك
const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy();
      return res.redirect('/login');
    }
    
    // إذا كان المستخدم admin، اسمح له بالوصول
    if (user.role === 'admin') {
      req.user = user;
      return next();
    }
    
    // إذا كان الاشتراك غير نشط، وجه المستخدم لصفحة قيد المراجعة
    if (user.subscription.status !== 'active') {
      return res.redirect('/register/pending');
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in requireActiveSubscription:', error);
    return res.redirect('/login');
  }
};

// middleware للتحقق من صلاحية الإدارة
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }
    
    const user = await User.findById(req.session.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).render('403', { 
        message: 'غير مصرح لك بالوصول إلى هذه الصفحة' 
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in requireAdmin:', error);
    return res.redirect('/login');
  }
};

// Routes الأساسية
app.get('/', (req, res) => {
  res.locals.currentPage = 'home';
  res.render('index', { user: res.locals.user });
});

// Routes للتسجيل والدخول
app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.locals.currentPage = 'login';
  res.render('login', { error: null });
});

app.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.locals.currentPage = 'register';
  res.render('register', { error: null });
});

// صفحة قيد المراجعة للمستخدمين الجدد
app.get('/register/pending', (req, res) => {
  res.locals.currentPage = 'pending';
  res.render('register/pending', { user: res.locals.user });
});

// صفحة انتهاء الاشتراك
app.get('/subscription/expired', requireAuth, (req, res) => {
  res.locals.currentPage = 'subscription-expired';
  res.render('subscription-expired', { user: res.locals.user });
});

// صفحة شروط الاستخدام
app.get('/terms', (req, res) => {
  res.locals.currentPage = 'terms';
  res.render('terms', { user: res.locals.user });
});

// صفحة سياسة الخصوصية
app.get('/privacy', (req, res) => {
  res.locals.currentPage = 'privacy';
  res.render('privacy', { user: res.locals.user });
});

// صفحة الملف الشخصي (عرض وتحديث)
app.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.redirect('/login');
    }
    res.locals.currentPage = 'profile';
    res.render('profile', { user, error: null, message: null });
  } catch (err) {
    console.error('Error loading profile:', err);
    res.status(500).render('error', { message: 'تعذر تحميل الملف الشخصي' });
  }
});

app.post('/profile', requireAuth, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    const { username, email, phone, currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.session.userId).select('+password +salt');
    if (!user) {
      req.session.destroy(() => {});
      return res.redirect('/login');
    }

    // التحقق من البريد الإلكتروني واسم المستخدم (تفادي التكرار عند التغيير)
    if (email && email !== user.email) {
      const existsEmail = await User.findOne({ email });
      if (existsEmail) {
        res.locals.currentPage = 'profile';
        return res.render('profile', { user, error: 'البريد الإلكتروني موجود مسبقاً', message: null });
      }
      user.email = email;
    }
    if (username && username !== user.username) {
      const existsUsername = await User.findOne({ username });
      if (existsUsername) {
        res.locals.currentPage = 'profile';
        return res.render('profile', { user, error: 'اسم المستخدم موجود مسبقاً', message: null });
      }
      user.username = username;
    }

    // تغيير كلمة المرور اختياري
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        res.locals.currentPage = 'profile';
        return res.render('profile', { user, error: 'يرجى إدخال كلمة المرور الحالية', message: null });
      }
      const ok = await user.matchPassword(currentPassword);
      if (!ok) {
        res.locals.currentPage = 'profile';
        return res.render('profile', { user, error: 'كلمة المرور الحالية غير صحيحة', message: null });
      }
      if (!newPassword || newPassword.length < 6) {
        res.locals.currentPage = 'profile';
        return res.render('profile', { user, error: 'يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل', message: null });
      }
      if (newPassword !== confirmPassword) {
        res.locals.currentPage = 'profile';
        return res.render('profile', { user, error: 'كلمة المرور الجديدة وتأكيدها غير متطابقتين', message: null });
      }
      user.password = newPassword; // سيتم تشفيرها في pre('save')
    }

    // حفظ مسار الصورة الرمزية إذا تم رفعها
    if (req.file) {
      user.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    }

    await user.save();

    // تحديث بيانات الجلسة المعروضة في الواجهة
    req.session.username = user.username;

    res.locals.currentPage = 'profile';
    res.render('profile', { user, error: null, message: 'تم تحديث الملف الشخصي بنجاح' });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).render('error', { message: 'حدث خطأ أثناء تحديث الملف الشخصي' });
  }
});

// مسار اختبار بسيط
app.get('/test-register', (req, res) => {
  res.send('هذه صفحة اختبار للتسجيل - إذا ترى هذا النص، فالمشكلة في ملفات العرض');
});

// مسار للتحقق من صحة الخادم
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// مسار اختبار بسيط
app.get('/test', (req, res) => {
  console.log('تم استلام طلب اختبار');
  res.send('الخادم يعمل بشكل صحيح - ' + new Date().toISOString());
});

// عملية التسجيل
app.post('/register', async (req, res) => {
  console.log('بدء عملية التسجيل');
  
  try {
    const { username, email, password, passwordConfirm } = req.body;
    
    console.log('بيانات الاستلام:', { username, email, password: password ? 'موجود' : 'مفقود' });
    
    // التحقق من وجود جميع الحقول المطلوبة
    if (!username || !email || !password) {
      console.log('حقول مفقودة');
      res.locals.currentPage = 'register';
      return res.render('register', { error: 'يرجى ملء جميع الحقول المطلوبة' });
    }
    
    // التحقق من تطابق كلمة المرور
    if (password !== passwordConfirm) {
      console.log('كلمة المرور غير متطابقة');
      res.locals.currentPage = 'register';
      return res.render('register', { error: 'كلمة المرور وتأكيد كلمة المرور غير متطابقتين' });
    }
    
    // التحقق من قوة كلمة المرور
    if (password.length < 6) {
      console.log('كلمة المرور قصيرة');
      res.locals.currentPage = 'register';
      return res.render('register', { error: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' });
    }
    
    console.log('البحث عن مستخدم موجود');
    // التحقق من وجود المستخدم مسبقاً
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      console.log('المستخدم موجود مسبقاً');
      res.locals.currentPage = 'register';
      return res.render('register', { 
        error: 'اسم المستخدم أو البريد الإلكتروني موجود مسبقاً' 
      });
    }
    
    console.log('إنشاء مستخدم جديد');
    
    // إنشاء مفتاح تشفير فريد
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    
    // إنشاء زوج المفاتيح للتوقيع الرقمي
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    // إنشاء المستخدم (سيقوم middleware تلقائياً بتشفير كلمة المرور)
    const newUser = new User({
      username,
      email,
      password,
      encryptionKey,
      publicKey: publicKey.toString(),
      privateKey: privateKey.toString(),
      subscription: {
        plan: 'basic',
        status: 'inactive'
      }
    });
    
    console.log('حفظ المستخدم في قاعدة البيانات');
    await newUser.save();
    console.log('تم حفظ المستخدم:', newUser.email);
    
      // تخزين بيانات المستخدم في الجلسة
      req.session.userId = newUser._id.toString();
      req.session.username = newUser.username;
      req.session.role = newUser.role;

      // حفظ الجلسة صراحةً قبل إعادة التوجيه لتفادي حالات السباق في بعض بيئات التخزين
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session before redirect:', err);
          return res.render('register', { error: 'حدث خطأ في حفظ الجلسة، يرجى المحاولة مرة أخرى' });
        }
        
        try {
          // إذا كان المستخدم admin أو اشتراكه نشط، وجهه للوحة التحكم
          if (newUser.role === 'admin' || (newUser.subscription && newUser.subscription.status === 'active')) {
            console.log('تم تعيين بيانات الجلسة، التوجيه إلى لوحة التحكم');
            res.redirect('/dashboard');
          } else {
            // توجيه المستخدم العادي إلى صفحة قيد المراجعة
            console.log('تم تعيين بيانات الجلسة، التوجيه إلى صفحة قيد المراجعة');
            res.redirect('/register/pending');
          }
        } catch (redirectError) {
          console.error('Error during redirect:', redirectError);
          res.render('register', { error: 'حدث خطأ في التوجيه، يرجى المحاولة مرة أخرى' });
        }
      });
    
  } catch (error) {
    console.error('خطأ في التسجيل:', error);
    res.locals.currentPage = 'register';
    
    // معالجة أخطاء قاعدة البيانات
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const message = field === 'email' ? 'البريد الإلكتروني موجود مسبقاً' : 'اسم المستخدم موجود مسبقاً';
      return res.render('register', { error: message });
    }
    
    // معالجة أخطاء التحقق من صحة البيانات
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.render('register', { error: messages.join(', ') });
    }
    
    res.render('register', { error: 'حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة مرة أخرى' });
  }
});

// عملية تسجيل الدخول
app.post('/login', async (req, res) => {
  console.log('بدء عملية تسجيل الدخول');
  
  try {
    const { email, password } = req.body;
    
    console.log('بيانات الاستلام:', { email, password: password ? 'موجود' : 'مفقود' });
    
    // التحقق من وجود البريد الإلكتروني وكلمة المرور
    if (!email || !password) {
      console.log('حقول مفقودة');
      res.locals.currentPage = 'login';
      return res.render('login', { error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
    }
    
    console.log('البحث عن المستخدم في قاعدة البيانات');
    // البحث عن المستخدم في قاعدة البيانات مع تضمين كلمة المرور
    const user = await User.findOne({ email }).select('+password +salt');
    console.log('نتيجة البحث:', user ? 'تم العثور على المستخدم' : 'لم يتم العثور على المستخدم');
    
    if (!user) {
      console.log('المستخدم غير موجود');
      res.locals.currentPage = 'login';
      return res.render('login', { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }
    
    // التحقق من وجود كلمة المرور في قاعدة البيانات
    if (!user.password || !user.salt) {
      console.log('كلمة المرور أو salt مفقودة في قاعدة البيانات');
      res.locals.currentPage = 'login';
      return res.render('login', { error: 'خطأ في بيانات المستخدم، يرجى التواصل مع الدعم' });
    }
    
  console.log('مقارنة كلمة المرور');
  // مقارنة كلمة المرور (matchPassword is async)
  const isPasswordValid = await user.matchPassword(password);
  console.log('نتيجة المقارنة:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('كلمة المرور غير صحيحة');
      res.locals.currentPage = 'login';
      return res.render('login', { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }
    
    // تخزين بيانات المستخدم في الجلسة
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    req.session.role = user.role;

    // إنشاء JWT وتخزينه في الجلسة والكوكيز حتى تعمل حماية المسارات
    try {
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET || 'fallback_jwt_secret',
        { expiresIn: process.env.JWT_EXPIRE || '30d' }
      );

      // حفظ التوكن في الجلسة (protect يبحث عنه كخيار)
      req.session.token = token;

      // ضبط كوكي التوكن بحيث تتوافق مع سلوك API الموجود
      const cookieOptions = {
        expires: new Date(Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000),
        httpOnly: true
      };
      if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
      res.cookie('token', token, cookieOptions);
    } catch (err) {
      console.error('Failed to create token for session login:', err);
    }

    // التحقق من حالة الاشتراك قبل التوجيه
    if (user.role === 'admin' || (user.subscription && user.subscription.status === 'active')) {
      console.log('تم تعيين بيانات الجلسة، التوجيه إلى لوحة التحكم');
      res.redirect('/dashboard');
    } else {
      console.log('تم تعيين بيانات الجلسة، التوجيه إلى صفحة قيد المراجعة');
      res.redirect('/register/pending');
    }
    
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    res.locals.currentPage = 'login';
    res.render('login', { error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

// Route لتسجيل الخروج
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/dashboard');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// Routes الأخرى مع الحماية
app.use('/dashboard', requireActiveSubscription, dashboardRoutes);
app.use('/admin', requireAdmin, adminRoutes);
app.use('/barcode', requireActiveSubscription, barcodeRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/api/bank-transfer', bankTransferRoutes);

// التعامل مع الأخطاء 404
app.use((req, res) => {
  res.locals.currentPage = '404';
  res.status(404).render('404');
});

// معالج الأخطاء العام
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.locals.currentPage = 'error';
  res.status(500).render('error', {
    message: 'حدث خطأ في الخادم',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// معالجة الأخطاء غير المعالجة
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// تشغيل المهام المجدولة
const { startScheduledTasks } = require('./utils/scheduledTasks');
startScheduledTasks();

// تشغيل الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});