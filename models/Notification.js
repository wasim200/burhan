const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'العنوان مطلوب'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'الرسالة مطلوبة'],
    trim: true
  },
  type: {
    type: String,
    enum: ['subscription', 'barcode', 'system', 'warning', 'info'],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  link: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    default: 'fa-bell'
  },
  metadata: {
    daysRemaining: Number,
    endDate: Date,
    actionRequired: Boolean
  }
}, {
  timestamps: true
});

// Index لتحسين الأداء
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

// دالة لإنشاء إشعار تلقائي
NotificationSchema.statics.createNotification = async function(data) {
  try {
    const notification = await this.create(data);
    console.log(`✅ Notification created for user: ${data.userId}`);
    return notification;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  }
};

// دالة للحصول على عدد الإشعارات غير المقروءة
NotificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({ userId, isRead: false });
};

// دالة لتعليم جميع الإشعارات كمقروءة
NotificationSchema.statics.markAllAsRead = async function(userId) {
  return await this.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true } }
  );
};

// دالة لحذف الإشعارات القديمة (أكثر من 30 يوم)
NotificationSchema.statics.cleanOldNotifications = async function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const result = await this.deleteMany({
    createdAt: { $lt: thirtyDaysAgo },
    isRead: true
  });
  
  console.log(`🧹 Cleaned ${result.deletedCount} old notifications`);
  return result;
};

module.exports = mongoose.model('Notification', NotificationSchema);
