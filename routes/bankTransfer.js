const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const bankTransferService = require('../services/bankTransferService');
const { protect, authorize } = require('../middleware/auth');

// إعداد multer لتحميل الصور
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/receipts/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB كحد أقصى
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('يسمح فقط بتحميل ملفات الصور (JPEG, JPG, PNG) أو PDF'));
    }
  }
});

// إرسال طلب تحويل بنكي جديد
router.post('/submit', protect, upload.single('receiptImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحميل صورة إيصال التحويل'
      });
    }

    const transferData = {
      plan: req.body.plan,
      bankName: req.body.bankName,
      accountNumber: req.body.accountNumber,
      transferDate: req.body.transferDate
    };

    const result = await bankTransferService.createBankTransfer(
      req.user.id,
      transferData,
      '/uploads/receipts/' + req.file.filename
    );

    res.json({
      success: true,
      message: 'تم إرسال طلب التحويل بنجاح، في انتظار المراجعة',
      data: result
    });
  } catch (error) {
    console.error('Error submitting bank transfer:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'فشل في إرسال طلب التحويل'
    });
  }
});

// الحصول على طلبات التحويل الخاصة بالمستخدم
router.get('/my-transfers', protect, async (req, res) => {
  try {
    const transfers = await bankTransferService.getUserBankTransfers(req.user.id);
    res.json({
      success: true,
      data: transfers
    });
  } catch (error) {
    console.error('Error fetching user bank transfers:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب طلبات التحويل'
    });
  }
});

// الحصول على جميع طلبات التحويل (للمسؤولين فقط)
router.get('/admin/transfers', protect, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const transfers = await bankTransferService.getBankTransfers(status);
    res.json({
      success: true,
      data: transfers
    });
  } catch (error) {
    console.error('Error fetching bank transfers:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب طلبات التحويل'
    });
  }
});

// الموافقة على تحويل بنكي (للمسؤولين فقط)
router.post('/admin/approve/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { adminNotes } = req.body;
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

// رفض تحويل بنكي (للمسؤولين فقط)
router.post('/admin/reject/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { adminNotes } = req.body;
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

// الحصول على إحصائيات التحويلات (للمسؤولين فقط)
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const stats = await bankTransferService.getBankTransferStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching bank transfer stats:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب إحصائيات التحويلات'
    });
  }
});

module.exports = router;    