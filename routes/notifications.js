const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// Middleware للتأكد من تسجيل المستخدم (يستخدم protect من middleware/auth.js)
async function requireAuth(req, res, next) {
  return protect(req, res, next);
}

// جميع routes تحتاج مصادقة
router.use(requireAuth);

// @route   GET /notifications
// @desc    عرض جميع إشعارات المستخدم
// @access  Private
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log('📋 Fetching notifications for user:', req.user.username, 'ID:', req.user._id);

    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Notification.countDocuments({ userId: req.user._id });
    const unreadCount = await Notification.getUnreadCount(req.user._id);

    console.log(`📊 Found ${total} notifications, ${unreadCount} unread`);

    res.locals.currentPage = 'notifications';
    res.render('notifications/index', {
      user: req.user,
      notifications,
      unreadCount,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).send(`
      <h1>خطأ في تحميل الإشعارات</h1>
      <p>${error.message}</p>
      <a href="/dashboard">العودة إلى لوحة التحكم</a>
    `);
  }
});

// @route   GET /notifications/unread-count
// @desc    الحصول على عدد الإشعارات غير المقروءة
// @access  Private
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user._id);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// @route   POST /notifications/:id/read
// @desc    تعليم إشعار كمقروء
// @access  Private
router.post('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود'
      });
    }

    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
      message: 'تم تعليم الإشعار كمقروء'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث الإشعار'
    });
  }
});

// @route   POST /notifications/mark-all-read
// @desc    تعليم جميع الإشعارات كمقروءة
// @access  Private
router.post('/mark-all-read', async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user._id);

    res.json({
      success: true,
      message: 'تم تعليم جميع الإشعارات كمقروءة'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث الإشعارات'
    });
  }
});

// @route   DELETE /notifications/:id
// @desc    حذف إشعار
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'الإشعار غير موجود'
      });
    }

    res.json({
      success: true,
      message: 'تم حذف الإشعار بنجاح'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف الإشعار'
    });
  }
});

// @route   DELETE /notifications
// @desc    حذف جميع الإشعارات المقروءة
// @access  Private
router.delete('/', async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      userId: req.user._id,
      isRead: true
    });

    res.json({
      success: true,
      message: `تم حذف ${result.deletedCount} إشعار`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting read notifications:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف الإشعارات'
    });
  }
});

module.exports = router;
