// سكريبت اختبار الإشعارات
// تشغيل: node test-notifications.js

require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');
const User = require('./models/User');

async function testNotifications() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/electronic-signature', {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB');

    // جلب آخر مستخدم مسجل
    const lastUser = await User.findOne().sort({ createdAt: -1 });
    
    if (!lastUser) {
      console.log('❌ No users found. Please register a user first.');
      process.exit(1);
    }

    console.log(`\n📋 Testing notifications for user: ${lastUser.username} (${lastUser.email})`);
    console.log(`   User ID: ${lastUser._id}`);

    // البحث عن الإشعارات
    const notifications = await Notification.find({ userId: lastUser._id }).sort({ createdAt: -1 });
    
    console.log(`\n📊 Total notifications: ${notifications.length}`);
    
    if (notifications.length === 0) {
      console.log('\n⚠️  No notifications found!');
      console.log('   Let\'s create a test notification...');
      
      // إنشاء إشعار تجريبي
      const testNotif = await Notification.create({
        userId: lastUser._id,
        title: '🧪 إشعار تجريبي',
        message: 'هذا إشعار تجريبي للتأكد من عمل النظام',
        type: 'info',
        priority: 'medium',
        icon: 'fa-flask'
      });
      
      console.log('   ✅ Test notification created:', testNotif._id);
      console.log('\n   Now visit: http://localhost:3000/notifications');
    } else {
      console.log('\n✅ Notifications found:');
      notifications.forEach((notif, index) => {
        console.log(`\n${index + 1}. ${notif.title}`);
        console.log(`   Message: ${notif.message}`);
        console.log(`   Type: ${notif.type} | Priority: ${notif.priority}`);
        console.log(`   Read: ${notif.isRead ? '✓' : '✗'}`);
        console.log(`   Created: ${notif.createdAt.toLocaleString('ar-SA')}`);
      });
      
      const unreadCount = notifications.filter(n => !n.isRead).length;
      console.log(`\n📬 Unread: ${unreadCount} / ${notifications.length}`);
    }

    // اختبار دالة getUnreadCount
    const unreadCount = await Notification.getUnreadCount(lastUser._id);
    console.log(`\n🔢 Unread count (from method): ${unreadCount}`);

    console.log('\n✅ Test completed!');
    console.log('   Visit: http://localhost:3000/notifications to see them in the UI');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// تشغيل الاختبار
testNotifications();
