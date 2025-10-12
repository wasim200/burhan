// 🔧 نظام مسح الباركود المحسّن v2.3
// انتظار تحميل المكتبة والصفحة

function initBarcodeScanner() {
    // التحقق من تحميل المكتبة
    if (typeof Html5Qrcode === 'undefined') {
        console.error('❌ Html5Qrcode library not loaded yet, retrying...');
        setTimeout(initBarcodeScanner, 100);
        return;
    }

// نظام إدارة التبويبات
const tabs = document.querySelectorAll('.scan-method-tab');
const contents = document.querySelectorAll('.scan-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // إزالة active من جميع التبويبات
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        
        // تفعيل التبويب المختار
        tab.classList.add('active');
        document.getElementById(targetTab + '-content').classList.add('active');
        
        // إيقاف الكاميرا إذا تم تغيير التبويب
        if (targetTab !== 'camera' && scannerManager.isScanning) {
            scannerManager.stopScanner();
        }
    });
});

// نظام إدارة الكاميرا والمسح
const scannerManager = {
    html5QrcodeInstance: null,
    isScanning: false,
    cameras: [],
    
    elements: {
        startBtn: document.getElementById('startScanBtn'),
        stopBtn: document.getElementById('stopScanBtn'),
        cameraSelect: document.getElementById('cameraSelect'),
        textarea: document.getElementById('barcodeData'),
        form: document.getElementById('readForm'),
        statusEl: document.getElementById('scanStatus')
    },
    
    setStatus(msg, type = 'info') {
        this.elements.statusEl.innerHTML = `<div class="status-message ${type}">${msg}</div>`;
    },
    
    clearStatus() {
        this.elements.statusEl.innerHTML = '';
    },
    
    async loadCameras() {
        try {
            this.cameras = await Html5Qrcode.getCameras();
            this.elements.cameraSelect.innerHTML = '<option value="">ااختر الكاميرا...</option>';
            
            if (!this.cameras || this.cameras.length === 0) {
                this.setStatus('⚠️ لم يتم العثور على أي كاميرا على هذا الجهاز.', 'error');
                return false;
            }
            
            let preferredIndex = 0;
            this.cameras.forEach((cam, index) => {
                const opt = document.createElement('option');
                opt.value = cam.id;
                opt.textContent = cam.label || `كاميرا ${index + 1}`;
                this.elements.cameraSelect.appendChild(opt);
                
                // تفضيل الكاميرا الخلفية
                if (/back|rear|environment/i.test(cam.label)) {
                    preferredIndex = index;
                }
            });
            
            this.elements.cameraSelect.selectedIndex = preferredIndex + 1;
            return true;
        } catch (error) {
            console.error('Failed to load cameras:', error);
            this.setStatus('❌ تعذر الوصول إلى الكاميرات. تأكد من منح الأذونات.', 'error');
            return false;
        }
    },
    
    async startScanner() {
        if (this.isScanning) {
            this.setStatus('⚠️ المسح قيد التشغيل بالفعل.', 'info');
            return;
        }
        
        try {
            // تحميل الكاميرات إذا لم يتم تحميلها
            if (this.cameras.length === 0) {
                const loaded = await this.loadCameras();
                if (!loaded) return;
            }
            
            const selectedId = this.elements.cameraSelect.value;
            if (!selectedId) {
                this.setStatus('⚠️ يرجى اختيار كاميرا أولاً.', 'error');
                return;
            }
            
            this.clearStatus();
            this.setStatus('⏳ جارٍ تشغيل الكاميرا...', 'info');
            
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };
            
            this.html5QrcodeInstance = new Html5Qrcode('qr-reader');
            
            await this.html5QrcodeInstance.start(
                selectedId,
                config,
                (decodedText) => this.onScanSuccess(decodedText),
                (error) => { /* تجاهل أخطاء المسح المتكررة */ }
            );
            
            this.isScanning = true;
            this.elements.startBtn.style.display = 'none';
            this.elements.stopBtn.style.display = 'inline-block';
            this.setStatus('✅ المسح نشط... وجّه الكاميرا نحو رمز QR', 'success');
            
        } catch (error) {
            console.error('Failed to start scanner:', error);
            this.setStatus(`❌ فشل تشغيل الكاميرا: ${error.message || 'خطأ غير معروف'}`, 'error');
            this.isScanning = false;
        }
    },
    
    async stopScanner() {
        if (!this.html5QrcodeInstance || !this.isScanning) return;
        
        try {
            await this.html5QrcodeInstance.stop();
            this.html5QrcodeInstance.clear();
        } catch (error) {
            console.error('Error stopping scanner:', error);
        }
        
        this.isScanning = false;
        this.elements.startBtn.style.display = 'inline-block';
        this.elements.stopBtn.style.display = 'none';
        this.setStatus('⏸️ تم إيقاف المسح.', 'info');
    },
    
    onScanSuccess(decodedText) {
        this.elements.textarea.value = decodedText;
        this.stopScanner();
        this.setStatus('✅ تم المسح بنجاح! جارٍ إرسال البيانات...', 'success');
        
        // التبديل إلى تبويب الإدخال اليدوي لعرض النتيجة
        tabs[0].click();
        
        // إرسال النموذج تلقائياً
        setTimeout(() => this.elements.form.submit(), 500);
    }
};

// ربط أحداث الكاميرا
scannerManager.elements.startBtn.addEventListener('click', () => scannerManager.startScanner());
scannerManager.elements.stopBtn.addEventListener('click', () => scannerManager.stopScanner());

// نظام رفع ومسح الصور - محسّن ✅
const imageScanner = {
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('qrImageInput'),
    scanBtn: document.getElementById('scanImageBtn'),
    fileInfo: document.getElementById('fileInfo'),
    fileName: document.getElementById('fileName'),
    clearBtn: document.getElementById('clearFileBtn'),
    changeImageBtn: document.getElementById('changeImageBtn'),
    imagePreviewContainer: document.getElementById('imagePreviewContainer'),
    imagePreview: document.getElementById('imagePreview'),
    statusEl: document.getElementById('imageStatus'),
    selectedFile: null,
    
    init() {
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.scanBtn.addEventListener('click', () => this.scanImage());
        this.clearBtn.addEventListener('click', () => this.clearFile());
        this.changeImageBtn.addEventListener('click', () => this.changeImage());
        
        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });
        
        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });
        
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.fileInput.files = e.dataTransfer.files;
                this.handleFileSelect({ target: this.fileInput });
            }
        });
    },
    
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            this.setStatus('❌ يرجى اختيار ملف صورة صالح.', 'error');
            return;
        }
        
        this.selectedFile = file;
        this.fileName.textContent = file.name;
        
        // عرض معاينة الصورة
        this.showImagePreview(file);
        
        this.fileInfo.style.display = 'block';
        this.clearStatus();
    },
    
    showImagePreview(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            this.imagePreview.src = e.target.result;
            this.uploadArea.style.display = 'none';
            this.fileInfo.style.display = 'none';
            this.imagePreviewContainer.classList.add('active');
            console.log('✅ Image preview loaded successfully');
        };
        
        reader.onerror = () => {
            this.setStatus('❌ فشل تحميل معاينة الصورة', 'error');
            console.error('Failed to load image preview');
        };
        
        reader.readAsDataURL(file);
    },
    
    changeImage() {
        this.fileInput.click();
    },
    
    clearFile() {
        this.selectedFile = null;
        this.fileInput.value = '';
        this.fileInfo.style.display = 'none';
        this.imagePreviewContainer.classList.remove('active');
        this.uploadArea.style.display = 'block';
        this.imagePreview.src = '';
        this.clearStatus();
    },
    
    // 🔧 الدالة المحسّنة لمسح الصور v2.2
    async scanImage() {
        if (!this.selectedFile) {
            this.setStatus('⚠️ يرجى اختيار صورة أولاً.', 'error');
            return;
        }
        
        this.clearStatus();
        this.setStatus('⏳ جارٍ تحليل الصورة...', 'info');
        this.scanBtn.disabled = true;
        
        // المحاولة 1: استخدام Html5Qrcode.scanFileV2 (الطريقة الأحدث)
        try {
            const result = await Html5Qrcode.scanFile(this.selectedFile, true);
            
            scannerManager.elements.textarea.value = result;
            this.setStatus('✅ تم استخراج البيانات بنجاح! جارٍ إرسال النموذج...', 'success');
            tabs[0].click();
            setTimeout(() => scannerManager.elements.form.submit(), 500);
            return;
            
        } catch (error1) {
            console.warn('Method 1 failed:', error1);
        }
        
        // المحاولة 2: استخدام عنصر مؤقت منفصل
        let tempDiv = null;
        try {
            tempDiv = document.createElement('div');
            tempDiv.id = 'temp-qr-scanner-' + Date.now();
            tempDiv.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
            document.body.appendChild(tempDiv);
            
            const html5QrCode = new Html5Qrcode(tempDiv.id);
            const decodedText = await html5QrCode.scanFile(this.selectedFile, true);
            
            if (tempDiv && document.body.contains(tempDiv)) {
                document.body.removeChild(tempDiv);
            }
            
            scannerManager.elements.textarea.value = decodedText;
            this.setStatus('✅ تم استخراج البيانات (المحاولة 2)!', 'success');
            tabs[0].click();
            setTimeout(() => scannerManager.elements.form.submit(), 500);
            return;
            
        } catch (error2) {
            console.warn('Method 2 failed:', error2);
            if (tempDiv && document.body.contains(tempDiv)) {
                document.body.removeChild(tempDiv);
            }
        }
        
        // المحاولة 3: معالجة الصورة باستخدام Canvas
        try {
            this.setStatus('⏳ جارٍ المحاولة بطريقة متقدمة...', 'info');
            await this.scanImageAlternative();
            
        } catch (error3) {
            console.error('All methods failed:', error3);
            this.setStatus(
                `❌ فشل قراءة رمز QR من الصورة بعد 3 محاولات.<br>` +
                `التفاصيل: ${error3.message || 'غير معروف'}<br><br>` +
                `💡 نصائح:<br>` +
                `• تأكد من أن الصورة تحتوي على رمز QR واضح<br>` +
                `• جرّب قص الصورة لتحتوي على الرمز فقط (بدون حواف)<br>` +
                `• استخدم صورة بجودة عالية (PNG أفضل من JPG)<br>` +
                `• تأكد من وجود تباين جيد (QR أسود على خلفية بيضاء)<br>` +
                `• أو جرّب خيار "مسح بالكاميرا" مباشرة`, 
                'error'
            );
            this.scanBtn.disabled = false;
        }
    },
    
    // طريقة بديلة لمسح الصور باستخدام معالجة canvas
    async scanImageAlternative() {
        this.setStatus('⏳ جارٍ المحاولة بطريقة بديلة...', 'info');
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const img = new Image();
                    
                    img.onload = async () => {
                        try {
                            // إنشاء canvas لمعالجة الصورة
                            const canvas = document.createElement('canvas');
                            const maxSize = 1500; // حد أقصى للحجم لتحسين الأداء
                            
                            let width = img.width;
                            let height = img.height;
                            
                            // تصغير الصورة إذا كانت كبيرة جداً
                            if (width > maxSize || height > maxSize) {
                                if (width > height) {
                                    height = (height / width) * maxSize;
                                    width = maxSize;
                                } else {
                                    width = (width / height) * maxSize;
                                    height = maxSize;
                                }
                            }
                            
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            // محاولة المسح باستخدام canvas
                            const tempDiv2 = document.createElement('div');
                            tempDiv2.id = 'temp-canvas-scanner-' + Date.now();
                            tempDiv2.style.display = 'none';
                            document.body.appendChild(tempDiv2);
                            
                            const scanner = new Html5Qrcode(tempDiv2.id);
                            
                            // تحويل canvas إلى blob
                            canvas.toBlob(async (blob) => {
                                try {
                                    const processedFile = new File([blob], 'qr-processed.png', { 
                                        type: 'image/png' 
                                    });
                                    const result = await scanner.scanFile(processedFile, true);
                                    
                                    // تنظيف
                                    if (document.body.contains(tempDiv2)) {
                                        document.body.removeChild(tempDiv2);
                                    }
                                    
                                    scannerManager.elements.textarea.value = result;
                                    this.setStatus('✅ تم الاستخراج بنجاح (طريقة بديلة)!', 'success');
                                    tabs[0].click();
                                    setTimeout(() => scannerManager.elements.form.submit(), 500);
                                    resolve(result);
                                } catch (err) {
                                    if (document.body.contains(tempDiv2)) {
                                        document.body.removeChild(tempDiv2);
                                    }
                                    reject(err);
                                }
                            }, 'image/png', 0.95);
                        } catch (err) {
                            reject(err);
                        }
                    };
                    
                    img.onerror = () => reject(new Error('فشل تحميل الصورة'));
                    img.src = e.target.result;
                } catch (err) {
                    reject(err);
                }
            };
            
            reader.onerror = () => reject(new Error('فشل قراءة الملف'));
            reader.readAsDataURL(this.selectedFile);
        });
    },
    
    setStatus(msg, type = 'info') {
        this.statusEl.innerHTML = `<div class="status-message ${type}">${msg}</div>`;
    },
    
    clearStatus() {
        this.statusEl.innerHTML = '';
    }
};

// تهيئة نظام الصور
imageScanner.init();

// إيقاف الكاميرا عند مغادرة الصفحة
window.addEventListener('beforeunload', () => {
    if (scannerManager.isScanning) {
        scannerManager.stopScanner();
    }
});

console.log('✅ نظام مسح الباركود المحسّن جاهز! (الإصدار 2.3 - Fixed)');

} // نهاية initBarcodeScanner

// بدء التشغيل عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBarcodeScanner);
} else {
    initBarcodeScanner();
}
