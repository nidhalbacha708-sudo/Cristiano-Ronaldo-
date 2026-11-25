const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// كلمة مرور لوحة الإدارة (غيّرها كما تشاء أو أضف ADMIN_PASS في إعدادات Railway)
const ADMIN_PASSWORD = process.env.ADMIN_PASS || "CR7ADMIN2026";

// مسار حفظ البيانات: يدعم قرص التخزين الدائم في Railway (/data) أو المجلد الحالي
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : __dirname);
const DB_FILE = path.join(DATA_DIR, 'db.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('DB Load Error:', e);
    }
    return {
        keys: {
            "CR7ADMINDEMOKEY": {
                code: "CR7-ADMIN-DEMO-KEY",
                durationMs: 7 * 24 * 3600 * 1000,
                expiresAt: null,
                hwid: null
            }
        },
        maint: {
            on: false,
            msg: "نقوم بأعمال الصيانة. كل شيء متوقف مؤقتاً حتى نعود."
        },
        links: {
            aim_head: "",
            aim_neck: "",
            aim_shoulder: "",
            aim_upperchest: "",
            aim_lowerchest: "",
            aim_pelvis: "",
            Neck: ""
        }
    };
}

function saveDB(data) {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('DB Save Error:', e);
    }
}

let db = loadDB();

// بوابة التحقق من كلمة مرور الإدارة لجميع مسارات /api/admin
function requireAdmin(req, res, next) {
    const pass = req.headers['x-admin-pass'] || req.body.adminPass;
    if (pass !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: "كلمة مرور الإدارة غير صحيحة!" });
    }
    next();
}

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// 1. مسار حالة الصيانة
app.get('/api/maint', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        on: !!db.maint.on,
        msg: db.maint.msg
    });
});

// 2. مسار التحقق من المفتاح وربط الجهاز
app.post('/api/redeem', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    if (db.maint.on) {
        return res.json({
            ok: false,
            error: db.maint.msg || "الموقع تحت الصيانة حالياً."
        });
    }

    const rawCode = String(req.body.code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const hwid = String(req.body.hwid || '').trim();

    if (!rawCode || rawCode.length < 15) {
        return res.json({ ok: false, error: "أدخل مفتاح الترخيص كاملاً (15 خانة)." });
    }
    if (!hwid) {
        return res.json({ ok: false, error: "تعذّر التعرف على معرّف الجهاز." });
    }

    const record = db.keys[rawCode];
    if (!record) {
        return res.json({ ok: false, error: "مفتاح الترخيص غير صحيح أو غير موجود." });
    }

    const now = Date.now();

    if (!record.expiresAt) {
        record.expiresAt = now + record.durationMs;
        record.hwid = hwid;
        saveDB(db);
    } else {
        if (record.hwid && record.hwid !== hwid) {
            return res.json({ ok: false, error: "هذا المفتاح مرتبط بجهاز آخر ولا يمكن نقله." });
        }
        if (now >= record.expiresAt) {
            return res.json({ ok: false, error: "انتهت صلاحية المفتاح. لا يمكن استخدامه مرة أخرى." });
        }
    }

    const left = Math.max(0, record.expiresAt - now);

    return res.json({
        ok: true,
        left: left,
        links: db.links
    });
});

// 3. مسارات لوحة الإدارة (محمية بكلمة المرور)
app.get('/api/admin/settings', requireAdmin, (req, res) => {
    res.json({
        success: true,
        maint: db.maint,
        links: db.links,
        keys: Object.values(db.keys),
        storagePath: DB_FILE
    });
});

app.post('/api/admin/generate', requireAdmin, (req, res) => {
    const hours = parseFloat(req.body.hours) || 1;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const formattedKey = `CR7-${part()}-${part()}-${part()}`;
    const rawCode = formattedKey.replace(/-/g, '');
    const durationMs = Math.round(hours * 3600 * 1000);

    db.keys[rawCode] = {
        code: formattedKey,
        durationMs: durationMs,
        expiresAt: null,
        hwid: null
    };
    saveDB(db);

    res.json({ success: true, key: formattedKey, hours });
});

app.post('/api/admin/maintenance', requireAdmin, (req, res) => {
    db.maint.on = !!req.body.on;
    if (typeof req.body.msg === 'string' && req.body.msg.trim()) {
        db.maint.msg = req.body.msg.trim();
    }
    saveDB(db);
    res.json({ success: true, maint: db.maint });
});

app.post('/api/admin/links', requireAdmin, (req, res) => {
    const incoming = req.body.links || {};
    Object.keys(db.links).forEach(k => {
        if (typeof incoming[k] === 'string') {
            db.links[k] = incoming[k].trim();
        }
    });
    saveDB(db);
    res.json({ success: true, links: db.links });
});

app.post('/api/admin/key-action', requireAdmin, (req, res) => {
    const rawCode = String(req.body.code || '').replace(/-/g, '').toUpperCase();
    const action = req.body.action;

    if (!db.keys[rawCode]) {
        return res.json({ success: false, error: "الكود غير موجود" });
    }

    if (action === 'delete') {
        delete db.keys[rawCode];
    } else if (action === 'reset') {
        db.keys[rawCode].hwid = null;
    }
    saveDB(db);
    res.json({ success: true });
});

// تصدير واستيراد نسخة احتياطية كاملة (Backup / Restore)
app.get('/api/admin/backup', requireAdmin, (req, res) => {
    res.json({ success: true, backup: db });
});

app.post('/api/admin/restore', requireAdmin, (req, res) => {
    const incoming = req.body.backup;
    if (!incoming || typeof incoming !== 'object' || !incoming.keys || !incoming.links) {
        return res.json({ success: false, error: "ملف النسخة الاحتياطية غير صالح!" });
    }
    db = incoming;
    saveDB(db);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`CR7 Server running on port ${PORT} | DB: ${DB_FILE}`);
});
