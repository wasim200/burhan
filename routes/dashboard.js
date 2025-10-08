const express = require('express');
const router = express.Router();
const { protect, requireActiveSubscription } = require('../middleware/auth');
const Barcode = require('../models/Barcode');

// جميع routes تحتاج إلى مصادقة واشتراك نشط
// ملاحظة: middleware المصادقة يتم تطبيقه في app.js


// صفحة لوحة التحكم الرئيسية
router.get('/', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // تحويل userId إلى ObjectId
    const currentUserId = req.user.id || req.user._id;
    const userObjectId = mongoose.Types.ObjectId.isValid(currentUserId) 
      ? new mongoose.Types.ObjectId(currentUserId) 
      : currentUserId;

    // حساب إحصائيات المستخدم
    const totalBarcodes = await Barcode.countDocuments({ userId: userObjectId });
    
    // حساب عدد الباركودات الممسوحة (scannedCount > 0)
    const scannedBarcodes = await Barcode.countDocuments({ 
      userId: userObjectId,
      scannedCount: { $gt: 0 }
    });
    
    // الباركودات النشطة (كل الباركودات الموجودة)
    const activeBarcodes = totalBarcodes;
    
    // حساب الأيام المتبقية في الاشتراك
    let daysRemaining = 0;
    if (req.user.subscription && req.user.subscription.endDate) {
      const endDate = new Date(req.user.subscription.endDate);
      const today = new Date();
      const diffTime = endDate - today;
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    console.log('📊 Dashboard Stats for user:', currentUserId);
    console.log('   Total Barcodes:', totalBarcodes);
    console.log('   Scanned Barcodes:', scannedBarcodes);
    console.log('   Active Barcodes:', activeBarcodes);
    console.log('   Days Remaining:', daysRemaining);

    res.render('dashboard/index', {
      user: req.user,
      stats: {
        totalBarcodes,
        scannedBarcodes,
        activeBarcodes,
        daysRemaining
      }
    });
  } catch (error) {
    console.error('❌ Error loading dashboard:', error);
    res.status(500).render('error', {
      user: req.user,
      message: 'حدث خطأ أثناء تحميل لوحة التحكم'
    });
  }
});

// صفحة إنشاء الباركود
router.get('/create-barcode', (req, res) => {
  res.render('dashboard/create-barcode', {
    user: req.user
  });
});

// صفحة قائمة الباركودات
router.get('/barcode-list', async (req, res) => {
  try {
    // جلب الباركودات الخاصة بالمستخدم الحالي فقط
    const barcodes = await Barcode.find({ userId: req.user.id })
      .sort({ timestamp: -1 }); // الأحدث أولاً
    
    console.log('User ID:', req.user.id);
    console.log('Barcodes found:', barcodes.length);
      
    res.render('dashboard/barcode-list', {
      user: req.user,
      barcodes: barcodes || []
    });
  } catch (error) {
    console.error('Error fetching barcodes:', error);
    res.status(500).render('error', { 
      message: 'حدث خطأ أثناء جلب قائمة الباركودات',
      user: req.user
    });
  }
});

// صفحة قراءة الباركود
router.get('/read-barcode', (req, res) => {
  res.render('dashboard/read-barcode', {
    user: req.user
  });
});

// صفحة إدارة التشفير
router.get('/encryption', (req, res) => {
  res.render('dashboard/encryption', {
    user: req.user
  });
});

// صفحة إدارة الاشتراك
router.get('/subscription', async (req, res) => {
  try {
    const plans = [
      {
        id: 'basic',
        name: 'الباقة الأساسية',
        price: 10,
        features: [
          'إنشاء 10 باركودات شهرياً',
          'دعم فني أساسي',
          'تخزين لمدة 3 أشهر'
        ]
      },
      {
        id: 'premium',
        name: 'الباقة المميزة',
        price: 25,
        features: [
          'إنشاء باركودات غير محدودة',
          'دعم فني مميز',
          'تخزين لمدة سنة',
          'تقارير متقدمة'
        ]
      },
      {
        id: 'enterprise',
        name: 'باقة المؤسسات',
        price: 100,
        features: [
          'جميع ميزات الباقة المميزة',
          'دعم فني على مدار الساعة',
          'تخزين دائم',
          'إدارة متعددة المستخدمين',
          'تخصيص متقدم'
        ]
      }
    ];

    res.render('dashboard/subscription', {
      user: req.user,
      plans: plans
    });
  } catch (error) {
    console.error('Error loading subscription page:', error);
    res.status(500).render('error', {
      message: 'فشل في تحميل صفحة الاشتراك'
    });
  }
});

// صفحة نجاح الدفع
router.get('/subscription/success', (req, res) => {
  res.render('dashboard/payment-success', {
    user: req.user,
    sessionId: req.query.session_id
  });
});

// صفحة إلغاء الدفع
router.get('/subscription/cancel', (req, res) => {
  res.render('dashboard/payment-cancel', {
    user: req.user
  });
});

module.exports = router;