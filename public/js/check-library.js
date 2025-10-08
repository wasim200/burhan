// ملف فحص بسيط للتأكد من تحميل المكتبة

console.log('🔍 فحص تحميل مكتبة Html5Qrcode...');

// الفحص 1: هل المكتبة موجودة؟
if (typeof Html5Qrcode !== 'undefined') {
    console.log('✅ المكتبة محملة بنجاح!');
    console.log('📦 نوع Html5Qrcode:', typeof Html5Qrcode);
} else {
    console.error('❌ المكتبة غير محملة!');
    console.error('🔧 الحلول المقترحة:');
    console.error('   1. تحقق من الإنترنت');
    console.error('   2. جرّب CDN بديل');
    console.error('   3. حمّل المكتبة محلياً');
}

// الفحص 2: هل يمكن استخدام الدوال؟
try {
    if (typeof Html5Qrcode !== 'undefined') {
        console.log('✅ يمكن استخدام Html5Qrcode.getCameras()');
    }
} catch (error) {
    console.error('❌ خطأ في استخدام المكتبة:', error);
}

// الفحص 3: معلومات البيئة
console.log('📊 معلومات البيئة:');
console.log('   - المتصفح:', navigator.userAgent.split(' ').pop());
console.log('   - HTTPS:', location.protocol === 'https:' ? 'نعم ✅' : 'لا ⚠️');
console.log('   - MediaDevices:', navigator.mediaDevices ? 'مدعوم ✅' : 'غير مدعوم ❌');
