const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'keys.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// تحميل البيانات من ملف محلي أو إنشاء بيانات افتراضية
let db = {
    keys: {
        "CR7-ADMIN-DEMO-KEY": {
            expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
            deviceId: null
        }
    },
    siteSettings: {
        maintenance: false,
        message: "الموقع تحت الصيانة حالياً لتحديث النظام. يرجى العودة لاحقاً!"
    }
};

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
        console.error("خطأ في قراءة قاعدة البيانات:", err);
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error("خطأ في حفظ قاعدة البيانات:", err);
    }
}

// 1. مسار فحص حالة الصيانة (تطلبه الواجهة تلقائياً)
app.get('/api/maint', (req, res) => {
    res.json({
        maintenance: db.siteSettings.maintenance,
        message: db.siteSettings.message
    });
});

// 2. مسار التحقق وتفعيل المفتاح (/api/redeem وأيضاً /api/verify للاحتياط)
const handleRedeem = (req, res) => {
    if (db.siteSettings.maintenance) {
        return res.status(403).json({ success: false, message: db.siteSettings.message });
    }

    const key = (req.body.key || req.body.license || req.body.code || "").trim().toUpperCase();
    const deviceId = req.body.deviceId || req.body.hwid || req.headers['user-agent'] || "unknown";

    if (!key || !db.keys[key]) {
        return res.status(400).json({ success: false, message: "المفتاح غير صالح أو غير موجود!" });
    }

    const keyData = db.keys[key];

    // التحقق من انتهاء الصلاحية
    if (Date.now() > keyData.expiresAt) {
        return res.status(403).json({ success: false, message: "عذراً، هذا الكود انتهت صلاحيته." });
    }

    // التحقق من ارتباط المفتاح بجهاز واحد
    if (keyData.deviceId && keyData.deviceId !== deviceId) {
        return res.status(403).json({ success: false, message: "هذا المفتاح مرتبط بجهاز آخر بالفعل!" });
    }

    // ربط المفتاح بالجهاز عند أول دخول
    if (!keyData.deviceId) {
        keyData.deviceId = deviceId;
        saveDB();
    }

    return res.json({
        success: true,
        valid: true,
        message: "تم تسجيل الدخول بنجاح!",
        expiresAt: keyData.expiresAt
    });
};

app.post('/api/redeem', handleRedeem);
app.post('/api/verify', handleRedeem);

// 3. مسار توليد الأكواد (من لوحة التحكم)
app.post('/api/admin/generate', (req, res) => {
    const { hours } = req.body;
    const r1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const r2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const r3 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newKey = `CR7-${r1}-${r2}-${r3}`;

    const durationMs = (Number(hours) || 1) * 3600 * 1000;
    db.keys[newKey] = {
        expiresAt: Date.now() + durationMs,
        deviceId: null
    };
    saveDB();

    res.json({ success: true, key: newKey, hours });
});

// 4. مسار التحكم بوضع الصيانة والرسالة
app.post('/api/admin/maintenance', (req, res) => {
    const { maintenance, message } = req.body;
    db.siteSettings.maintenance = !!maintenance;
    if (message) {
        db.siteSettings.message = message;
    }
    saveDB();
    res.json({ success: true, siteSettings: db.siteSettings });
});

// 5. جلب حالة الموقع وإعداداته الحالية
app.get('/api/admin/settings', (req, res) => {
    res.json({
        success: true,
        siteSettings: db.siteSettings,
        totalKeys: Object.keys(db.keys).length
    });
});

// 6. مسار مفتاح Turnstile (كلاودفلير)
app.get('/api/ts-key', (req, res) => {
    res.json({ key: "1x00000000000000000000AA" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
