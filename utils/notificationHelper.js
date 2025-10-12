const Notification = require('../models/Notification');

/**
 * إنشاء إشعار ترحيبي للمستخدم الجديد
 */
async function createWelcomeNotification(userId) {
  try {
    await Notification.createNotification({
      userId,
      title: '🎉 مرحباً بك في نظام بٌـرهــان',
      message: 'نرحب بك في نظام التوقيع الرقمي برهان. يمكنك الآن البدء في إنشاء الباركودات المشفرة والتحقق من صحة الوثائق.',
      type: 'system',
      priority: 'medium',
      icon: 'fa-hand-sparkles',
      link: '/dashboard'
    });
    console.log(`✅ Welcome notification created for user: ${userId}`);
  } catch (error) {
    console.error('❌ Error creating welcome notification:', error);
  }
}

/**
 * إنشاء إشعار عند تفعيل الاشتراك
 */
async function createSubscriptionActivatedNotification(userId, durationDays, endDate) {
  try {
    await Notification.createNotification({
      userId,
      title: '✅ تم تفعيل اشتراكك بنجاح',
      message: `تم تفعيل اشتراكك لمدة ${durationDays} يوم. يمكنك الآن الاستفادة من جميع ميزات النظام حتى ${new Date(endDate).toLocaleDateString('ar-SA')}.`,
      type: 'subscription',
      priority: 'high',
      icon: 'fa-check-circle',
      link: '/dashboard',
      metadata: {
        daysRemaining: durationDays,
        endDate: endDate
      }
    });
    console.log(`✅ Subscription activated notification created for user: ${userId}`);
  } catch (error) {
    console.error('❌ Error creating subscription activated notification:', error);
  }
}

/**
 * إنشاء إشعار تحذيري قبل انتهاء الاشتراك (30 يوم)
 */
async function createSubscriptionWarning30Days(userId, endDate) {
  try {
    await Notification.createNotification({
      userId,
      title: '⚠️ تنبيه: اشتراكك سينتهي خلال 30 يوم',
      message: `سينتهي اشتراكك في ${new Date(endDate).toLocaleDateString('ar-SA')}. يرجى التواصل مع الإدارة لتجديد الاشتراك.`,
      type: 'warning',
      priority: 'medium',
      icon: 'fa-exclamation-triangle',
      link: '/dashboard/subscription',
      metadata: {
        daysRemaining: 30,
        endDate: endDate,
        actionRequired: true
      }
    });
    console.log(`✅ 30-day warning notification created for user: ${userId}`);
  } catch (error) {
    console.error('❌ Error creating 30-day warning notification:', error);
  }
}

/**
 * إنشاء إشعار تحذيري قبل انتهاء الاشتراك (7 أيام)
 */
async function createSubscriptionWarning7Days(userId, endDate) {
  try {
    await Notification.createNotification({
      userId,
      title: '🚨 عاجل: اشتراكك سينتهي خلال 7 أيام!',
      message: `تبقى 7 أيام فقط على انتهاء اشتراكك (${new Date(endDate).toLocaleDateString('ar-SA')}). تواصل مع الإدارة فوراً للتجديد لتجنب انقطاع الخدمة.`,
      type: 'warning',
      priority: 'urgent',
      icon: 'fa-hourglass-end',
      link: '/dashboard/subscription',
      metadata: {
        daysRemaining: 7,
        endDate: endDate,
        actionRequired: true
      }
    });
    console.log(`✅ 7-day warning notification created for user: ${userId}`);
  } catch (error) {
    console.error('❌ Error creating 7-day warning notification:', error);
  }
}

/**
 * إنشاء إشعار عند انتهاء الاشتراك
 */
async function createSubscriptionExpiredNotification(userId, endDate) {
  try {
    await Notification.createNotification({
      userId,
      title: '❌ انتهى اشتراكك',
      message: `انتهى اشتراكك في ${new Date(endDate).toLocaleDateString('ar-SA')}. لاستعادة الوصول إلى خدمات النظام، يرجى التواصل مع الإدارة لتجديد الاشتراك.`,
      type: 'subscription',
      priority: 'urgent',
      icon: 'fa-times-circle',
      link: '/subscription/expired',
      metadata: {
        daysRemaining: 0,
        endDate: endDate,
        actionRequired: true
      }
    });
    console.log(`✅ Subscription expired notification created for user: ${userId}`);
  } catch (error) {
    console.error('❌ Error creating subscription expired notification:', error);
  }
}

/**
 * إنشاء إشعار عند إنشاء باركود جديد
 */
async function createBarcodeCreatedNotification(userId, barcodeId) {
  try {
    await Notification.createNotification({
      userId,
      title: '✅ تم إنشاء باركود جديد',
      message: 'تم إنشاء الباركود المشفر بنجاح. يمكنك الآن طباعته أو مشاركته.',
      type: 'barcode',
      priority: 'low',
      icon: 'fa-qrcode',
      link: `/barcode/list`
    });
  } catch (error) {
    console.error('❌ Error creating barcode created notification:', error);
  }
}

/**
 * فحص جميع المستخدمين وإنشاء إشعارات الاشتراك التلقائية
 * يتم تشغيلها يومياً عبر Cron Job
 */
async function checkAndCreateSubscriptionNotifications() {
  try {
    const User = require('../models/User');
    
    // جلب جميع المستخدمين النشطين مع اشتراكات
    const users = await User.find({
      'subscription.status': 'active',
      'subscription.endDate': { $exists: true, $ne: null }
    });

    console.log(`🔍 Checking ${users.length} users for subscription notifications...`);

    for (const user of users) {
      const today = new Date();
      const endDate = new Date(user.subscription.endDate);
      const diffTime = endDate - today;
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // تحقق من عدم وجود إشعار مشابه في آخر يوم
      const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      // إشعار 30 يوم
      if (daysRemaining === 30) {
        const existingNotif = await Notification.findOne({
          userId: user._id,
          type: 'warning',
          'metadata.daysRemaining': 30,
          createdAt: { $gte: oneDayAgo }
        });
        
        if (!existingNotif) {
          await createSubscriptionWarning30Days(user._id, endDate);
        }
      }
      
      // إشعار 7 أيام
      else if (daysRemaining === 7) {
        const existingNotif = await Notification.findOne({
          userId: user._id,
          type: 'warning',
          'metadata.daysRemaining': 7,
          createdAt: { $gte: oneDayAgo }
        });
        
        if (!existingNotif) {
          await createSubscriptionWarning7Days(user._id, endDate);
        }
      }
      
      // إشعار الانتهاء
      else if (daysRemaining <= 0) {
        const existingNotif = await Notification.findOne({
          userId: user._id,
          type: 'subscription',
          'metadata.daysRemaining': 0,
          createdAt: { $gte: oneDayAgo }
        });
        
        if (!existingNotif) {
          await createSubscriptionExpiredNotification(user._id, endDate);
          
          // تحديث حالة الاشتراك
          user.subscription.status = 'expired';
          await user.save();
          console.log(`⏰ User ${user.username} subscription marked as expired`);
        }
      }
    }

    console.log('✅ Subscription notifications check completed');
  } catch (error) {
    console.error('❌ Error in checkAndCreateSubscriptionNotifications:', error);
  }
}

module.exports = {
  createWelcomeNotification,
  createSubscriptionActivatedNotification,
  createSubscriptionWarning30Days,
  createSubscriptionWarning7Days,
  createSubscriptionExpiredNotification,
  createBarcodeCreatedNotification,
  checkAndCreateSubscriptionNotifications
};
