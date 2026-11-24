const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة الملفات الثابتة (index.html, xvx-ts.js, admin.html) من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// قاعدة بيانات وهمية في الذاكرة لتخزين الأكواد (يمكنك تعديلها أو ربطها بقاعدة بيانات حقيقية لاحقاً)
// مفتاح تجريبي افتراضي صالح: CR7-2026-VIP0-TEST
let keysDB = {
  "CR72026VIP0TEST": {
    duration: 30 * 24 * 60 * 60 * 1000, // 30 يوماً بالميلي ثانية
    hwid: null,
    expiresAt: null,
    links: {
      aim_head: "happ://config/head",
      aim_neck: "happ://config/neck"
    }
  }
};

// API التحقق من الكود وتفعيله
app.post('/api/redeem', (req, res) => {
  const { code, hwid } = req.body;
  const cleanCode = (code || '').replace(/-/g, '').toUpperCase();

  const keyData = keysDB[cleanCode];
  if (!keyData) {
    return res.json({ ok: false, error: 'مفتاح الترخيص غير صالح أو غير موجود.' });
  }

  const now = Date.now();

  // إذا تم استخدام المفتاح مسبقاً على جهاز آخر
  if (keyData.hwid && keyData.hwid !== hwid) {
    return res.json({ ok: false, error: 'هذا المفتاح مرتبط بجهاز آخر ولا يمكن استخدامه.' });
  }

  // تفعيل المفتاح لأول مرة
  if (!keyData.hwid) {
    keyData.hwid = hwid;
    keyData.expiresAt = now + keyData.duration;
  }

  const left = keyData.expiresAt - now;
  if (left <= 0) {
    return res.json({ ok: false, error: 'انتهت صلاحية هذا المفتاح.' });
  }

  res.json({
    ok: true,
    left: left,
    links: keyData.links
  });
});

// API حالة الصيانة
app.get('/api/maint', (req, res) => {
  res.json({ on: false, msg: "النظام يعمل بشكل طبيعي." });
});

// API خاص بإنشاء أكواد جديدة (يُستخدم من لوحة الإدارة admin.html)
app.post('/api/admin/create', (req, res) => {
  const { adminPass, days } = req.body;
  // كلمة مرور بسيطة لحماية لوحة صنع الأكواد (تستطيع تغييرها هنا)
  if (adminPass !== "CR7ADMIN2026") {
    return res.json({ ok: false, error: 'كلمة مرور المشرف غير صحيحة!' });
  }

  // توليد كود عشوائي من 15 حرف
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomKey = "";
  for (let i = 0; i < 15; i++) {
    randomKey += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // تنسيق الكود بالشكل: XXXX-XXXX-XXXX-XXXX
  const formattedKey = randomKey.match(/.{1,4}/g).join('-');
  const durationMs = (Number(days) || 1) * 24 * 60 * 60 * 1000;

  keysDB[randomKey] = {
    duration: durationMs,
    hwid: null,
    expiresAt: null,
    links: {
      aim_head: "happ://config/head"
    }
  };

  res.json({ ok: true, key: formattedKey, days: days });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
