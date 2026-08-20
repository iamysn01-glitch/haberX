require('dotenv').config(); // Sifre kasamizi ( .env ) aktif eder
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose'); // Bulut Veritabani
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2; // Bulut Fotograf

const app = express();
const port = process.env.PORT || 3000;

// --- 1. MONGODB BAGLANTISI ---
// DIKKAT: Sifreni asagida KENDISIFRENIYAZ yazan yere tirnaklari silmeden yaz!
mongoose.connect("mongodb+srv://iamysn01_db_user:Mami0234.@cluster0.9o3cjou.mongodb.net/haberx?appName=Cluster0", { family: 4 })
  .then(() => console.log("? MongoDB Bulut Veritabanina Basariyla Baglanildi!"))
  .catch(err => console.error("? MongoDB Baglanti Hatasi:", err));

// Veritabani Haber Sablonu
const newsSchema = new mongoose.Schema({
    title: String,
    category: String,
    summary: String,
    image_url: String,
    type: String
}, { timestamps: true });
const News = mongoose.model('News', newsSchema);

// --- 2. CLOUDINARY AYARLARI ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { 
      folder: 'haber_sitesi', 
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'] 
  },
});
const upload = multer({ storage: storage });

// --- 3. SUNUCU AYARLARI ---
app.use(session({
    secret: 'haber-sitesi-cok-gizli-anahtar',
    resave: false,
    saveUninitialized: false
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Admin Paneli Korumasi
app.use('/admin.html', (req, res, next) => {
    if (req.session && req.session.girisYapildi) next(); 
    else res.redirect('/login.html'); 
});

function yetkiKontrolu(req, res, next) {
    if (req.session && req.session.girisYapildi) next();
    else res.status(401).json({ error: "Giris yapmalisiniz." });
}

// --- 4. API (ILETISIM) KODLARI ---

// Giris Yapma (Login)
app.post('/api/login', (req, res) => {
    if (req.body.kadi === 'admin' && req.body.sifre === '12345') {
        req.session.girisYapildi = true;
        res.json({ basarili: true });
    } else res.status(401).json({ basarili: false, mesaj: "Hatali giris!" });
});

// Çikis Yapma (Logout)
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ basarili: true });
});

// Fotograf Yükleme (Artik Cloudinary'e yükleniyor)
app.post('/api/upload', yetkiKontrolu, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Lütfen fotograf seçin." });
    res.json({ imageUrl: req.file.path }); 
});

// Tüm Haberleri Getirme
app.get('/api/news', async (req, res) => {
    try {
        const news = await News.find().sort({ _id: -1 });
        // Eski sisteme uymasi için _id'yi id yapiyoruz
        const formattedNews = news.map(n => ({ 
            id: n._id, title: n.title, category: n.category, 
            summary: n.summary, image_url: n.image_url, type: n.type 
        }));
        res.json({ news: formattedNews });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Tek Bir Haberi Getirme
app.get('/api/news/:id', async (req, res) => {
    try {
        const n = await News.findById(req.params.id);
        res.json({ 
            id: n._id, title: n.title, category: n.category, 
            summary: n.summary, image_url: n.image_url, type: n.type 
        });
    } catch (err) { res.status(404).json({ error: "Haber bulunamadi" }); }
});

// Yeni Haber Ekleme
app.post('/api/news', yetkiKontrolu, async (req, res) => {
    try {
        const yeniHaber = new News(req.body);
        await yeniHaber.save();
        res.json({ message: "Haber basariyla eklendi!", id: yeniHaber._id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Haber Silme
app.delete('/api/news/:id', yetkiKontrolu, async (req, res) => {
    try {
        await News.findByIdAndDelete(req.params.id);
        res.json({ message: "Haber silindi!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Haber Güncelleme
app.put('/api/news/:id', yetkiKontrolu, async (req, res) => {
    try {
        await News.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: "Haber güncellendi!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sunucuyu Baslat
app.listen(port, () => console.log(`?? Sunucu çalisiyor: http://localhost:${port}`));