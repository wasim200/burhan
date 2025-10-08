const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { 
  encryptForBarcode, 
  decryptBarcode, 
  createDigitalSignature,
  verifyDigitalSignature,
  generateEncryptionKey
} = require('../utils/crypto');
const Barcode = require('../models/Barcode');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ملاحظة: middleware المصادقة يتم تطبيقه في app.js

// حماية جميع مسارات الباركود
router.use(protect);

// صفحة إنشاء الباركود (GET) - ليتوافق مع الرابط في الهيدر
router.get('/create', (req, res) => {
  try {
    res.render('dashboard/create-barcode', { user: req.user });
  } catch (error) {
    console.error('Error rendering create barcode page:', error);
    res.status(500).render('error', { message: 'فشل في تحميل صفحة إنشاء الباركود' });
  }
});

// صفحة قراءة الباركود (GET)
router.get('/read', (req, res) => {
  try {
    res.render('dashboard/read-barcode-improved', { user: req.user });
  } catch (error) {
    console.error('Error rendering read barcode page:', error);
    res.status(500).render('error', { message: 'فشل في تحميل صفحة قراءة الباركود' });
  }
});

// إنشاء باركود مشفر
router.post('/create', async (req, res) => {
  try {
    const { documentContent, documentName } = req.body;
    const userId = req.user.id;

    // الحصول على مفتاح التشفير الخاص بالمستخدم
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // إذا لم يكن لدى المستخدم مفتاح تشفير، أنشئ واحداً وأدخله
    if (!user.encryptionKey) {
      user.encryptionKey = generateEncryptionKey();
      await user.save();
    }

    // تشفير البيانات وإنشاء الباركود
    const { encryptedData, documentHash } = encryptForBarcode(documentContent, user.encryptionKey);
    
    // إنشاء توقيع رقمي
    const digitalSignature = createDigitalSignature(documentContent, user.privateKey);

    // حفظ الباركود في قاعدة البيانات، مع التوقيع والمفتاح العام للناشر
    const newBarcode = new Barcode({
      userId,
      documentName,
      encryptedData,
      originalHash: documentHash,
      digitalSignature,
      ownerPublicKey: user.publicKey
    });

    await newBarcode.save();
    console.log('✅ Barcode created for user:', userId, '| Barcode ID:', newBarcode._id);

    // لتقليل كثافة رمز QR وجعل المسح أكثر موثوقية، سنشفر فقط معرف السجل
    // يمكن أيضًا استخدام شكل JSON {id: '<hex>'} لكن سنستخدم المعرف مباشرة لتبسيط القراءة
    const qrPayload = newBarcode._id.toString();
    const qrCodeData = await QRCode.toDataURL(qrPayload);

    res.render('dashboard/barcode-result', {
      success: true,
      qrCodeData,
      documentName,
      barcodeId: newBarcode._id,
      documentHash,
      createdAt: new Date()
    });

  } catch (error) {
    console.error('Error creating barcode:', error);
    res.status(500).render('dashboard/barcode-result', {
      success: false,
      message: 'فشل في إنشاء الباركود'
    });
  }
});

// قراءة وفك تشفير الباركود
router.post('/read', async (req, res) => {
  try {
    let { barcodeData } = req.body;
    const userId = req.user.id;

    // الحصول على مفتاح التشفير الخاص بالمستخدم
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // إذا لم يكن لدى المستخدم مفتاح تشفير، أنشئ واحداً وأدخله
    if (!user.encryptionKey) {
      user.encryptionKey = generateEncryptionKey();
      await user.save();
    }

    // دعم الشكلين: (1) البيانات المشفرة كاملة كما كانت سابقًا (2) معرّف السجل فقط داخل QR
    let barcodeRecord = null;
    let decryptedData = null;

    // حاول تفسير المدخل كـ JSON يحتوي على id
    let parsedId = null;
    try {
      const obj = JSON.parse(barcodeData);
      if (obj && typeof obj === 'object' && obj.id && /^[0-9a-fA-F]{24}$/.test(obj.id)) {
        parsedId = obj.id;
      }
    } catch (_) {
      // ليس JSON
    }

    // إذا لم يكن JSON صالح، تحقق إن كان Hex بطول 24 (ObjectId)
    if (!parsedId && /^[0-9a-fA-F]{24}$/.test(barcodeData)) {
      parsedId = barcodeData;
    }

    if (parsedId) {
      // جلب السجل من قاعدة البيانات عبر المعرّف والتحقق من الملكية
      barcodeRecord = await Barcode.findOne({ _id: parsedId, userId });
      if (!barcodeRecord) {
        return res.status(404).render('dashboard/read-result', {
          success: false,
          message: 'لم يتم العثور على الباركود لهذا المستخدم'
        });
      }
      // استخدم البيانات المشفرة المخزنة
      decryptedData = decryptBarcode(barcodeRecord.encryptedData, user.encryptionKey);
    } else {
      // الوضع القديم: النص المدخل هو البيانات المشفرة كاملة
      decryptedData = decryptBarcode(barcodeData, user.encryptionKey);
      // ابحث عن السجل المطابق لنفس المستخدم (اختياري)
      barcodeRecord = await Barcode.findOne({ 
        encryptedData: barcodeData,
        userId 
      });
    }

    let signatureValid = false;
    if (barcodeRecord) {
      // استخدم المفتاح العام المُخزّن للسجل إذا كان متوفراً، وإلا استخدم مفتاح المستخدم الحالي
      const pubKey = barcodeRecord.ownerPublicKey || user.publicKey;

      if (barcodeRecord.digitalSignature && pubKey) {
        signatureValid = verifyDigitalSignature(
          decryptedData.content,
          barcodeRecord.digitalSignature,
          pubKey
        );
      }

      // زيادة عداد المسح
      barcodeRecord.scannedCount += 1;
      await barcodeRecord.save();
    }

    res.render('dashboard/read-result', {
      success: true,
      documentData: decryptedData.content,
      documentName: barcodeRecord ? barcodeRecord.documentName : 'غير معروف',
      timestamp: decryptedData.timestamp,
      documentHash: decryptedData.hash,
      signatureValid,
      scannedCount: barcodeRecord ? barcodeRecord.scannedCount : 0
    });

  } catch (error) {
    console.error('Error reading barcode:', error);
    res.status(500).render('dashboard/read-result', {
      success: false,
      message: 'فشل في قراءة الباركود أو البيانات غير صالحة'
    });
  }
});

// الحصول على قائمة الباركودات الخاصة بالمستخدم فقط
router.get('/list', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // تحويل userId إلى ObjectId للتأكد من المقارنة الصحيحة
    const currentUserId = req.user.id || req.user._id;
    const userObjectId = mongoose.Types.ObjectId.isValid(currentUserId) 
      ? new mongoose.Types.ObjectId(currentUserId) 
      : currentUserId;

    console.log('🔍 Current User ID:', currentUserId);
    console.log('🔍 User ObjectId:', userObjectId);
    
    // جلب الباركودات الخاصة بالمستخدم الحالي فقط
    const barcodes = await Barcode.find({ userId: userObjectId })
      .sort({ timestamp: -1 })
      .lean();

    console.log('✅ Barcodes found for this user:', barcodes.length);
    
    // طباعة تفاصيل الباركودات للتحقق
    if (barcodes.length > 0) {
      console.log('📋 First barcode userId:', barcodes[0].userId);
      console.log('📋 Match check:', barcodes[0].userId.toString() === currentUserId.toString());
    }
    
    // التحقق من وجود باركودات بدون userId (بيانات قديمة)
    const barcodesWithoutUser = await Barcode.countDocuments({ userId: { $exists: false } });
    if (barcodesWithoutUser > 0) {
      console.log('⚠️ Warning:', barcodesWithoutUser, 'barcodes without userId found in database');
    }

    res.render('dashboard/barcode-list', {
      user: req.user,
      barcodes: barcodes || [],
      success: true
    });
  } catch (error) {
    console.error('❌ Error fetching barcodes:', error);
    res.status(500).render('dashboard/barcode-list', {
      user: req.user,
      barcodes: [],
      success: false,
      message: 'فشل في تحميل الباركودات'
    });
  }
});

// عرض باركود واحد
router.get('/view/:id', async (req, res) => {
  try {
    const barcode = await Barcode.findOne({ 
      _id: req.params.id,
      userId: req.user.id // التأكد من أن الباركود يخص المستخدم الحالي
    });

    if (!barcode) {
      return res.status(404).render('404', {
        user: req.user,
        message: 'الباركود غير موجود أو ليس لديك صلاحية الوصول إليه'
      });
    }

    // إنشاء QR Code للباركود
    const qrCodeData = await QRCode.toDataURL(barcode._id.toString());

    res.render('dashboard/barcode-view', {
      user: req.user,
      barcode: barcode,
      qrCodeData: qrCodeData
    });
  } catch (error) {
    console.error('❌ Error viewing barcode:', error);
    res.status(500).render('error', {
      user: req.user,
      message: 'حدث خطأ أثناء عرض الباركود'
    });
  }
});

// طباعة باركود
router.get('/print/:id', async (req, res) => {
  try {
    const barcode = await Barcode.findOne({ 
      _id: req.params.id,
      userId: req.user.id // التأكد من أن الباركود يخص المستخدم الحالي
    });

    if (!barcode) {
      return res.status(404).send('الباركود غير موجود أو ليس لديك صلاحية الوصول إليه');
    }

    // إنشاء QR Code للباركود
    const qrCodeData = await QRCode.toDataURL(barcode._id.toString());

    res.render('dashboard/barcode-print', {
      user: req.user,
      barcode: barcode,
      qrCodeData: qrCodeData
    });
  } catch (error) {
    console.error('❌ Error printing barcode:', error);
    res.status(500).send('حدث خطأ أثناء تحميل صفحة الطباعة');
  }
});

// حذف باركود
router.delete('/delete/:id', async (req, res) => {
  try {
    const barcode = await Barcode.findOneAndDelete({ 
      _id: req.params.id,
      userId: req.user.id // التأكد من أن الباركود يخص المستخدم الحالي
    });

    if (!barcode) {
      return res.status(404).json({
        success: false,
        message: 'الباركود غير موجود أو ليس لديك صلاحية حذفه'
      });
    }

    console.log('✅ Barcode deleted:', req.params.id, 'by user:', req.user.id);

    res.json({
      success: true,
      message: 'تم حذف الباركود بنجاح'
    });
  } catch (error) {
    console.error('❌ Error deleting barcode:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف الباركود'
    });
  }
});

// تغيير مفتاح التشفير
router.post('/change-encryption-key', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // إنشاء مفتاح تشفير جديد
    const newEncryptionKey = generateEncryptionKey();
    
    // هنا يجب إعادة تشفير جميع الباركودات القديمة بالمفتاح الجديد
    // (هذه عملية معقدة وقد تتطلب وقتاً طويلاً)
    
    user.encryptionKey = newEncryptionKey;
    await user.save();

    res.render('dashboard/encryption', {
      success: true,
      message: 'تم تغيير مفتاح التشفير بنجاح'
    });
  } catch (error) {
    console.error('Error changing encryption key:', error);
    res.status(500).render('dashboard/encryption', {
      success: false,
      message: 'فشل في تغيير مفتاح التشفير'
    });
  }
});

module.exports = router;