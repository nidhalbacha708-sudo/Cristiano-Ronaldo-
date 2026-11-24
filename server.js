const express = require('express');
const path = require('path');
const app = express();

// تحديد المنفذ (يعمل على ريلواي Railway أو محلياً)
const PORT = process.env.PORT || 3000;

// السماح للسيرفر بقراءة الملفات الثابتة (HTML, CSS, JS) من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// مسار افتراضي احتياطي لتوجيه أي طلب لملف index.html داخل مجلد public
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
