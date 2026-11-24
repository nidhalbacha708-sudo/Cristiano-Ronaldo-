const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// قاعدة بيانات وهمية لتخزين الأكواد وإعدادات الموقع
let generatedKeys = {
    "CR7-ADMIN-DEMO-KEY": { expiresAt: Date.now() + 7 * 24 * 3600 * 1000 } // مفتاح تجريبي لمدة أسبوع
};

let siteSettings = {
    maintenance: false,
    message: "الموقع تحت الصيانة حالياً لتحديث النظام. يرجى العودة لاحقاً!"
};

// 🛡️ Middleware للتحقق من وضع الصيانة قبل السماح بالدخول
app.use((req, res, next) => {
    // السماح بمرور طلبات لوحة التحكم ومسارات الـ API الخاصة بالإدارة وصيانة الموقع
    if (siteSettings.maintenance && !req.path.startsWith('/api/admin') && !req.path.includes('admin.html')) {
        if (req.path === '/api/verify') {
            return res.json({ success: false, message: siteSettings.message });
        }
    }
    next();
});

// 1. مسار التحقق من الكود (عند تسجيل دخول المستخدم)
app.post('/api/verify', (req, res) => {
    const { key } = req.body;
    
    if (key && key.startsWith("CR7") && generatedKeys[key]) {
        if (Date.now() < generatedKeys[key].expiresAt) {
            return res.json({ success: true, message: "تم تسجيل الدخول بنجاح!" });
        } else {
            return res.json({ success: false, message: "عذراً، هذا الكود انتهت صلاحيته." });
        }
    }
    res.json({ success: false, message: "المفتاح غير صالح أو غير موجود!" });
});

// 2. مسار توليد الأكواد (من لوحة التحكم)
app.post('/api/admin/generate', (req, res) => {
    const { hours } = req.body; // عدد الساعات المطلوبة
    
    const r1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const r2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const r3 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newKey = `CR7-${r1}-${r2}-${r3}`;
    
    // حساب وقت انتهاء الصلاحية بالمللي ثانية
    const durationMs = (hours || 1) * 3600 * 1000;
    generatedKeys[newKey] = { expiresAt: Date.now() + durationMs };

    res.json({ success: true, key: newKey, hours });
});

// 3. مسار التحكم بوضع الصيانة والرسالة
app.post('/api/admin/maintenance', (req, res) => {
    const { maintenance, message } = req.body;
    siteSettings.maintenance = !!maintenance;
    if (message) {
        siteSettings.message = message;
    }
    res.json({ success: true, siteSettings });
});

// 4. جلب حالة الموقع وإعداداته الحالية
app.get('/api/admin/settings', (req, res) => {
    res.json({ success: true, siteSettings, totalKeys: Object.keys(generatedKeys).length });
});

// مسار مفتاح Turnstile (كلاودفلير)
app.get('/api/ts-key', (req, res) => {
    res.json({ key: "1x00000000000000000000AA" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
