#!/usr/bin/env node
/**
 * سكريبت لإنشاء إشعار تجريبي
 * الاستخدام: node create-test-notification.js [username]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('./models/Notification');
const User = require('./models/User');

const username = process.argv[2]; // اسم المستخدم من command line

async function createTestNotification() {
  try {
    console.log('🔄 الاتصال بقاعدة البيانات...');
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/electronic-signature',
      { serverSelectionTimeoutMS: 5000 }
    );
    console.log('✅ تم الاتصال بنجاح\n');

    // جلب المستخدم
    let user;
    if (username) {
      user = await User.findOne({ username });
      if (!user) {
        console.log(`❌ لم يتم العثور على مستخدم بالاسم: ${username}`);
        console.log('💡 جاري جلب آخر مستخدم مسجل...');
        user = await User.findOne().sort({ createdAt: -1 });
      }
    } else {
      user = await User.findOne().sort({ createdAt: -1 });
    }

    if (!user) {
      console.log('❌ لا يوجد مستخدمين في قاعدة البيانات!');
      console.log('💡 يرجى تسجيل حساب جديد أولاً.');
      process.exit(1);
    }

    console.log('👤 المستخدم:', user.username);
    console.log('📧 البريد:', user.email);
    console.log('🆔 ID:', user._id);
    console.log('');

    // إنشاء إشعار تجريبي
    const notification = await Notification.create({
      userId: user._id,
      title: '🧪 إشعار تجريبي - ' + new Date().toLocaleTimeString('ar-SA'),
      message: 'هذا إشعار تجريبي تم إنشاؤه يدوياً. إذا رأيته في الموقع، فهذا يعني أن نظام الإشعارات يعمل بشكل صحيح! ✅',
      type: 'info',
      priority: 'medium',
      icon: 'fa-flask',
      link: '/notifications'
    });

    console.log('✅ تم إنشاء الإشعار بنجاح!');
    console.log('🆔 Notification ID:', notification._id);
    console.log('📅 التاريخ:', notification.createdAt.toLocaleString('ar-SA'));
    console.log('');
    console.log('🌐 افتح المتصفح: http://localhost:3000/notifications');
    console.log('');

    // عرض إحصائيات
    const totalNotifications = await Notification.countDocuments({ userId: user._id });
    const unreadNotifications = await Notification.countDocuments({ userId: user._id, isRead: false });
    
    console.log('📊 الإحصائيات:');
    console.log(`   إجمالي الإشعارات: ${totalNotifications}`);
    console.log(`   غير المقروءة: ${unreadNotifications}`);
    console.log('');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error('');
    console.error('💡 تأكد من:');
    console.error('   1. MongoDB يعمل');
    console.error('   2. ملف .env موجود ويحتوي على MONGODB_URI');
    console.error('   3. قاعدة البيانات قابلة للوصول');
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 تم قطع الاتصال بقاعدة البيانات');
    process.exit(0);
  }
}

// تشغيل السكريبت
console.log('═══════════════════════════════════════');
console.log('🔔 إنشاء إشعار تجريبي');
console.log('═══════════════════════════════════════');
console.log('');

createTestNotification();
