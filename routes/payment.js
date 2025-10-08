const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// ملاحظة: يجب تعريف مسار الـ webhook أولاً ليستخدم raw body بدون JSON parser
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    // Lazy load Stripe SDK here to avoid app startup crash if not installed yet
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    await paymentService.handleWebhook(event);
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// فعّل JSON parser لباقي المسارات داخل هذا الراوتر
router.use(express.json());

// الحصول على خطط الاشتراك
router.get('/plans', protect, (req, res) => {
  const plans = [
    {
      id: 'basic',
      name: 'الباقة الأساسية',
      price: process.env.STRIPE_BASIC_PRICE / 100,
      features: [
        'إنشاء 10 باركودات شهرياً',
        'دعم فني أساسي',
        'تخزين لمدة 3 أشهر'
      ],
      stripePriceId: process.env.STRIPE_BASIC_PRICE
    },
    {
      id: 'premium',
      name: 'الباقة المميزة',
      price: process.env.STRIPE_PREMIUM_PRICE / 100,
      features: [
        'إنشاء باركودات غير محدودة',
        'دعم فني مميز',
        'تخزين لمدة سنة',
        'تقارير متقدمة'
      ],
      stripePriceId: process.env.STRIPE_PREMIUM_PRICE
    },
    {
      id: 'enterprise',
      name: 'باقة المؤسسات',
      price: process.env.STRIPE_ENTERPRISE_PRICE / 100,
      features: [
        'جميع ميزات الباقة المميزة',
        'دعم فني على مدار الساعة',
        'تخزين دائم',
        'إدارة متعددة المستخدمين',
        'تخصيص متقدم'
      ],
      stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE
    }
  ];

  res.json({ success: true, plans });
});

// إنشاء جلسة دفع
router.post('/create-checkout-session', protect, async (req, res) => {
  try {
    const { priceId } = req.body;
    
    const session = await paymentService.createCheckoutSession(
      req.user.id,
      priceId,
      `${process.env.BASE_URL}/dashboard/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      `${process.env.BASE_URL}/dashboard/subscription/cancel`
    );

    // أعد رابط جلسة Stripe مباشرة لتسهيل إعادة التوجيه من الواجهة بدون Stripe.js
    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      success: false, 
      message: 'فشل في إنشاء جلسة الدفع' 
    });
  }
});

// (تم تعريف webhook أعلاه قبل JSON parser)

// إلغاء الاشتراك
router.post('/cancel-subscription', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('subscription');
    
    if (!user.subscription.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد اشتراك نشط للإلغاء'
      });
    }

    const subscription = await paymentService.cancelSubscription(
      user.subscription.stripeSubscriptionId
    );

    res.json({
      success: true,
      message: 'تم إلغاء الاشتراك بنجاح',
      data: subscription
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في إلغاء الاشتراك'
    });
  }
});

// استعادة الاشتراك
router.post('/reactivate-subscription', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('subscription');
    
    if (!user.subscription.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد اشتراك للإستعادة'
      });
    }

    const subscription = await paymentService.reactivateSubscription(
      user.subscription.stripeSubscriptionId
    );

    res.json({
      success: true,
      message: 'تم استعادة الاشتراك بنجاح',
      data: subscription
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في استعادة الاشتراك'
    });
  }
});

// الحصول على تاريخ الفواتير
router.get('/invoices', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.stripeCustomerId) {
      return res.json({ success: true, invoices: [] });
    }

    const invoices = await paymentService.getInvoices(user.stripeCustomerId);
    res.json({ success: true, invoices: invoices.data });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب الفواتير'
    });
  }
});

module.exports = router;