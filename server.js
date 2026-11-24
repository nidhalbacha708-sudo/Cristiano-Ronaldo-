const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// قراءة وحفظ قاعدة البيانات في ملف db.json
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
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('DB Save Error:', e);
    }
}

let db = loadDB();

// السماح بقراءة الملفات من المجلد الرئيسي ومجلد public
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// 1. مسار الصيانة المتوافق مع index.html
app.get('/api/maint', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        on: !!db.maint.on,
        msg: db.maint.msg
    });
});

// 2. مسار التحقق من المفتاح وربط الجهاز المتوافق مع index.html
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

// 3. جلب الإعدادات للوحة التحكم admin.html
app.get('/api/admin/settings', (req, res) => {
    res.json({
        success: true,
        maint: db.maint,
        links: db.links,
        keys: Object.values(db.keys)
    });
});

// 4. توليد كود جديد
app.post('/api/admin/generate', (req, res) => {
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

// 5. تحديث الصيانة
app.post('/api/admin/maintenance', (req, res) => {
    db.maint.on = !!req.body.on;
    if (typeof req.body.msg === 'string' && req.body.msg.trim()) {
        db.maint.msg = req.body.msg.trim();
    }
    saveDB(db);
    res.json({ success: true, maint: db.maint });
});

// 6. حفظ روابط Happ
app.post('/api/admin/links', (req, res) => {
    const incoming = req.body.links || {};
    Object.keys(db.links).forEach(k => {
        if (typeof incoming[k] === 'string') {
            db.links[k] = incoming[k].trim();
        }
    });
    saveDB(db);
    res.json({ success: true, links: db.links });
});

// 7. حذف كود أو فك الجهاز
app.post('/api/admin/key-action', (req, res) => {
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

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
