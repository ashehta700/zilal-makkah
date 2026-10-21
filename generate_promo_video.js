const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ffmpegPath = 'D:\\prog\\ffmpeg-8.0.1-essentials_build\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe';
const capturesDir = path.join(__dirname, 'demo_captures');
const slidesDir = path.join(capturesDir, 'promo_slides');

if (!fs.existsSync(slidesDir)) {
    fs.mkdirSync(slidesDir, { recursive: true });
}

// Convert image file to file URL
function toFileUrl(filePath) {
    return `file:///${filePath.replace(/\\/g, '/')}`;
}

const scenes = [
    {
        id: 'scene_01',
        bg: '01_haram_overview.png',
        durationSec: 6,
        badge: '🕋 نظام الملاحة المناخي الذكي لضيوف الرحمن',
        badgeColor: 'rgba(16, 185, 129, 0.9)',
        title: '«ظِلال مكّة» | حماية ضيوف الرحمن من حرارة الشمس',
        desc: 'في صيف مكة المكرمة، تتجاوز حرارة الأسفلت 50°C. خرائط الملاحة التقليدية تقود المعتمر في أقصر خط تحت أشعة الشمس المباشرة دون مراعاة خطر الإجهاد الحراري!'
    },
    {
        id: 'scene_02',
        bg: '02_dual_routes_noon.png',
        durationSec: 8,
        badge: '⚡ مقارنة المسارين | برج فندق ساعة مكة الملكي (فيرمونت)',
        badgeColor: 'rgba(217, 119, 6, 0.9)',
        title: 'مسار الظلال المبرد (28.4°C) مقابل أقصر مسار مكشوف (50.0°C)',
        desc: 'بمجرد اختيار فندقك، يحلل التطبيق البيئة الحرارية ليمنحك مسار الظلال المبرد بفارق تبريد يصل إلى 21.6°C عبر الأروقة المعمارية ومظلات رذاذ الماء التبخيري.'
    },
    {
        id: 'scene_03',
        bg: '03_morning_shadow.png',
        durationSec: 7,
        badge: '☀️ تتبع زاوية الشمس الفلكية | فترة الضحى (08:30 ص)',
        badgeColor: 'rgba(59, 130, 246, 0.9)',
        title: 'انكسار ظلال الأبراج غرباً وتكيف المسار الأخضر تلقائياً',
        desc: 'المسار ليس خطاً ثابتاً! ينحرف المسار الأخضر غرباً ليتتبع امتداد ظل برج الساعة الشاهق فوق رخام ثاسوس الأبيض العاكس للحرارة.'
    },
    {
        id: 'scene_04',
        bg: '04_afternoon_shadow.png',
        durationSec: 7,
        badge: '☀️ تتبع زاوية الشمس الفلكية | فترة العصر (04:15 م)',
        badgeColor: 'rgba(147, 51, 234, 0.9)',
        title: 'امتداد ظل برج الساعة شرقاً وتحول المسار بأكثر من 110 أمتار',
        desc: 'مع انكسار الشمس غرباً، يمتد ظل الأبراج الهائل نحو الشرق، فيتحول المسار تلقائياً عبر الساحة نحو أبراج الصفوة لتوفير أقصى درجات التبريد الطبيعي.'
    },
    {
        id: 'scene_05',
        bg: '05_mobile_peek.png',
        durationSec: 6,
        badge: '📱 تجربة الهواتف الذكية المتجاوبة',
        badgeColor: 'rgba(14, 165, 233, 0.9)',
        title: 'واجهة ملاحة تحاكي خرائط جوجل مع تحديد موقع GPS اللحظي',
        desc: 'شريط تلخيص سريع وقائمة سحب ذكية (Bottom Sheet) تمكن المعتمر من بدء الملاحة بنقرة واحدة ومعرفة درجة حرارة كل طريق فورياً.'
    },
    {
        id: 'scene_06',
        bg: '06_mobile_expanded.png',
        durationSec: 6,
        badge: '🤲 وقف تقني لوجه الله تعالى',
        badgeColor: 'rgba(16, 185, 129, 0.9)',
        title: '«ظِلال مكّة».. رفيق ضيف الرحمن لخطوات آمنة وميسرة',
        desc: 'وقفٌ تقني غير ربحي مسخّر لخدمة الحجاج والمعتمرين ووقايتهم من ضربات الشمس.. تقبل الله طاعتكم وكتب أجركم 🕋'
    }
];

function generateHtml(scene) {
    const bgUrl = toFileUrl(path.join(capturesDir, scene.bg));
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            width: 1920px;
            height: 1080px;
            overflow: hidden;
            background: #020617;
            font-family: 'Segoe UI', Tahoma, 'Cairo', Arial, sans-serif;
            position: relative;
        }
        .bg-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
        }
        /* Top Branding Header */
        .top-header {
            position: absolute;
            top: 30px;
            right: 40px;
            display: flex;
            align-items: center;
            gap: 16px;
            background: rgba(15, 23, 42, 0.88);
            border: 1px solid rgba(212, 175, 55, 0.4);
            padding: 12px 24px;
            border-radius: 9999px;
            backdrop-filter: blur(12px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            z-index: 10;
        }
        .logo-text {
            color: #FEF08A;
            font-weight: 800;
            font-size: 24px;
            letter-spacing: -0.5px;
        }
        .logo-sub {
            color: #94A3B8;
            font-size: 14px;
            border-right: 1px solid rgba(255,255,255,0.2);
            padding-right: 16px;
            margin-right: 8px;
        }
        /* Bottom Lower Third Card */
        .lower-third {
            position: absolute;
            bottom: 40px;
            right: 40px;
            left: 40px;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(2, 6, 23, 0.96) 100%);
            border: 1.5px solid rgba(212, 175, 55, 0.5);
            border-radius: 24px;
            padding: 26px 36px;
            backdrop-filter: blur(20px);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
            z-index: 10;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .badge-pill {
            align-self: flex-start;
            background: ${scene.badgeColor};
            color: #FFFFFF;
            font-size: 15px;
            font-weight: 700;
            padding: 6px 18px;
            border-radius: 9999px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .title-text {
            color: #F8FAFC;
            font-size: 32px;
            font-weight: 800;
            line-height: 1.25;
            text-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        .desc-text {
            color: #CBD5E1;
            font-size: 20px;
            font-weight: 500;
            line-height: 1.5;
        }
        .progress-bar {
            position: absolute;
            bottom: 0;
            right: 0;
            left: 0;
            height: 5px;
            background: linear-gradient(to left, #10B981, #D4AF37);
            border-bottom-left-radius: 24px;
            border-bottom-right-radius: 24px;
        }
    </style>
</head>
<body>
    <img src="${bgUrl}" class="bg-image" />
    
    <div class="top-header">
        <span class="logo-text">🕋 ظِلال مكّة</span>
        <span class="logo-sub">Zilal Makkah | الملاحة المناخية الذكية</span>
    </div>

    <div class="lower-third">
        <div class="badge-pill">${scene.badge}</div>
        <h1 class="title-text">${scene.title}</h1>
        <p class="desc-text">${scene.desc}</p>
        <div class="progress-bar"></div>
    </div>
</body>
</html>`;
}

// Generate walking frames with lower-third overlay
function generateWalkFrameHtml(frameFileName, frameIdx, totalFrames) {
    const bgUrl = toFileUrl(path.join(capturesDir, frameFileName));
    const progPct = Math.round((frameIdx / totalFrames) * 100);
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            width: 1920px;
            height: 1080px;
            overflow: hidden;
            background: #000;
            font-family: 'Segoe UI', Tahoma, 'Cairo', Arial, sans-serif;
            position: relative;
        }
        .bg-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .top-header {
            position: absolute;
            top: 30px;
            right: 40px;
            display: flex;
            align-items: center;
            gap: 16px;
            background: rgba(15, 23, 42, 0.88);
            border: 1px solid rgba(212, 175, 55, 0.4);
            padding: 12px 24px;
            border-radius: 9999px;
            backdrop-filter: blur(12px);
            z-index: 10;
        }
        .logo-text { color: #FEF08A; font-weight: 800; font-size: 24px; }
        .logo-sub { color: #94A3B8; font-size: 14px; border-right: 1px solid rgba(255,255,255,0.2); padding-right: 16px; margin-right: 8px; }
        .lower-third {
            position: absolute;
            bottom: 40px;
            right: 40px;
            left: 40px;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(2, 6, 23, 0.96) 100%);
            border: 1.5px solid rgba(16, 185, 129, 0.5);
            border-radius: 24px;
            padding: 24px 36px;
            backdrop-filter: blur(20px);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
            z-index: 10;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .badge-pill {
            align-self: flex-start;
            background: rgba(16, 185, 129, 0.9);
            color: #FFFFFF;
            font-size: 15px;
            font-weight: 700;
            padding: 5px 16px;
            border-radius: 9999px;
        }
        .title-text { color: #F8FAFC; font-size: 30px; font-weight: 800; }
        .desc-text { color: #CBD5E1; font-size: 19px; font-weight: 500; }
        .progress-track {
            width: 100%;
            height: 6px;
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
            margin-top: 6px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            width: ${progPct}%;
            background: linear-gradient(to left, #34D399, #10B981);
        }
    </style>
</head>
<body>
    <img src="${bgUrl}" class="bg-image" />
    <div class="top-header">
        <span class="logo-text">🕋 ظِلال مكّة</span>
        <span class="logo-sub">محاكاة الملاحة الميدانية للمعتمر 3D</span>
    </div>
    <div class="lower-third">
        <div class="badge-pill">🚶‍♂️ محاكاة السير الميداني الحية (3D Tracking)</div>
        <h1 class="title-text">تتبع المعتمر بملابس الإحرام والهالة المضيئة نحو باب الملك عبدالعزيز</h1>
        <p class="desc-text">المعتمر يسير في الأروقة المظللة والمبردة برذاذ الماء التبخيري مع شريط الإرشادات الحرارية اللحظي (HUD).</p>
        <div class="progress-track"><div class="progress-fill"></div></div>
    </div>
</body>
</html>`;
}

async function run() {
    console.log('Launching browser to render composite slides...');
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: ['--window-size=1920,1080', '--no-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const renderedSlides = [];

    // 1. Render static scene slides
    for (let i = 0; i < scenes.length; i++) {
        const sc = scenes[i];
        console.log(`Rendering slide ${i+1}/${scenes.length}: ${sc.id}...`);
        const html = generateHtml(sc);
        await page.setContent(html, { waitUntil: 'load', timeout: 10000 });
        await new Promise(r => setTimeout(r, 400));
        const outPath = path.join(slidesDir, `slide_${String(i+1).padStart(2, '0')}.png`);
        await page.screenshot({ path: outPath });
        renderedSlides.push({ path: outPath, duration: sc.durationSec });
    }

    // 2. Render walking frames
    console.log('Rendering 3D walking frames with lower-third...');
    const walkFrames = [];
    for (let i = 1; i <= 15; i++) {
        const frameFileName = `frame_${String(i).padStart(3, '0')}.png`;
        const html = generateWalkFrameHtml(frameFileName, i, 15);
        await page.setContent(html, { waitUntil: 'load', timeout: 10000 });
        await new Promise(r => setTimeout(r, 150));
        const outPath = path.join(slidesDir, `walk_slide_${String(i).padStart(3, '0')}.png`);
        await page.screenshot({ path: outPath });
        walkFrames.push(outPath);
    }

    await browser.close();
    console.log('All composite slides rendered successfully!');

    // 3. Assemble full video using ffmpeg
    console.log('Assembling video with ffmpeg...');
    
    // First, make walking clip from frames (15 frames @ 2 fps = 7.5 seconds)
    const walkClipPath = path.join(slidesDir, 'clip_walk.mp4');
    const walkCmd = `"${ffmpegPath}" -y -framerate 2 -i "${slidesDir}\\walk_slide_%03d.png" -c:v libx264 -pix_fmt yuv420p -r 30 "${walkClipPath}"`;
    execSync(walkCmd);

    // Make video clips for each static slide
    const clipPaths = [];
    for (let i = 0; i < renderedSlides.length; i++) {
        const slide = renderedSlides[i];
        const clipPath = path.join(slidesDir, `clip_slide_${i+1}.mp4`);
        const cmd = `"${ffmpegPath}" -y -loop 1 -i "${slide.path}" -t ${slide.duration} -c:v libx264 -pix_fmt yuv420p -r 30 "${clipPath}"`;
        execSync(cmd);
        clipPaths.push(clipPath);

        // Insert walk clip right after scene 4 (afternoon shadow)
        if (i === 3) {
            clipPaths.push(walkClipPath);
        }
    }

    // Concat all clips into final video
    const concatListPath = path.join(slidesDir, 'concat_list.txt');
    const concatContent = clipPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent, 'utf8');

    const finalVideoPath = path.join(capturesDir, 'zilal_makkah_official_demo.mp4');
    const finalCmd = `"${ffmpegPath}" -y -f concat -safe 0 -i "${concatListPath.replace(/\\/g, '/')}" -c:v libx264 -pix_fmt yuv420p "${finalVideoPath}"`;
    execSync(finalCmd);

    console.log('Final Demo Video successfully created at:', finalVideoPath);
}

run().catch(err => {
    console.error('Error generating promo video:', err);
    process.exit(1);
});
