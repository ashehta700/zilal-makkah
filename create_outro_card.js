const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ffmpegPath = 'D:\\prog\\ffmpeg-8.0.1-essentials_build\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe';
const outDir = path.join(__dirname, 'demo_captures');
const cardPngPath = path.join(outDir, 'zilal_makkah_outro_card.png');
const outroMp4Path = path.join(outDir, 'zilal_makkah_outro.mp4');

const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,700;1,700&family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@500;700;800;900&display=swap');

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            width: 1920px;
            height: 1080px;
            overflow: hidden;
            background: #020617;
            font-family: 'Cairo', 'Tajawal', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }

        /* Luxury Dark Background with Emerald & Gold Ambient Radiance */
        .bg-layer {
            position: absolute;
            inset: 0;
            background: 
                radial-gradient(circle at 50% 45%, rgba(6, 78, 59, 0.35) 0%, rgba(2, 44, 34, 0.2) 35%, rgba(2, 6, 23, 0.98) 75%),
                linear-gradient(180deg, #020617 0%, #03130d 50%, #020617 100%);
            z-index: 1;
        }

        /* Subtle Islamic Geometric Arch Vector in Background */
        .islamic-pattern {
            position: absolute;
            inset: 0;
            z-index: 2;
            opacity: 0.07;
            background-image: url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23D4AF37' fill-rule='evenodd'%3E%3Cpath d='M40 0l40 40-40 40L0 40z' fill-opacity='0.6' fill='none' stroke='%23D4AF37' stroke-width='1.2'/%3E%3Ccircle cx='40' cy='40' r='18' fill='none' stroke='%23D4AF37' stroke-width='1.2'/%3E%3Cpolygon points='40,25 45,35 55,40 45,45 40,55 35,45 25,40 35,35' fill='none' stroke='%23D4AF37' stroke-width='0.8'/%3E%3C/g%3E%3C/svg%3E");
        }

        /* Outer Frame with Royal Double Gold Border */
        .frame-border {
            position: absolute;
            inset: 36px;
            border: 1px solid rgba(212, 175, 55, 0.25);
            border-radius: 32px;
            z-index: 3;
            pointer-events: none;
        }

        .frame-border-inner {
            position: absolute;
            inset: 48px;
            border: 1px solid rgba(212, 175, 55, 0.12);
            border-radius: 24px;
            z-index: 3;
            pointer-events: none;
        }

        /* Corner Islamic Ornament Accents */
        .corner {
            position: absolute;
            width: 40px;
            height: 40px;
            border-color: #D4AF37;
            border-style: solid;
            z-index: 4;
            opacity: 0.6;
        }
        .corner-tl { top: 44px; right: 44px; border-width: 2.5px 2.5px 0 0; border-top-right-radius: 12px; }
        .corner-tr { top: 44px; left: 44px; border-width: 2.5px 0 0 2.5px; border-top-left-radius: 12px; }
        .corner-bl { bottom: 44px; right: 44px; border-width: 0 2.5px 2.5px 0; border-bottom-right-radius: 12px; }
        .corner-br { bottom: 44px; left: 44px; border-width: 0 0 2.5px 2.5px; border-bottom-left-radius: 12px; }

        /* Main Center Card */
        .main-card {
            position: relative;
            z-index: 10;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            max-width: 1400px;
            padding: 20px 40px;
        }

        /* Emblem / Logo Icon */
        .emblem-wrapper {
            position: relative;
            margin-bottom: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .emblem-glow {
            position: absolute;
            width: 160px;
            height: 160px;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(212, 175, 55, 0.2) 50%, transparent 70%);
            border-radius: 50%;
            filter: blur(20px);
        }

        .emblem-box {
            position: relative;
            width: 100px;
            height: 100px;
            background: linear-gradient(145deg, #042f2e 0%, #021914 100%);
            border: 2px solid rgba(212, 175, 55, 0.7);
            border-radius: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .kaaba-icon {
            font-size: 48px;
            filter: drop-shadow(0 4px 12px rgba(212, 175, 55, 0.4));
        }

        /* App Name */
        .app-title {
            font-size: 72px;
            font-weight: 900;
            letter-spacing: -1px;
            background: linear-gradient(135deg, #FFFBEB 0%, #FEF08A 25%, #F59E0B 75%, #D97706 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 4px 30px rgba(245, 158, 11, 0.25);
            margin-bottom: 8px;
            line-height: 1.15;
        }

        .app-subtitle-en {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: 12px;
            text-indent: 12px;
            color: #94A3B8;
            margin-bottom: 34px;
            text-transform: uppercase;
        }

        /* Golden Divider Line with Center Rhombus */
        .gold-divider {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            width: 700px;
            margin-bottom: 36px;
        }

        .divider-line {
            flex: 1;
            height: 1px;
            background: linear-gradient(to left, rgba(212, 175, 55, 0.6), transparent);
        }
        .divider-line.right {
            background: linear-gradient(to right, rgba(212, 175, 55, 0.6), transparent);
        }

        .divider-diamond {
            width: 10px;
            height: 10px;
            background: #F59E0B;
            transform: rotate(45deg);
            box-shadow: 0 0 12px #F59E0B;
        }

        /* Slogan (The Hero) */
        .slogan-container {
            position: relative;
            margin-bottom: 24px;
        }

        .slogan-text {
            font-family: 'Cairo', 'Amiri', serif;
            font-size: 56px;
            font-weight: 800;
            color: #FFFFFF;
            line-height: 1.3;
            letter-spacing: 0.5px;
            text-shadow: 0 4px 20px rgba(0, 0, 0, 0.8), 0 0 40px rgba(52, 211, 153, 0.3);
        }

        .slogan-highlight {
            background: linear-gradient(135deg, #6EE7B7 0%, #34D399 50%, #10B981 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 900;
            display: inline-block;
        }

        .slogan-sub {
            font-size: 24px;
            font-weight: 600;
            color: #CBD5E1;
            margin-bottom: 40px;
            max-width: 900px;
            line-height: 1.5;
        }

        /* Bottom Endowment & Link Badge */
        .bottom-badge-container {
            display: flex;
            align-items: center;
            gap: 24px;
        }

        .endowment-pill {
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(15, 23, 42, 0.85);
            border: 1.5px solid rgba(212, 175, 55, 0.45);
            padding: 12px 28px;
            border-radius: 9999px;
            backdrop-filter: blur(16px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        }

        .endowment-text {
            color: #FEF08A;
            font-size: 19px;
            font-weight: 700;
        }

        .url-pill {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(6, 78, 59, 0.5);
            border: 1.5px solid rgba(52, 211, 153, 0.5);
            padding: 12px 28px;
            border-radius: 9999px;
            backdrop-filter: blur(16px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        }

        .url-text {
            color: #A7F3D0;
            font-size: 19px;
            font-weight: 700;
            font-family: 'Tajawal', sans-serif;
            letter-spacing: 0.5px;
            direction: ltr;
        }

        /* Subtle Bottom Accent Glow */
        .bottom-glow {
            position: absolute;
            bottom: -80px;
            width: 800px;
            height: 160px;
            background: radial-gradient(ellipse at center, rgba(16, 185, 129, 0.3) 0%, transparent 70%);
            border-radius: 50%;
            filter: blur(40px);
            z-index: 2;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <div class="bg-layer"></div>
    <div class="islamic-pattern"></div>
    <div class="bottom-glow"></div>

    <div class="frame-border"></div>
    <div class="frame-border-inner"></div>

    <div class="corner corner-tl"></div>
    <div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div>
    <div class="corner corner-br"></div>

    <div class="main-card">
        <div class="emblem-wrapper">
            <div class="emblem-glow"></div>
            <div class="emblem-box">
                <span class="kaaba-icon">🕋</span>
            </div>
        </div>

        <h1 class="app-title">ظِـلَال مَـكَّـة</h1>
        <div class="app-subtitle-en">Z I L A L &nbsp; M A K K A H</div>

        <div class="gold-divider">
            <div class="divider-line"></div>
            <div class="divider-diamond"></div>
            <div class="divider-line right"></div>
        </div>

        <div class="slogan-container">
            <div class="slogan-text">
                « <span class="slogan-highlight">طَرِيقُكَ الأَبْرَد..</span> إِلَى أَطْهَرِ بَيْت »
            </div>
        </div>

        <p class="slogan-sub">
            الملاحة المناخية الذكية لحماية ضيوف الرحمن من ضربات الشمس والإجهاد الحراري
        </p>

        <div class="bottom-badge-container">
            <div class="endowment-pill">
                <span class="endowment-text">✨ وَقْفٌ تَقْنِيٌّ لِوَجْهِ اللَّهِ تَعَالَى</span>
            </div>
            <div class="url-pill">
                <span class="url-text">ashehta700.github.io/zilal-makkah</span>
            </div>
        </div>
    </div>
</body>
</html>`;

async function run() {
    console.log('Rendering 4K-Ready Luxury Outro Card...');
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: ['--window-size=1920,1080', '--no-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setContent(htmlContent, { waitUntil: 'load', timeout: 15000 });
    
    // Wait for fonts to stabilize
    await new Promise(r => setTimeout(r, 600));

    await page.screenshot({ path: cardPngPath });
    await browser.close();
    console.log('Outro Card PNG successfully rendered at:', cardPngPath);

    // Convert into a 5-second cinematic MP4 outro video clip with subtle fade-in
    console.log('Encoding 5-second outro video clip with ffmpeg...');
    const ffmpegCmd = `"${ffmpegPath}" -y -loop 1 -i "${cardPngPath}" -vf "fade=t=in:st=0:d=0.8,fade=t=out:st=4.2:d=0.8" -t 5 -c:v libx264 -pix_fmt yuv420p -r 30 "${outroMp4Path}"`;
    execSync(ffmpegCmd);
    console.log('Outro Video MP4 successfully created at:', outroMp4Path);

    // Also create complete demo video with outro appended
    console.log('Creating full demo video including this outro...');
    const existingVideo = path.join(outDir, 'zilal_makkah_official_demo.mp4');
    const fullVideoWithOutro = path.join(outDir, 'zilal_makkah_full_with_outro.mp4');
    const concatTxt = path.join(outDir, 'concat_outro.txt');
    
    fs.writeFileSync(concatTxt, `file '${existingVideo.replace(/\\/g, '/')}'\nfile '${outroMp4Path.replace(/\\/g, '/')}'`, 'utf8');
    const fullConcatCmd = `"${ffmpegPath}" -y -f concat -safe 0 -i "${concatTxt.replace(/\\/g, '/')}" -c:v libx264 -pix_fmt yuv420p "${fullVideoWithOutro}"`;
    execSync(fullConcatCmd);
    console.log('Complete video with outro created at:', fullVideoWithOutro);
}

run().catch(err => {
    console.error('Error rendering outro:', err);
    process.exit(1);
});
