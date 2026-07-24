Markdown

# 🪸 Coral Draft

> **İçerik Yazarı İçin Standardizasyon, Yazılımcı İçin Otomasyon.**

`Coral Draft`, web platformları için içerik üreten yazarların (copywriter/SEO editörleri) serbest formatta hazırladığı dokümanları standart bir veri mimarisine oturtan, **yapılandırılmış bir içerik editörüdür (Structured Content Editor)**.

Google Docs veya serbest metin editörlerinin yarattığı "kirli HTML" ve "kuralsız format" problemlerini kökten çözer; hem yazarların kullanıcı deneyimini iyileştirir hem de yazılım ekibinin içerik entegrasyonu ve otomasyon süreçlerini sıfır maliyete indirir.

---

## 📐 Problem ve Motivasyon

Geleneksel içerik oluşturma süreçlerinde yazarlar genellikle Google Docs veya benzeri kelime işlemciler kullanır. Bu durum, teknik ekipler için ciddi operasyonel yükler yaratır:

- **Yapısal Düzensizlik:** H1, H2, H3 başlık hiyerarşilerinin rastgele kullanılması, web platformundaki tasarım düzenini ve SEO yapısını bozar.
- **Kirli HTML ve Inline Stiller:** Google Docs veya web sayfalarından yapılan kopyala-yapıştıralarda HTML içerisine `<div>`, `<style>`, font ve renk çöpleri sızar. Bu durum CMS'e veri aktarılırken tasarım kırılmalarına yol açar.
- **Yazılımcı Üzerindeki Planlama Yükü:** Tasarımcı ve geliştiriciler, her bir yeni makale veya sayfa için gelen metni manuel olarak incelemek, temizlemek ve frontend/CMS şablonlarına uygun hale getirmek zorunda kalır.

---

## 🎯 Vizyon ve Stratejik Değer

`Coral Draft`, içerik üretimini serbest metin formatından çıkarıp **Modüler Blok Tabanlı (Block-based AST)** bir veri modeline dönüştürür.

### 1. Kısa Vadeli Kazanım (Standardizasyon)

Yazarlara yalnızca belirlenmiş blok türlerini (H1-H4, Paragraf, Görsel/URL) ve izin verilen biçimlendirmeleri (**Bold**, _Italic_, Link) kullanma imkanı tanır. Böylece yazılımcının "içeriği web formatına dönüştürme" yükü ortadan kalkar.

### 2. Uzun Vadeli Kazanım (Otomasyon Potansiyeli)

Sistemin ürettiği çıktı **temiz ve şematik bir JSON** veri yapısıdır. Bu yapı sayesinde:

- **Headless CMS Entegrasyonu:** İçerikler tek tıkla doğrudan veritabanına veya CMS mimarisine aktarılabilir.
- **CI/CD & Otomasyon Hatları:** Metinler üzerinde otomatik SEO analizi, dil kontrolü veya doğrudan canlıya alma otomasyonları (Pipeline) tetiklenebilir.

---

## ✨ Öne Çıkan Özellikler

- **🧱 Modüler Blok Mimarısı:** İçerik; Bloklar ve bu bloklara bağlı başlık/paragraf satırları halinde yönetilir.
- **✍️ Hijyenik Rich Text Desteği:** Yalnızca anlamsal (semantic) HTML etiketlerine (`<b>`, `<i>`, `<a>`) izin veren özel sanitizer yapısı.
- **💾 Gerçek Zamanlı Bulut Otokayıt (Autosave Engine):** Yazarken kaybolma riski olmayan debounce ve reactive state tabanlı otokayut mekanizması.
- **📄 Çifte Dışa Aktarım (Dual Export):**
  - **JSON Export:** Web uygulamaları, API'ler ve CMS entegrasyonları için yapısını koruyan temiz AST çıktısı.
  - **DOCX Export:** Word uyumlu, zengin metin stillerini (`docx.js` motoru ile) birebir koruyan doküman çıktısı.
- **⌨️ Akıllı Klavye ve İmleç Deneyimi:**
  - `Backspace` ile satırları üst satırın **son karakterine** akıllı birleştirme.
  - İç içe etiketlerde dahi kusursuz çalışan **milimetrik caret (imleç) konumlandırması**.
  - Zengin metin araç çubuğunda canlı durum (Active State) takibi ve `Ctrl + B`, `Ctrl + I`, `Ctrl + K` kısayolları.

---

## 🏗️ Mimarisi ve Teknik Tasarım Kararları

Proje, frontend tarafında reaktif ve modüler bir mimari sunmak için **Vue 3 Composition API**, backend tarafında ise hafif ve hızlı bir servis katmanı için **Python Flask** üzerine kurgulanmıştır.

+-----------------------------------------------------------------------+
| CORAL DRAFT |
+-----------------------------------------------------------------------+
| |
| [ Content Input ] (Write / Paste Clean Text) |
| │ |
| ▼ |
| [ Sanitization & DOM Parser ] (Strip , inline CSS, keep semantic)|
| │ |
| ▼ |
| [ Reactive State Manager ] (useEditor.js Composable) |
| │ |
| ├───────────────────────────────┐ |
| ▼ ▼ |
| [ Autosave API / Flask ] [ Export Engines ] |
| (Local/Cloud Sync JSON) ├── JSON Engine (Clean AST) |
| └── DOCX Engine (docx.js Parser) |
+-----------------------------------------------------------------------+

### Keyfi Kararlar ve Teknik Zırhlandırma

1. **`contenteditable` Tutarsızlıklarının Giderilmesi:**
   Tarayıcıların varsayılan `contenteditable` davranışları (paragraf ortasında `div` oluşturma, imlecin başa zıplaması vb.) özelleştirilmiş `getCursorPosition` ve `setCursorPosition` algoritmalarıyla tamamen soyutlanmıştır.
2. **Klavye Aksiyonları Sınır Koruması (Boundary Check):**
   `Ctrl + A` gibi çoklu seçim durumlarında silme eylemleri tespit edilerek tarayıcının doğal davranışı korunmuş; tekli imleç konumlarında ise güvenli blok birleştirme (`isCollapsed` kontrolü) devreye sokulmuştur.
3. **Regex Tabanlı Protokol Düzeltici:**
   Giriş yapılan linklerde `http/https` bulunmaması durumunda yerel dosya yolu karmaşasını önlemek adına dinamik URL standartlaştırma katmanı eklenmiştir.

---

## 📊 Veri Akışı ve JSON Şeması

Yazarın girdiği içerik arka planda şu temiz ve şematik yapıda saklanır:

````json
{
  "name": "Antalya Gezi Rehberi Taslağı",
  "meta": {
    "title": "Antalya Gezi Rehberi 2026",
    "url": "antalya-gezi-rehberi",
    "description": "Antalya'da gezilecek yerler ve tatil rotaları."
  },
  "blocks": [
    {
      "name": "Giriş Bloğu",
      "lines": [
        {
          "type": "h1",
          "content": "Antalya Tatil Rehberi"
        },
        {
          "type": "p",
          "content": "Akdeniz'in en popüler tatil merkezlerinden biri olan Antalya'da <b>mutlaka görülmesi gereken</b> yerleri derledik. Detaylar için <a href=\"[https://coral.ru](https://coral.ru)\">sitemizi</a> ziyaret edin."
        }
      ]
    }
  ]
}
```text
📁 Proje Yapısı
coral-draft/
├── app.py                      # Flask API ve Dosya Yolu Yönetimi
├── requirements.txt            # Python Bağımlılıkları
├── static/
│   ├── css/
│   │   └── style.css           # Editör Stilleri ve Tipografi
│   └── js/
│       ├── app.js              # Vue 3 Ana Uygulama Girişi
│       ├── composables/
│       │   └── useEditor.js    # Editör Mantığı, State ve DOM Yönetimi
│       ├── services/
│       │   ├── apiService.js   # Flask API Entegrasyon Katmanı
│       │   └── exportService.js# DOCX / JSON Export Motoru
│       └── utils/
│           └── helpers.js      # Yardımcı Araçlar ve Regex Süzgeçleri
├── templates/
│   └── index.html              # Ana Arayüz Şablonu
└── documents/                  # Saklanan Taslak JSON Verileri
````
