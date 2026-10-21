/**
 * 360° Street-Level Panoramic View Engine for Makkah Pedestrian Walkways
 * Renders 360 Photosphere simulations and links to real Makkah street coordinates
 */

class StreetView360 {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.isUserInteracting = false;
        this.lon = 0;
        this.lat = 0;
        this.phi = 0;
        this.theta = 0;
        this.onPointerDownPointerX = 0;
        this.onPointerDownPointerY = 0;
        this.onPointerDownLon = 0;
        this.onPointerDownLat = 0;
        this.isInitialized = false;
        this.currentCoords = [21.4203, 39.8155];
    }

    init() {
        if (!this.container || this.isInitialized) return;

        const width = this.container.clientWidth || 500;
        const height = this.container.clientHeight || 320;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, width / height, 1, 1100);
        this.camera.target = new THREE.Vector3(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(width, height);
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // Build procedural 360 Makkah street cylinder/sphere environment
        this.buildProceduralMakkahEnvironment();

        // Mouse & Touch controls for 360 look around
        this.setupEventListeners();

        this.isInitialized = true;
        this.animate();
    }

    buildProceduralMakkahEnvironment() {
        // High-segment sphere for panorama
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1); // invert faces inward

        // Generate procedural texture of Makkah skyline, towers, marble pavement, and sky
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // Sky gradient (warm Makkah sunny sky)
        const skyGrad = ctx.createLinearGradient(0, 0, 0, 512);
        skyGrad.addColorStop(0, '#1e3a8a');
        skyGrad.addColorStop(0.4, '#60a5fa');
        skyGrad.addColorStop(0.7, '#fef3c7');
        skyGrad.addColorStop(1.0, '#fed7aa');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, 2048, 512);

        // Sun disc
        ctx.fillStyle = '#fffbeb';
        ctx.beginPath();
        ctx.arc(1024, 280, 45, 0, Math.PI * 2);
        ctx.fill();

        // Ground / Pavement (Makkah white marble & granite pavement with shadows)
        const groundGrad = ctx.createLinearGradient(0, 512, 0, 1024);
        groundGrad.addColorStop(0, '#cbd5e1'); // horizon marble
        groundGrad.addColorStop(0.2, '#f8fafc'); // reflective white marble
        groundGrad.addColorStop(0.6, '#334155'); // shade zone under arcade
        groundGrad.addColorStop(1.0, '#1e293b');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, 512, 2048, 512);

        // Tower Silhouettes & Modern Islamic Architecture (Abraj Al-Bait, Jabal Omar, Masar)
        // Clock Tower Silhouette
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(960, 100, 128, 412); // main tower
        ctx.beginPath();
        ctx.moveTo(960, 100);
        ctx.lineTo(1024, 20); // Spire
        ctx.lineTo(1088, 100);
        ctx.fill();
        // Clock dial
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(1024, 180, 30, 0, Math.PI * 2);
        ctx.fill();

        // Shaded Arcade & Masar Walkway Modern Canopies
        ctx.fillStyle = '#047857'; // Green Islamic arches
        for (let i = 0; i < 2048; i += 240) {
            ctx.fillRect(i + 20, 360, 30, 152); // pillars
            ctx.beginPath();
            ctx.arc(i + 120, 360, 80, Math.PI, 0); // arch
            ctx.fill();
        }

        // Texture creation
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
    }

    setupEventListeners() {
        const dom = this.renderer.domElement;

        dom.addEventListener('pointerdown', (e) => {
            this.isUserInteracting = true;
            this.onPointerDownPointerX = e.clientX;
            this.onPointerDownPointerY = e.clientY;
            this.onPointerDownLon = this.lon;
            this.onPointerDownLat = this.lat;
        });

        window.addEventListener('pointermove', (e) => {
            if (!this.isUserInteracting) return;
            this.lon = (this.onPointerDownPointerX - e.clientX) * 0.15 + this.onPointerDownLon;
            this.lat = (e.clientY - this.onPointerDownPointerY) * 0.15 + this.onPointerDownLat;
        });

        window.addEventListener('pointerup', () => {
            this.isUserInteracting = false;
        });
    }

    updateLocation(coords, title) {
        this.currentCoords = coords;
        const titleEl = document.getElementById('pano-title-text');
        const coordsEl = document.getElementById('pano-coords-text');
        const googleLink = document.getElementById('google-street-view-btn');

        if (titleEl) titleEl.innerText = title || 'شارع إبراهيم الخليل وممشى مسار';
        if (coordsEl) coordsEl.innerText = `${coords[0].toFixed(4)}° N, ${coords[1].toFixed(4)}° E`;
        if (googleLink) {
            googleLink.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords[0]},${coords[1]}`;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (!this.isUserInteracting) {
            this.lon += 0.05; // gentle ambient panning
        }

        this.lat = Math.max(-85, Math.min(85, this.lat));
        this.phi = THREE.MathUtils.degToRad(90 - this.lat);
        this.theta = THREE.MathUtils.degToRad(this.lon);

        const x = 500 * Math.sin(this.phi) * Math.cos(this.theta);
        const y = 500 * Math.cos(this.phi);
        const z = 500 * Math.sin(this.phi) * Math.sin(this.theta);

        if (this.camera) {
            this.camera.lookAt(x, y, z);
            this.renderer.render(this.scene, this.camera);
        }
    }
}

window.StreetView360 = StreetView360;
