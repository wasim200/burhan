const cron = require('node-cron');
const { checkAndCreateSubscriptionNotifications } = require('./notificationHelper');
const Notification = require('../models/Notification');

/**
 * تشغيل المهام المجدولة
 */
function startScheduledTasks() {
  console.log('🚀 Starting scheduled tasks...');

  // فحص الاشتراكات وإنشاء إشعارات يومياً في الساعة 9 صباحاً
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Running daily subscription check at', new Date().toLocaleString());
    try {
      await checkAndCreateSubscriptionNotifications();
    } catch (error) {
      console.error('❌ Error in scheduled subscription check:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Riyadh"
  });

  // تنظيف الإشعارات القديمة أسبوعياً (كل يوم أحد في الساعة 2 صباحاً)
  cron.schedule('0 2 * * 0', async () => {
    console.log('🧹 Running weekly notification cleanup at', new Date().toLocaleString());
    try {
      await Notification.cleanOldNotifications();
    } catch (error) {
      console.error('❌ Error in scheduled notification cleanup:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Riyadh"
  });

  console.log('✅ Scheduled tasks started successfully');
  console.log('   - Daily subscription check: 9:00 AM');
  console.log('   - Weekly notification cleanup: Sunday 2:00 AM');
}

module.exports = { startScheduledTasks };
