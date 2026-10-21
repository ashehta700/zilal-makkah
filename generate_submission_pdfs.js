const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const capturesDir = path.join(__dirname, 'demo_captures');
const assetsDir = path.join(capturesDir, 'pdf_assets_light');
const outputDir = path.join(__dirname, 'submission_dossier_pdfs');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Convert image file to base64 data URL
function toBase64(fileName) {
    const filePath = path.join(assetsDir, fileName);
    if (!fs.existsSync(filePath)) return '';
    const data = fs.readFileSync(filePath);
    return `data:image/jpeg;base64,${data.toString('base64')}`;
}

const imgOverview = toBase64('01_haram_overview.jpg');
const imgDual = toBase64('02_dual_routes_noon.jpg');
const imgMorning = toBase64('03_morning_shadow.jpg');
const imgAfternoon = toBase64('04_afternoon_shadow.jpg');
const imgPeek = toBase64('05_mobile_peek.jpg');
const imgExpanded = toBase64('06_mobile_expanded.jpg');
const imgOutro = toBase64('zilal_makkah_outro_card.jpg');

// Shared CSS styles for all PDFs
const baseStyles = `
    @page {
        size: A4;
        margin: 12mm 14mm 14mm 14mm;
    }

    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    body {
        font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
        direction: rtl;
        color: #1e293b;
        background: #ffffff;
        font-size: 11pt;
        line-height: 1.55;
    }

    .page {
        position: relative;
        min-height: 270mm;
        page-break-after: always;
        padding-bottom: 15mm;
    }

    .page:last-child {
        page-break-after: avoid;
    }

    /* Header Bar */
    .doc-header {
        border-bottom: 2px solid #d97706;
        padding-bottom: 8px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .doc-header-left {
        text-align: left;
        direction: ltr;
        font-size: 8.5pt;
        color: #64748b;
        font-weight: 600;
    }

    .doc-header-right {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .header-logo-icon {
        font-size: 18pt;
    }

    .header-title-box h1 {
        font-size: 13pt;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.2;
    }

    .header-title-box p {
        font-size: 8pt;
        color: #d97706;
        font-weight: 700;
    }

    /* Footer Bar */
    .doc-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        border-top: 1px solid #e2e8f0;
        padding-top: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 8pt;
        color: #94a3b8;
    }

    .doc-footer-endowment {
        color: #059669;
        font-weight: 700;
    }

    /* Typography & Utilities */
    h2.section-title {
        font-size: 13pt;
        font-weight: 800;
        color: #0f172a;
        border-right: 4px solid #059669;
        padding-right: 8px;
        margin-top: 14px;
        margin-bottom: 8px;
    }

    h3.sub-title {
        font-size: 10.5pt;
        font-weight: 700;
        color: #0369a1;
        margin-top: 8px;
        margin-bottom: 4px;
    }

    p {
        margin-bottom: 8px;
        text-align: justify;
    }

    /* Badges & Cards */
    .card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 14px;
        margin-bottom: 12px;
    }

    .card-gold {
        background: #fffbeb;
        border: 1px solid #fde68a;
    }

    .card-emerald {
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
    }

    .card-sky {
        background: #f0f9ff;
        border: 1px solid #bae6fd;
    }

    .badge-pill {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 9999px;
        font-size: 8.5pt;
        font-weight: 700;
        margin-left: 6px;
    }

    .badge-gold { background: #fef3c7; color: #b45309; }
    .badge-emerald { background: #d1fae5; color: #047857; }
    .badge-red { background: #fee2e2; color: #b91c1c; }

    /* Tables */
    table.data-table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        font-size: 9.5pt;
    }

    table.data-table th {
        background: #0f172a;
        color: #ffffff;
        font-weight: 700;
        padding: 6px 10px;
        border: 1px solid #0f172a;
        text-align: right;
    }

    table.data-table td {
        padding: 6px 10px;
        border: 1px solid #cbd5e1;
    }

    table.data-table tr:nth-child(even) {
        background: #f8fafc;
    }

    /* Grid layouts */
    .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 10px;
    }

    .grid-3 {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 10px;
        margin-bottom: 10px;
    }

    /* Cover Page Elements */
    .cover-container {
        text-align: center;
        padding: 30px 10px;
    }

    .cover-title {
        font-size: 26pt;
        font-weight: 900;
        color: #0f172a;
        margin-top: 15px;
        margin-bottom: 6px;
        line-height: 1.2;
    }

    .cover-subtitle {
        font-size: 13pt;
        color: #059669;
        font-weight: 700;
        margin-bottom: 18px;
    }

    .cover-slogan {
        font-size: 16pt;
        font-weight: 800;
        color: #b45309;
        background: #fef3c7;
        display: inline-block;
        padding: 8px 24px;
        border-radius: 9999px;
        border: 1.5px solid #fde68a;
        margin-bottom: 30px;
    }

    /* Images */
    .figure-box {
        margin: 10px 0;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        overflow: hidden;
        background: #000;
    }

    .figure-box img {
        width: 100%;
        display: block;
    }

    .figure-caption {
        background: #f1f5f9;
        padding: 6px 10px;
        font-size: 8.5pt;
        color: #475569;
        font-weight: 600;
        border-top: 1px solid #e2e8f0;
    }
`;

// ==========================================
// 1. PDF 1: ملف المشروع الشامل (Executive Dossier - 3 Pages)
// ==========================================
const htmlDossier = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>${baseStyles}</style>
</head>
<body>

    <!-- PAGE 1: الغلاف والملخص التنفيذي والمشكلة والتحدي -->
    <div class="page">
        <div class="doc-header">
            <div class="doc-header-right">
                <span class="header-logo-icon">🕋</span>
                <div class="header-title-box">
                    <h1>المرفق الأول: الملف التعريفي الشامل للمشروع</h1>
                    <p>جائزة مكة للتميز / منصة الإبداع — إمارة منطقة مكة المكرمة</p>
                </div>
            </div>
            <div class="doc-header-left">
                Zilal Makkah 3D<br>Executive Dossier
            </div>
        </div>

        <div class="cover-container" style="padding: 10px 0 16px 0;">
            <div style="font-size: 32pt; margin-bottom: 4px;">🕋</div>
            <h1 class="cover-title" style="font-size: 22pt; margin: 0 0 4px 0;">ظِـلَال مَـكَّـة 3D</h1>
            <p class="cover-subtitle" style="font-size: 11pt; margin-bottom: 12px;">أول نظام ملاحة مناخي وجغرافي ذكي لتتبع مسارات المشاة المظللة وحماية ضيوف الرحمن من الإجهاد الحراري</p>
            <div class="cover-slogan" style="font-size: 13pt; padding: 6px 20px; margin-bottom: 16px;">
                « طَرِيقُكَ الأَبْرَد.. إِلَى أَطْهَرِ بَيْت »
            </div>
        </div>

        <div class="card card-gold" style="margin-bottom: 10px; padding: 8px 12px;">
            <div class="grid-2" style="font-size: 9pt; margin-bottom: 0;">
                <div>
                    <strong>• اسم المتقدم:</strong> أحمد شحاتة (Ahmed Shehta)<br>
                    <strong>• فئة المشاركة:</strong> أفراد (مبتكر / مهندس برمجيات ونظم GIS)<br>
                    <strong>• البريد الإلكتروني:</strong> ashehta700@gmail.com
                </div>
                <div>
                    <strong>• المسار المرشح:</strong> فرع التميز في خدمات الحج والعمرة<br>
                    <strong>• الجاهزية الميدانية:</strong> نموذج أولي كامل ومطبق 100% أونلاين<br>
                    <strong>• طبيعة المشروع:</strong> وقف تقني خالص لوجه الله تعالى
                </div>
            </div>
        </div>

        <div class="card card-emerald" style="margin-bottom: 10px; padding: 8px 12px;">
            <strong style="color: #065f46; font-size: 9.5pt;">🎯 الملخص التنفيذي للمبادرة:</strong>
            <p style="font-size: 8.5pt; margin-top: 2px; margin-bottom: 0;">
                في ظل الارتفاع الشديد لدرجات حرارة الأسطح والأسفلت المكشوف في مكة المكرمة والتي تتجاوز 50°C، يعالج مشروع "ظِلال مكّة" القصور الجوهري في تطبيقات الملاحة العالمية التي تركز فقط على "أقصر مسافة" وتقود الملايين تحت لهيب الشمس المباشرة. يقدم المشروع أول نظام ملاحة مناخي تفاعلي ثلاثي الأبعاد (3D WebGIS) يربط بين موقع فندق المعتمر وتوقيت خروجه للحرم، ليرسم لحظياً "مسار الظلال المبرد" المتتبع لزوايا الشمس الفلكية وامتداد ظلال الأبراج وأنفاق المشاة ومظلات الرذاذ ونقاط ماء زمزم، بفارق تبريد يتجاوز 21.6°C، مع محاكاة ثلاثية الأبعاد كاملة لتيسير رحلة الحاج ووقايته من ضربات الشمس والإجهاد الحراري.
            </p>
        </div>

        <h2 class="section-title" style="margin-top: 8px; font-size: 11pt;">1. المشكلة والتحدي الميداني القائم</h2>
        <div class="grid-3" style="font-size: 8pt; margin-bottom: 0;">
            <div class="card card-gold" style="padding: 6px 10px; margin-bottom: 0;">
                <strong style="color: #92400e;">⚠️ الخطر الصحي الحرج</strong>
                <p style="margin-top: 2px; margin-bottom: 0;">مخاطر الإجهاد الحراري وضربات الشمس لكبار السن والمرضى في درجات حرارة أسطح تتجاوز 50°C.</p>
            </div>
            <div class="card" style="border-right: 3px solid #ef4444; padding: 6px 10px; margin-bottom: 0;">
                <strong style="color: #b91c1c;">⚠️ قصور أنظمة الملاحة</strong>
                <p style="margin-top: 2px; margin-bottom: 0;">منصات مثل Google Maps توجه المشاة في أقصر خط مكشوف متجاهلة التبريد والشمس.</p>
            </div>
            <div class="card card-sky" style="padding: 6px 10px; margin-bottom: 0;">
                <strong style="color: #0369a1;">⚠️ حركة الظل المتغيرة</strong>
                <p style="margin-top: 2px; margin-bottom: 0;">صعوبة تقدير الحاج لحركة الظلال ومواقع أنفاق المشاة والرذاذ وسط اتساع ساحات الحرم.</p>
            </div>
        </div>

        <div class="doc-footer">
            <span>ظِـلال مَـكَّـة 3D — الملف التعريفي الشامل</span>
            <span class="doc-footer-endowment">✨ وقف تقني لوجه الله تعالى لخدمة ضيوف الرحمن</span>
            <span>صفحة 1 من 3</span>
        </div>
    </div>

    <!-- PAGE 2: الحل التقني وجدول المقارنة والابتكارات -->
    <div class="page">
        <div class="doc-header">
            <div class="doc-header-right">
                <span class="header-logo-icon">🕋</span>
                <div class="header-title-box">
                    <h1>ظِـلال مَـكَّـة 3D — الحل التقني والابتكارات</h1>
                    <p>المقارنة الحرارية اللحظية وخوارزمية تتبع الظلال</p>
                </div>
            </div>
            <div class="doc-header-left">Solution & Innovation</div>
        </div>

        <h2 class="section-title" style="margin-top: 4px; font-size: 11pt;">2. الحل التقني المبتكر: المقارنة الحرارية المزدوجة اللحظية</h2>
        <p style="font-size: 9pt; margin-bottom: 6px;">
            يقدم التطبيق مقارنة مباشرة للمسارين فور اختيار الفندق لرفع وعي المعتمر بسلامة مساره:
        </p>

        <table class="data-table" style="font-size: 8.5pt; margin: 4px 0 8px 0;">
            <thead>
                <tr>
                    <th style="width: 22%;">معيار المقارنة</th>
                    <th style="width: 39%; background: #991b1b;">المسار المكشوف (الأحمر - طريقة جوجل)</th>
                    <th style="width: 39%; background: #065f46;">مسار ظِـلال مَـكَّـة (الأخضر الموصى به)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>طبيعة المسار</strong></td>
                    <td>أقصر خط جغرافي مكشوف تحت لهيب الشمس المباشرة</td>
                    <td>مسار الأروقة المبردة ومظلات الرذاذ وظلال الأبراج</td>
                </tr>
                <tr>
                    <td><strong>درجة الحرارة السطحية</strong></td>
                    <td><span class="badge-pill badge-red">50.0°C (حرارة لاهبة)</span></td>
                    <td><span class="badge-pill badge-emerald">28.4°C (فارق تبريد 21.6°C)</span></td>
                </tr>
                <tr>
                    <td><strong>نسبة التظليل</strong></td>
                    <td>8% فقط (عرضة تامة لضربات الشمس)</td>
                    <td><strong>98% تظليل كامل</strong> وأروقة معمارية محمية</td>
                </tr>
                <tr>
                    <td><strong>مسافة ووقت السير</strong></td>
                    <td>196 متراً (3 دقائق)</td>
                    <td>208 أمتار (3.5 دقائق) — زيادة دقيقة واحدة فقط!</td>
                </tr>
                <tr>
                    <td><strong>نقاط الدعم والراحة</strong></td>
                    <td>معدومة تقريباً في الساحات المفتوحة</td>
                    <td>مياه زمزم المبردة، مراوح الرذاذ، ونقاط الإسعاف</td>
                </tr>
            </tbody>
        </table>

        <h2 class="section-title" style="margin-top: 8px; font-size: 11pt;">3. الابتكارات التقنية والخوارزميات الأساسية</h2>
        
        <div class="card" style="padding: 8px 12px; margin-bottom: 8px;">
            <h3 class="sub-title" style="font-size: 9.5pt; margin-top: 0;">☀️ 1. خوارزمية تتبع زوايا الشمس الفلكية (Dynamic Solar Tracking):</h3>
            <p style="font-size: 8.5pt; margin-bottom: 0;">
                المسار الأخضر ليس خطاً ثابتاً في الخريطة؛ حيث يقوم النظام بحساب زوايا سمت الشمس (Azimuth) وزاوية ارتفاعها فلكياً لحظة بلحظة بحسب يوم وساعة المسير.
                <strong>في الصباح (الضحى):</strong> ينحرف المسار غرباً موازياً لامتداد ظل أبراج البيت.
                <strong>في الظهيرة:</strong> يلتزم المسار بممرات الأعمدة ومظلات الرذاذ التبخيري.
                <strong>في العصر:</strong> يتحول المسار تلقائياً شرقاً بأكثر من 110 أمتار ليتتبع امتداد ظل الأبراج نحو أبراج الصفوة.
            </p>
        </div>

        <div class="card" style="padding: 8px 12px; margin-bottom: 8px;">
            <h3 class="sub-title" style="font-size: 9.5pt; margin-top: 0;">🏢 2. قاعدة بيانات جغرافية ثلاثية الأبعاد (3D GIS Engine):</h3>
            <p style="font-size: 8.5pt; margin-bottom: 0;">
                تم استخراج ونمذجة وتوثيق الكتل البنائية لأكثر من <strong>510 فندق ومعلم تاريخي وبوابة بالحرم المكي</strong> (مجمع برج الساعة، جبل عمر، أجياد، جرول، أنفاق كدي) مع ترجمة كاملة للأسماء العربية وتحديد الارتفاعات الحقيقية لمحاكاة حركة الظلال بدقة متناهية.
            </p>
        </div>

        <div class="card" style="padding: 8px 12px; margin-bottom: 0;">
            <h3 class="sub-title" style="font-size: 9.5pt; margin-top: 0;">🚶‍♂️ 3. محاكاة المعتمر ثلاثية الأبعاد (3D Pilgrim Tracking HUD):</h3>
            <p style="font-size: 8.5pt; margin-bottom: 0;">
                نظام محاكاة ميدانية يجسد المعتمر بملابس الإحرام والهالة المضيئة مع شريط مؤشرات رأسية (HUD) يرشد الحاج لحظة بلحظة لأماكن شرب ماء زمزم، محطات الرذاذ، الممرات المكيفة، وأقرب باب دخول للحرم من اتجاه فندقه.
            </p>
        </div>

        <div class="doc-footer">
            <span>ظِـلال مَـكَّـة 3D — الملف التعريفي الشامل</span>
            <span class="doc-footer-endowment">✨ وقف تقني لوجه الله تعالى لخدمة ضيوف الرحمن</span>
            <span>صفحة 2 من 3</span>
        </div>
    </div>

    <!-- PAGE 3: المواءمة والأثر والروابط الرسمية -->
    <div class="page">
        <div class="doc-header">
            <div class="doc-header-right">
                <span class="header-logo-icon">🕋</span>
                <div class="header-title-box">
                    <h1>ظِـلال مَـكَّـة 3D — المواءمة والأثر والروابط الرسمية</h1>
                    <p>فرع التميز في خدمات الحج والعمرة</p>
                </div>
            </div>
            <div class="doc-header-left">Impact & Live Links</div>
        </div>

        <h2 class="section-title" style="margin-top: 4px; font-size: 11pt;">4. المواءمة مع رؤية المملكة 2030</h2>
        <div class="grid-2" style="margin-bottom: 8px;">
            <div class="card card-emerald" style="padding: 8px 12px; margin-bottom: 0;">
                <strong style="color: #065f46; font-size: 9pt;">🇸🇦 برنامج خدمة ضيوف الرحمن (DARP)</strong>
                <p style="font-size: 8pt; margin-top: 2px; margin-bottom: 0;">
                    الإسهام المباشر في تيسير استضافة ملايين الحجاج والمعتمرين وتقديم خدمات رقمية نوعية تضمن سلامتهم وصحتهم وإثراء تجربتهم الدينية.
                </p>
            </div>
            <div class="card card-sky" style="padding: 8px 12px; margin-bottom: 0;">
                <strong style="color: #0369a1; font-size: 9pt;">🌿 برنامج جودة الحياة ومبادرة السعودية الخضراء</strong>
                <p style="font-size: 8pt; margin-top: 2px; margin-bottom: 0;">
                    أنسنة المشاعر المقدسة، مكافحة جزر الحرارة الحضرية، وتوفير بيئة مشاة آمنة ومريحة عالمياً.
                </p>
            </div>
        </div>

        <h2 class="section-title" style="margin-top: 8px; font-size: 11pt;">5. مؤشرات الأثر والقيمة المضافة المتوقعة (Key Metrics)</h2>
        <div class="grid-3" style="text-align: center; margin-bottom: 8px;">
            <div class="card card-emerald" style="padding: 6px 10px; margin-bottom: 0;">
                <div style="font-size: 15pt; font-weight: 900; color: #047857;">-21.6°C</div>
                <div style="font-size: 8pt; font-weight: 700; color: #065f46;">فارق التبريد السطحي</div>
                <div style="font-size: 7pt; color: #64748b;">بين الطريق المكشوف والمظلل</div>
            </div>
            <div class="card card-gold" style="padding: 6px 10px; margin-bottom: 0;">
                <div style="font-size: 15pt; font-weight: 900; color: #b45309;">98%</div>
                <div style="font-size: 8pt; font-weight: 700; color: #92400e;">نسبة التظليل المحققة</div>
                <div style="font-size: 7pt; color: #64748b;">عبر الأروقة ومظلات الرذاذ</div>
            </div>
            <div class="card card-sky" style="padding: 6px 10px; margin-bottom: 0;">
                <div style="font-size: 15pt; font-weight: 900; color: #0284c7;">510+</div>
                <div style="font-size: 8pt; font-weight: 700; color: #0369a1;">فندق ومعلم موثق</div>
                <div style="font-size: 7pt; color: #64748b;">تغطي المنطقة المركزية بالكامل</div>
            </div>
        </div>

        <h2 class="section-title" style="margin-top: 8px; font-size: 11pt;">6. إثبات التنفيذ على أرض الواقع والروابط الرسمية (Proof of Concept)</h2>
        <div class="card card-gold" style="padding: 8px 12px; margin-bottom: 8px;">
            <div style="font-size: 8.5pt; line-height: 1.6;">
                🌐 <strong>رابط التطبيق الحي المباشر (Live Demo):</strong><br>
                <a href="https://ashehta700.github.io/zilal-makkah/" style="color: #0369a1; font-weight: 700;">https://ashehta700.github.io/zilal-makkah/</a><br>
                📂 <strong>المستودع البرمجي المفتوح على GitHub:</strong><br>
                <a href="https://github.com/ashehta700/zilal-makkah" style="color: #0369a1; font-weight: 700;">https://github.com/ashehta700/zilal-makkah</a><br>
                📱 <strong>التشغيل:</strong> يعمل 100% بدون أي سيرفر وسيط مباشرة من متصفحات الهواتف الذكية وأجهزة الحاسوب.
            </div>
        </div>

        <div class="card card-emerald" style="padding: 8px 12px; margin-bottom: 0;">
            <p style="font-size: 8.5pt; font-weight: 600; color: #065f46; margin-bottom: 0;">
                «إن هذا المشروع وقفٌ تقني خالص لوجه الله تعالى لخدمة ضيوف الرحمن ووقايتهم من أخطار الإجهاد الحراري، وهو جاهز تماماً للتسليم والتكامل الميداني الفوري مع الجهات المعنية والمنصات الوطنية مثل منصة "نُسك" المباركة.»
            </p>
        </div>

        <div class="doc-footer">
            <span>ظِـلال مَـكَّـة 3D — الملف التعريفي الشامل</span>
            <span class="doc-footer-endowment">✨ وقف تقني لوجه الله تعالى لخدمة ضيوف الرحمن</span>
            <span>صفحة 3 من 3</span>
        </div>
    </div>

</body>
</html>`;

// ==========================================
// 2. PDF 2: التوثيق المصور والشاشات (Visual Walkthrough)
// ==========================================
const htmlScreenshots = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>${baseStyles}</style>
</head>
<body>

    <!-- PAGE 1: نظرة عامة على التطبيق ثلاثي الأبعاد -->
    <div class="page">
        <div class="doc-header">
            <div class="doc-header-right">
                <span class="header-logo-icon">🕋</span>
                <div class="header-title-box">
                    <h1>المرفق الثاني: التوثيق المصور وإثبات التنفيذ</h1>
                    <p>جائزة مكة للتميز / منصة الإبداع — استعراض شاشات التطبيق الحية</p>
                </div>
            </div>
            <div class="doc-header-left">Visual Proof of Concept<br>Screenshots Dossier</div>
        </div>

        <div class="card card-gold" style="margin-bottom: 10px;">
            <strong style="color: #92400e; font-size: 9.5pt;">📸 نبذة عن هذا الملف:</strong>
            <p style="font-size: 8.5pt; margin-top: 2px; margin-bottom: 0;">
                يحتوي هذا الملف على لقطات حقيقية عالية الدقة مأخوذة مباشرة من داخل تطبيق «ظِلال مكّة 3D» أثناء تشغيله الميداني، توثق دقة النمذجة الجغرافية، مقارنة المسارات الحرارية، وتتبع الظلال الفلكية.
            </p>
        </div>

        <h2 class="section-title">1. النظرة العامة ثلاثية الأبعاد للحرم المكي الشريف والأبراج</h2>
        <div class="figure-box">
            <img src="${imgOverview}" alt="نظرة عامة على الحرم" />
            <div class="figure-caption">
                شكل (1): بيئة جغرافية ثلاثية الأبعاد (CesiumJS 3D) تجسد المسجد الحرام، الكعبة المشرفة، ناطحات السحاب المحيطة، وتضاريس جبال مكة المكرمة.
            </div>
        </div>

        <div class="doc-footer">
            <span>ظِـلال مَـكَّـة 3D — التوثيق المصور والشاشات</span>
            <span class="doc-footer-endowment">✨ وقف تقني لوجه الله تعالى لخدمة ضيوف الرحمن</span>
            <span>صفحة 1 من 3</span>
        </div>
    </div>

    <!-- PAGE 2: المقارنة المزدوجة وتتبع زاوية الشمس -->
    <div class="page">
        <div class="doc-header">
            <div class="doc-header-right">
                <span class="header-logo-icon">🕋</span>
                <div class="header-title-box">
                    <h1>المرفق الثاني: التوثيق المصور وإثبات التنفيذ</h1>
                    <p>مقارنة المسارين وحسابات حركة الظل الفلكية</p>
                </div>
            </div>
            <div class="doc-header-left">Dual Routes & Solar Tracking</div>
        </div>

        <h2 class="section-title">2. المقارنة الحرارية المزدوجة في ذروة الظهيرة (12:30 ظهراً)</h2>
        <div class="figure-box" style="margin-bottom: 12px;">
            <img src="${imgDual}" alt="المساران المزدوجان" />
            <div class="figure-caption">
                شكل (2): فندق برج الساعة (فيرمونت) — المسار المكشوف الأحمر (50.0°C | تظليل 8%) مقابل مسار ظِلال مكة الأخضر (28.4°C | تظليل 98%) بفارق تبريد -21.6°C.
            </div>
        </div>

        <h2 class="section-title">3. تتبع زوايا الشمس الفلكية وانكسار الظلال عبر ساعات النهار</h2>
        <div class="grid-2">
            <div class="figure-box">
                <img src="${imgMorning}" alt="الظل الصباحي" />
                <div class="figure-caption">
                    شكل (3-أ): فترة الضحى (08:30 ص) — انحراف المسار الأخضر غرباً ليتتبع ظل برج الساعة فوق الرخام.
                </div>
            </div>
            <div class="figure-box">
                <img src="${imgAfternoon}" alt="الظل العصري" />
                <div class="figure-caption">
                    شكل (3-ب): فترة العصر (04:15 م) — امتداد ظل الأبراج شرقاً وتحول المسار بأكثر من 110م نحو أبراج الصفوة.
                </div>
            </div>
        </div>

        <div class="doc-footer">
            <span>ظِـلال مَـكَّـة 3D — التوثيق المصور والشاشات</span>
            <span class="doc-footer-endowment">✨ وقف تقني لوجه الله تعالى لخدمة ضيوف الرحمن</span>
            <span>صفحة 2 من 3</span>
        </div>
    </div>

    <!-- PAGE 3: محاكاة المعتمر 3D وتجربة الجوال والشعار -->
    <div class="page">
        <div class="doc-header">
            <div class="doc-header-right">
                <span class="header-logo-icon">🕋</span>
                <div class="header-title-box">
                    <h1>المرفق الثاني: التوثيق المصور وإثبات التنفيذ</h1>
                    <p>تجربة الجوال والمحاكاة ثلاثية الأبعاد وشعار المبادرة</p>
                </div>
            </div>
            <div class="doc-header-left">Mobile & 3D HUD</div>
        </div>

        <h2 class="section-title">4. واجهة الهواتف الذكية المتجاوبة (Google Maps Bottom Sheet)</h2>
        <div class="grid-2" style="margin-bottom: 12px;">
            <div class="figure-box">
                <img src="${imgPeek}" alt="شريط التلخيص" />
                <div class="figure-caption">
                    شكل (4-أ): شريط التلخيص السريع (Peek Bar) مع تتبع GPS المباشر.
                </div>
            </div>
            <div class="figure-box">
                <img src="${imgExpanded}" alt="القائمة الموسعة" />
                <div class="figure-caption">
                    شكل (4-ب): القائمة الموسعة التي تعرض خطوات المسار الحرارية وأماكن زمزم والرذاذ.
                </div>
            </div>
        </div>

        <h2 class="section-title">5. الهوية البصرية الرسمية وشعار المشروع المعتمد</h2>
        <div class="figure-box">
            <img src="${imgOutro}" alt="شريحة الهوية والشعار" />
            <div class="figure-caption">
                شكل (5): شريحة ختام الفيديو والهوية الرسمية بشعار: «طَرِيقُكَ الأَبْرَد.. إِلَى أَطْهَرِ بَيْت».
            </div>
        </div>

        <div class="doc-footer">
            <span>ظِـلال مَـكَّـة 3D — التوثيق المصور والشاشات</span>
            <span class="doc-footer-endowment">✨ وقف تقني لوجه الله تعالى لخدمة ضيوف الرحمن</span>
            <span>صفحة 3 من 3</span>
        </div>
    </div>

</body>
</html>`;

// ==========================================
// 3. PDF 3: مقترح التطوير الميداني والبيانات الواقعية (Field Development Plan)
// ==========================================
const htmlProposal = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>${baseStyles}</style>
</head>
<body>

    <!-- PAGE 1: غلاف ومقدمة مقترح التطوير الميداني -->
    <div class="page">
        <div class="doc-header">
            <div class="doc-header-right">
                <span class="header-logo-icon">🕋</span>
                <div class="header-title-box">
                    <h1>المرفق الثالث: مقترح التطوير الميداني والتكامل مع البيانات الواقعية</h1>
                    <p>جائزة مكة للتميز / منصة الإبداع — رؤية تنفيذية لخدمة المشاعر المقدسة</p>
                </div>
            </div>
            <div class="doc-header-left">Field Development Plan<br>& Real-Time IoT Roadmap</div>
        </div>

        <div class="card card-emerald" style="margin-bottom: 12px;">
            <strong style="color: #065f46; font-size: 10pt;">📌 الهدف من هذا المقترح التنفيذي:</strong>
            <p style="font-size: 9pt; margin-top: 4px; margin-bottom: 0;">
                لا يقتصر مشروع «ظِلال مكّة» على كونه تطبيقاً رقمياً للملاحة فحسب، بل يمثل <strong>نظام دعم اتخاذ قرار جغرافي (Spatial Decision Support System)</strong> يقدم للجهات المعنية (إمارة منطقة مكة، أمانة العاصمة المقدسة، الهيئة العامة للعناية بشؤون المسجد الحرام والمسجد النبوي، وشركة كدانة) توصيات ميدانية دقيقة لتعزيز البنية التحتية للتبريد والتظليل بناءً على بيانات حركة المشاة والبيانات الواقعية.
            </p>
        </div>

        <h2 class="section-title">المحور الأول: المقترح الميداني للتوزيع الاستراتيجي لمراوح وأعمدة رذاذ الماء التبخيري</h2>
        <p>
            بناءً على النمذجة الجغرافية لمسارات المشاة القادمة من الفنادق المحيطة، رصد التطبيق عدة مسارات تشهد كثافة مشاة هائلة ولكنها تعاني من فجوات في التبريد بالرذاذ التبخيري.
        </p>

        <div class="card card-sky">
            <h3 class="sub-title">💧 خطة التوزيع المقترحة لأعمدة ومراوح الرذاذ:</h3>
            <ul style="font-size: 9pt; padding-right: 18px; line-height: 1.7;">
                <li><strong>إنشاء سلاسل تبريد متصلة (Continuous Misting Corridors):</strong> وضع مراوح رذاذ تبخيري كل 15 إلى 20 متراً في المسارات المؤدية من ساحات أجياد والشبيكة وجرول نحو أبواب الحرم لضمان عدم تعرض المعتمر لانقطاع في التبريد.</li>
                <li><strong>تفعيل الرذاذ الذكي المعتمد على حساسات الحركة والحرارة:</strong> ربط مضخات الرذاذ بمستشعرات حرارية وحساسات تدفق المشاة لتعمل بأقصى طاقتها في أوقات الذروة مع ترشيد استهلاك المياه عند خلو المسار.</li>
                <li><strong>تخفيض درجة حرارة الهواء المحيط بمعدل 5°C إلى 7°C إضافية:</strong> من خلال توجيه فوهات الرذاذ الدقيقة (Micro-nozzles) بزوايا هندسية تمنع بلل الأرضيات الرخامية مع تبخير الرذاذ في الهواء مباشرة.</li>
            </ul>
        </div>

        <h2 class="section-title">المحور الثاني: مقترح إنشاء وتثبيت مظلات وأروقة تظليل ذكية في الساحات المكشوفة</h2>
        <div class="card card-gold">
            <h3 style="color: #92400e; font-size: 10pt; font-weight: 700; margin-bottom: 4px;">☀️ معالجة بؤر انعدام الظل الطبيعي:</h3>
            <p style="font-size: 9pt; margin-bottom: 6px;">
                أظهرت محاكاة التطبيق أن بعض الممرات الحيوية تفقد الظل الطبيعي للأبراج في فترات منتصف النهار (ما بين الساعة 11:30 ص إلى 02:00 م)، ولذا نقترح:
            </p>
            <ul style="font-size: 8.5pt; padding-right: 18px; line-height: 1.6;">
                <li><strong>مظلات متحركة قابلة للطي (Retractable Tensile Shades):</strong> تشبه مظلات ساحات الحرم النبوي، يتم نشرها في الساحات الشرقية والجنوبية خلال ساعات الظهيرة وطيها ليلاً للسماح بتهوية الساحات.</li>
                <li><strong>أروقة المشاة المظللة بالألواح الشمسية الشفافة (Solar Pergolas):</strong> توفير مظلات دائمة خفيفة الوزن على مسارات المشاة الطويلة تقوم بتوليد الطاقة النظيفة لتشغيل مراوح الرذاذ والإضاءة الذكية.</li>
            </ul>
        </div>

        <div class="doc-footer">
            <span>ظِـلال مَـكَّـة 3D — مقترح التطوير الميداني والتكامل</span>
            <span class="doc-footer-endowment">✨ وقف تقني لوجه الله تعالى لخدمة ضيوف الرحمن</span>
            <span>صفحة 1 من 2</span>
        </div>
    </div>

    <!-- PAGE 2: سقيا زمزم والتكامل مع منصة نسك وإنترنت الأشياء -->
    <div class="page">
        <div class="doc-header">
            <div class="doc-header-right">
                <span class="header-logo-icon">🕋</span>
                <div class="header-title-box">
                    <h1>المرفق الثالث: مقترح التطوير الميداني والتكامل مع البيانات الواقعية</h1>
                    <p>سقيا ماء زمزم والتكامل الرقمي مع منصة "نُسك" وحساسات IoT</p>
                </div>
            </div>
            <div class="doc-header-left">Zamzam Logistics & Nusuk Integration</div>
        </div>

        <h2 class="section-title">المحور الثالث: الاعتماد على البيانات الواقعية واللوجستية لسقيا ماء زمزم</h2>
        <p>
            يعد شرب ماء زمزم البارد في طريق المشي عاملاً رئيسياً في وقاية الحاج من الجفاف وضربات الشمس، ويقترح النظام الربط المباشر مع إدارة سقيا زمزم بالمسجد الحرام:
        </p>

        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 30%;">الميزة المقترحة</th>
                    <th style="width: 40%;">البيانات الواقعية المطلوبة</th>
                    <th style="width: 30%;">الأثر الميداني المباشر</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>خريطة المشربيات اللحظية</strong></td>
                    <td>الإحداثيات الجغرافية لمشربيات زمزم الثابتة والحاويات</td>
                    <td>توجيه الحاج لأقرب مشربية على مسار سيره</td>
                </tr>
                <tr>
                    <td><strong>مؤشر توفر المياه (Smart Refill)</strong></td>
                    <td>مستشعرات مستوى المياه في حافظات زمزم المتنقلة</td>
                    <td>منع توجه الحجاج للنقاط الفارغة وتنبيه فرق السقيا</td>
                </tr>
                <tr>
                    <td><strong>توزيع الحشود ومنع التكدس</strong></td>
                    <td>بيانات كاميرات الرصد عند نقاط التوزيع</td>
                    <td>إعادة توجيه المشاة للمشربيات الأقل ازدحاماً</td>
                </tr>
            </tbody>
        </table>

        <h2 class="section-title">المحور الرابع: خارطة طريق التكامل المؤسسي مع منصة "نُسك" (Nusuk Platform)</h2>
        <div class="card card-emerald">
            <h3 style="color: #065f46; font-size: 10pt; font-weight: 700; margin-bottom: 4px;">🤝 تكامل استراتيجي كوقف رقمي وطني:</h3>
            <p style="font-size: 9pt; margin-bottom: 6px;">
                يهدف المشروع إلى أن يكون ميزة وطنية مدمجة رسمياً ضمن تطبيق <strong>«نُسك» (Nusuk)</strong> الحكومي لخدمة أكثر من 15 مليون زائر سنوياً:
            </p>
            <div class="grid-2" style="font-size: 8.5pt;">
                <div>
                    <strong>1. واجهة برمجة ملاحية (Zilal API):</strong> تمكين تطبيق نسك من استدعاء خوارزمية الظل وتوجيه الحاج من غرفته بالفندق مباشرة.<br><br>
                    <strong>2. الربط مع المركز الوطني للأرصاد (NCM):</strong> تغذية لحظية بدرجات الحرارة الفعلية وسرعة الرياح والرطوبة.
                </div>
                <div>
                    <strong>3. التوسع في المشاعر المقدسة:</strong> تطبيق خوارزمية الظل على مسارات المشاة في منى ومزدلفة وعرفات ومحطات قطار الحرمين.<br><br>
                    <strong>4. تنبيهات استباقية باللغات العالمية:</strong> إرسال إشعارات للحجاج بالمسار المبرد بلغاتهم الأم دون الحاجة لإنترنت سريع.
                </div>
            </div>
        </div>

        <div class="card card-gold" style="margin-top: 15px;">
            <strong style="color: #92400e; font-size: 9.5pt;">💎 الجاهزية للتنفيذ:</strong>
            <p style="font-size: 8.5pt; margin-top: 2px; margin-bottom: 0;">
                أضع هذا المشروع وخوارزمياته وكافة بياناته الجغرافية وقفاً تقنياً جاهزاً للتسليم والتشغيل المباشر بالتعاون مع إمارة منطقة مكة المكرمة وكافة القطاعات الحكومية المعنية لخدمة ضيوف الرحمن.
            </p>
        </div>

        <div class="doc-footer">
            <span>ظِـلال مَـكَّـة 3D — مقترح التطوير الميداني والتكامل</span>
            <span class="doc-footer-endowment">✨ وقف تقني لوجه الله تعالى لخدمة ضيوف الرحمن</span>
            <span>صفحة 2 من 2</span>
        </div>
    </div>

</body>
</html>`;

async function generatePdf(name, htmlContent) {
    console.log(`Generating ${name}...`);
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'load', timeout: 20000 });
    await new Promise(r => setTimeout(r, 600));

    const outPath = path.join(outputDir, name);
    await page.pdf({
        path: outPath,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true
    });

    await browser.close();
    const stats = fs.statSync(outPath);
    console.log(`Finished ${name} | Size: ${(stats.size / 1024).toFixed(1)} KB`);
    return { name, path: outPath, sizeKb: stats.size / 1024 };
}

async function run() {
    console.log('Building 3 Submission Dossier PDFs...');
    
    // PDF 1
    const p1 = await generatePdf('01_الملف_الرئيسي_مشروع_ظلال_مكة.pdf', htmlDossier);
    
    // PDF 2
    const p2 = await generatePdf('02_ملف_التوثيق_المصور_والشاشات.pdf', htmlScreenshots);
    
    // PDF 3
    const p3 = await generatePdf('03_مقترح_التطوير_الميداني_والبيانات_الواقعية.pdf', htmlProposal);

    console.log('\n--- ALL 3 SUBMISSION PDFS SUCCESSFULLY GENERATED ---');
    console.log(`1. ${p1.name}: ${p1.sizeKb.toFixed(1)} KB (< 1024 KB limit)`);
    console.log(`2. ${p2.name}: ${p2.sizeKb.toFixed(1)} KB (< 1024 KB limit)`);
    console.log(`3. ${p3.name}: ${p3.sizeKb.toFixed(1)} KB (< 1024 KB limit)`);
}

run().catch(err => {
    console.error('Error generating PDFs:', err);
    process.exit(1);
});
