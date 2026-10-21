// Script to automate browser screenshots and video creation for Zilal Makkah demo
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function run() {
    let puppeteer;
    try {
        puppeteer = require('puppeteer-core');
    } catch(e) {
        console.error('puppeteer-core not yet installed');
        process.exit(1);
    }

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (!fs.existsSync(chromePath)) {
        console.error('Chrome not found at', chromePath);
        process.exit(1);
    }

    const outputDir = path.join(__dirname, 'demo_captures');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('Launching Chrome with GPU acceleration...');
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: [
            '--window-size=1920,1080',
            '--use-gl=angle',
            '--use-angle=d3d11',
            '--enable-webgl',
            '--ignore-gpu-blocklist',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
        defaultViewport: {
            width: 1920,
            height: 1080
        }
    });

    const page = await browser.newPage();
    console.log('Navigating to http://localhost:8080/index.html ...');
    await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait 5 seconds for Cesium 3D scene & 3D buildings to load
    await new Promise(r => setTimeout(r, 6000));

    console.log('Capturing Scene 1: Overview...');
    await page.screenshot({ path: path.join(outputDir, '01_haram_overview.png') });

    // Select Fairmont Clock Tower
    console.log('Selecting Fairmont Clock Tower...');
    await page.evaluate(() => {
        if (window.app) {
            window.app.selectHotelByName('ساعة مكة');
        }
    });
    await new Promise(r => setTimeout(r, 3500));

    console.log('Capturing Scene 2: Dual Routes (Noon)...');
    await page.screenshot({ path: path.join(outputDir, '02_dual_routes_noon.png') });

    // Move time slider to Morning (08:30)
    console.log('Simulating Morning Solar Shadow...');
    await page.evaluate(() => {
        const slider = document.getElementById('time-slider');
        if (slider) {
            slider.value = 8 * 60 + 30;
            slider.dispatchEvent(new Event('input'));
        }
    });
    await new Promise(r => setTimeout(r, 2500));
    console.log('Capturing Scene 3A: Morning Shadow...');
    await page.screenshot({ path: path.join(outputDir, '03_morning_shadow.png') });

    // Move time slider to Afternoon (16:15)
    console.log('Simulating Afternoon Solar Shadow (Eastward)...');
    await page.evaluate(() => {
        const slider = document.getElementById('time-slider');
        if (slider) {
            slider.value = 16 * 60 + 15;
            slider.dispatchEvent(new Event('input'));
        }
    });
    await new Promise(r => setTimeout(r, 2500));
    console.log('Capturing Scene 3B: Afternoon Shadow...');
    await page.screenshot({ path: path.join(outputDir, '04_afternoon_shadow.png') });

    // Start 3D Pilgrim Simulation
    console.log('Starting 3D Pilgrim Navigation...');
    await page.evaluate(() => {
        const btn3D = document.getElementById('btn-perspective-3d');
        if (btn3D) btn3D.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Capture walking animation sequence frames
    console.log('Capturing 3D Pilgrim walk sequence frames...');
    for (let i = 1; i <= 15; i++) {
        await new Promise(r => setTimeout(r, 500));
        const frameNum = String(i).padStart(3, '0');
        await page.screenshot({ path: path.join(outputDir, `frame_${frameNum}.png`) });
    }

    // Switch to Mobile Viewport
    console.log('Testing Mobile Google Maps Responsive View...');
    await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(outputDir, '05_mobile_peek.png') });

    // Expand mobile bottom sheet
    await page.evaluate(() => {
        if (window.app) {
            window.app.setBottomSheetState('expanded');
        }
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(outputDir, '06_mobile_expanded.png') });

    await browser.close();
    console.log('All captures completed successfully in:', outputDir);
}

run().catch(err => {
    console.error('Error running capture:', err);
    process.exit(1);
});
