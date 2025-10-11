const mongoose = require('mongoose');

const BarcodeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  documentName: {
    type: String,
    required: true
  },
  encryptedData: {
    type: String,
    required: true
  },
  // التوقيع الرقمي للنص الأصلي (إن وُجد)
  digitalSignature: {
    type: String
  },
  // مفتاح الناشر العام للمساعدة في التحقق
  ownerPublicKey: {
    type: String
  },
  originalHash: {
    type: String,
    required: true
  },
  // صورة الوثيقة (اختياري)
  documentImage: {
    type: String,  // سيتم تخزين الصورة كـ base64 أو مسار الملف
    required: false
  },
  documentImageName: {
    type: String,  // اسم الملف الأصلي
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  scannedCount: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('Barcode', BarcodeSchema);