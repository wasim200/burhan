const crypto = require('crypto');
const CryptoJS = require('crypto-js');

// مفتاح تشفير رئيسي (يجب تخزينه بشكل آمن في البيئة)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_encryption_key_32_chars_long!';
const IV_LENGTH = 16; // طول متجه التهيئة لـ AES

function getKeyBuffer(key) {
  // if Buffer already
  if (Buffer.isBuffer(key)) return key;
  if (typeof key !== 'string') key = String(key);

  // if hex 64 chars -> treat as 32-byte hex
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, 'hex');
  }

  // if 32-char string -> utf8
  if (key.length === 32) {
    return Buffer.from(key, 'utf8');
  }

  // fallback: derive 32-byte key from passphrase
  return crypto.createHash('sha256').update(key).digest();
}

// دالة لتشفير النص باستخدام AES-256-CBC
function encrypt(text, key = ENCRYPTION_KEY) {
  try {
  const iv = crypto.randomBytes(IV_LENGTH);
  const keyBuf = getKeyBuffer(key);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Error in encryption:', error);
    throw new Error('Encryption failed');
  }
}

// دالة لفك تشفير النص باستخدام AES-256-CBC
function decrypt(text, key = ENCRYPTION_KEY) {
  try {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const keyBuf = getKeyBuffer(key);
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Error in decryption:', error);
    throw new Error('Decryption failed');
  }
}

// دالة لإنشاء هاش SHA-256
function createHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// دالة لتوقيع البيانات رقمياً
function signData(data, privateKey) {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKey, 'hex');
}

// دالة للتحقق من التوقيع الرقمي
function verifySignature(data, signature, publicKey) {
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  verify.end();
  return verify.verify(publicKey, signature, 'hex');
}

// دالة لإنشاء مفتاح تشفير فريد للمستخدم
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex'); // 256 بت
}

// دالة لإنشاء زوج من المفاتيح (عام/خاص) للتوقيع الرقمي
function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
}

// دالة لتشفير البيانات للمباركود (تجميع جميع البيانات)
function encryptForBarcode(documentData, userEncryptionKey) {
  try {
    const timestamp = new Date().toISOString();
    const documentHash = createHash(documentData + timestamp);
    
    const dataToEncrypt = {
      content: documentData,
      hash: documentHash,
      timestamp: timestamp,
      version: '1.0'
    };
    
    const encryptedData = encrypt(JSON.stringify(dataToEncrypt), userEncryptionKey);
    return {
      encryptedData,
      documentHash
    };
  } catch (error) {
    console.error('Error encrypting for barcode:', error);
    throw new Error('Barcode encryption failed');
  }
}

// دالة لفك تشفير بيانات الباركود
function decryptBarcode(encryptedData, userEncryptionKey) {
  try {
    const decryptedData = decrypt(encryptedData, userEncryptionKey);
    const data = JSON.parse(decryptedData);
    
    // التحقق من صحة الهاش
    const currentHash = createHash(data.content + data.timestamp);
    if (currentHash !== data.hash) {
      throw new Error('Data integrity check failed');
    }
    
    return data;
  } catch (error) {
    console.error('Error decrypting barcode:', error);
    throw new Error('Barcode decryption failed');
  }
}

// دالة لإنشاء توقيع رقمي للوثيقة
function createDigitalSignature(documentData, privateKey) {
  const documentHash = createHash(documentData);
  return signData(documentHash, privateKey);
}

// دالة للتحقق من التوقيع الرقمي للوثيقة
function verifyDigitalSignature(documentData, signature, publicKey) {
  const documentHash = createHash(documentData);
  return verifySignature(documentHash, signature, publicKey);
}

module.exports = {
  encrypt,
  decrypt,
  createHash,
  signData,
  verifySignature,
  generateEncryptionKey,
  generateKeyPair,
  encryptForBarcode,
  decryptBarcode,
  createDigitalSignature,
  verifyDigitalSignature
};