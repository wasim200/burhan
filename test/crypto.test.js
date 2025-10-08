const { expect } = require('chai');
const {
  encrypt,
  decrypt,
  generateKeyPair,
  createDigitalSignature,
  verifyDigitalSignature
} = require('../utils/crypto');

describe('crypto helpers', function () {
  it('should encrypt and decrypt text correctly', function () {
    const text = 'هذا نص اختبار للوثيقة';
    const key = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8').toString('hex').slice(0, 64);
    const encrypted = encrypt(text, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).to.equal(text);
  });

  it('should sign and verify correctly', function () {
    const { publicKey, privateKey } = generateKeyPair();
    const content = 'محتوى المستند للاختبار';
    const signature = createDigitalSignature(content, privateKey);
    const valid = verifyDigitalSignature(content, signature, publicKey);
    expect(valid).to.be.true;
  });
});
