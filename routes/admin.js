const express = require('express');
const router = express.Router();
const User = require('../models/User');
const BankTransfer = require('../models/BankTransfer');
const Barcode = require('../models/Barcode');
const { protect, authorize } = require('../middleware/auth');

// جميع routes تحتاج إلى مصادقة وتفويض كمسؤول
// ملاحظة: middleware المصادقة يتم تطبيقه في app.js

// لوحة تحكم المسؤول الرئيسية
router.get('/dashboard', async (req, res) => {
  try {
    // إحصائيات النظام
    const totalUsers = await User.countDocuments();
    const totalTransfers = await BankTransfer.countDocuments();
    const pendingTransfers = await BankTransfer.countDocuments({ status: 'pending' });
    const totalBarcodes = await Barcode.countDocuments();
    
    // آخر التحويلات المعلقة
    const recentTransfers = await BankTransfer.find({ status: 'pending' })
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // آخر المستخدمين المسجلين
    const recentUsers = await User.find()
      .select('username email createdAt subscription')
      .sort({ createdAt: -1 })
      .limit(5);

    res.render('admin/dashboard', {
      user: req.user,
      stats: {
        totalUsers,
        totalTransfers,
        pendingTransfers,
        totalBarcodes
      },
      recentTransfers,
      recentUsers
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).render('error', {
      message: 'فشل في تحميل لوحة التحكم'
    });
  }
});

// إدارة المستخدمين
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    
    const query = search ? {
      $or: [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    } : {};
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
    
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);
    
    res.render('admin/users', {
      user: req.user,
      users,
      currentPage: page,
      totalPages,
      search,
      limit
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).render('error', {
      message: 'فشل في جلب بيانات المستخدمين'
    });
  }
});

// تحديث حالة المستخدم
router.post('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 'subscription.status': status },
      { new: true }
    );
    
    res.json({
      success: true,
      message: 'تم تحديث حالة المستخدم بنجاح',
      data: user
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث حالة المستخدم'
    });
  }
});

// حذف المستخدم
router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    // يمكنك أيضاً حذف جميع البيانات المرتبطة بالمستخدم هنا
    
    res.json({
      success: true,
      message: 'تم حذف المستخدم بنجاح'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف المستخدم'
    });
  }
});

// إدارة طلبات التحويل البنكي
router.get('/bank-transfers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || '';
    
    const query = status ? { status } : {};
    
    const transfers = await BankTransfer.find(query)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
    
    const totalTransfers = await BankTransfer.countDocuments(query);
    const totalPages = Math.ceil(totalTransfers / limit);
    
    res.render('admin/bank-transfers', {
      user: req.user,
      transfers,
      currentPage: page,
      totalPages,
      status,
      limit
    });
  } catch (error) {
    console.error('Error fetching bank transfers:', error);
    res.status(500).render('error', {
      message: 'فشل في جلب طلبات التحويل'
    });
  }
});

// الموافقة على تحويل بنكي
router.post('/bank-transfers/:id/approve', async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const bankTransferService = require('../services/bankTransferService');
    
    const result = await bankTransferService.approveBankTransfer(req.params.id, adminNotes);
    
    res.json({
      success: true,
      message: 'تم الموافقة على التحويل بنجاح',
      data: result
    });
  } catch (error) {
    console.error('Error approving bank transfer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'فشل في الموافقة على التحويل'
    });
  }
});

// رفض تحويل بنكي
router.post('/bank-transfers/:id/reject', async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const bankTransferService = require('../services/bankTransferService');
    
    const result = await bankTransferService.rejectBankTransfer(req.params.id, adminNotes);
    
    res.json({
      success: true,
      message: 'تم رفض التحويل بنجاح',
      data: result
    });
  } catch (error) {
    console.error('Error rejecting bank transfer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'فشل في رفض التحويل'
    });
  }
});

// إحصائيات النظام
router.get('/stats', async (req, res) => {
  try {
    // إحصائيات المستخدمين
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ 'subscription.status': 'active' });
    const pendingUsers = await User.countDocuments({ 'subscription.status': 'pending' });
    
    // إحصائيات التحويلات
    const totalTransfers = await BankTransfer.countDocuments();
    const pendingTransfers = await BankTransfer.countDocuments({ status: 'pending' });
    const approvedTransfers = await BankTransfer.countDocuments({ status: 'approved' });
    const rejectedTransfers = await BankTransfer.countDocuments({ status: 'rejected' });
    
    // إحصائيات الباركودات
    const totalBarcodes = await Barcode.countDocuments();
    const barcodesThisMonth = await Barcode.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });
    
    // الإيرادات (افتراضيًا)
    const revenue = {
      basic: approvedTransfers * 10,
      premium: approvedTransfers * 25,
      enterprise: approvedTransfers * 100,
      total: approvedTransfers * (10 + 25 + 100) // هذا مثال، يجب تعديله حسب الباقات الفعلية
    };
    
    res.render('admin/stats', {
      user: req.user,
      stats: {
        users: { total: totalUsers, active: activeUsers, pending: pendingUsers },
        transfers: { total: totalTransfers, pending: pendingTransfers, approved: approvedTransfers, rejected: rejectedTransfers },
        barcodes: { total: totalBarcodes, thisMonth: barcodesThisMonth },
        revenue
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).render('error', {
      message: 'فشل في جلب الإحصائيات'
    });
  }
});

// إدارة الباركودات
router.get('/barcodes', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    
    let query = {};
    if (search) {
      const users = await User.find({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      query = { userId: { $in: users.map(u => u._id) } };
    }
    
    const barcodes = await Barcode.find(query)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
    
    const totalBarcodes = await Barcode.countDocuments(query);
    const totalPages = Math.ceil(totalBarcodes / limit);
    
    res.render('admin/barcodes', {
      user: req.user,
      barcodes,
      currentPage: page,
      totalPages,
      search,
      limit
    });
  } catch (error) {
    console.error('Error fetching barcodes:', error);
    res.status(500).render('error', {
      message: 'فشل في جلب الباركودات'
    });
  }
});

// حذف الباركود
router.delete('/barcodes/:id', async (req, res) => {
  try {
    await Barcode.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'تم حذف الباركود بنجاح'
    });
  } catch (error) {
    console.error('Error deleting barcode:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في حذف الباركود'
    });
  }
});

module.exports = router;