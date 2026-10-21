/**
 * Interactive 3D Generative Canopy Studio using Three.js
 * Visualizes Smart Makkah Canopies, solar shadows, and structural mechanics
 */

class Canopy3DViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.canopyGroup = null;
        this.shadowMesh = null;
        this.sunLight = null;
        this.isInitialized = false;

        // Canopy parameters
        this.params = {
            span: 24, // meters
            height: 9, // meters
            isOpen: 1.0, // 0 to 1
            sunAltitude: 65, // degrees
            sunAzimuth: 180
        };
    }

    init() {
        if (this.isInitialized || !this.container) return;

        const width = this.container.clientWidth || 600;
        const height = this.container.clientHeight || 400;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a101d);

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(25, 20, 35);
        this.camera.lookAt(0, 5, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.8);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 100;
        this.sunLight.shadow.camera.left = -25;
        this.sunLight.shadow.camera.right = 25;
        this.sunLight.shadow.camera.top = 25;
        this.sunLight.shadow.camera.bottom = -25;
        this.scene.add(this.sunLight);

        // Ground Plane (Pavement with grid)
        const groundGeo = new THREE.PlaneGeometry(80, 80);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Grid helper
        const grid = new THREE.GridHelper(80, 40, 0x059669, 0x334155);
        grid.position.y = 0.02;
        this.scene.add(grid);

        // Build the Smart Makkah Canopy Structure
        this.buildCanopy();

        // Add Scale Reference Figures (Pedestrians)
        this.addPedestrians();

        // Mouse Drag Controls
        this.setupControls();

        // Update Sun
        this.updateSunPosition(this.params.sunAltitude, this.params.sunAzimuth);

        this.isInitialized = true;
        this.animate();
    }

    buildCanopy() {
        if (this.canopyGroup) {
            this.scene.remove(this.canopyGroup);
        }

        this.canopyGroup = new THREE.Group();

        // 1. Central Pillar (Octagonal Islamic Column)
        const pillarGeo = new THREE.CylinderGeometry(0.7, 0.9, this.params.height, 8);
        const pillarMat = new THREE.MeshStandardMaterial({
            color: 0xd4af37, // Islamic Gold / Brass
            metalness: 0.7,
            roughness: 0.3
        });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.y = this.params.height / 2;
        pillar.castShadow = true;
        this.canopyGroup.add(pillar);

        // 2. Pillar Base
        const baseGeo = new THREE.CylinderGeometry(1.6, 2.0, 1.2, 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.6;
        base.castShadow = true;
        this.canopyGroup.add(base);

        // 3. Canopy Crown / Hub
        const hubGeo = new THREE.CylinderGeometry(1.2, 0.8, 1.5, 12);
        const hub = new THREE.Mesh(hubGeo, pillarMat);
        hub.position.y = this.params.height;
        this.canopyGroup.add(hub);

        // 4. Expanding Geometric Canopy Wings / Membrane
        const wingCount = 8;
        const radius = (this.params.span / 2) * this.params.isOpen;

        // Fabric Material (High-Albedo Reflective Membrane with translucent look)
        const fabricMat = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.2,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        // Ribs Material
        const ribMat = new THREE.MeshStandardMaterial({
            color: 0x0f4c3a, // Saudi Deep Emerald
            metalness: 0.8,
            roughness: 0.2
        });

        for (let i = 0; i < wingCount; i++) {
            const angle1 = (i / wingCount) * Math.PI * 2;
            const angle2 = ((i + 1) / wingCount) * Math.PI * 2;

            // Rib Beam
            const ribGeo = new THREE.CylinderGeometry(0.12, 0.08, radius, 6);
            const rib = new THREE.Mesh(ribGeo, ribMat);
            rib.position.set(
                (Math.cos(angle1) * radius) / 2,
                this.params.height + 0.4,
                (Math.sin(angle1) * radius) / 2
            );
            rib.rotation.z = Math.PI / 2;
            rib.rotation.y = -angle1;
            rib.castShadow = true;
            this.canopyGroup.add(rib);

            // Membrane Segment
            const shape = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                0, this.params.height + 0.5, 0,
                Math.cos(angle1) * radius, this.params.height + 1.2, Math.sin(angle1) * radius,
                Math.cos(angle2) * radius, this.params.height + 1.2, Math.sin(angle2) * radius
            ]);
            shape.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            shape.computeVertexNormals();

            const membrane = new THREE.Mesh(shape, fabricMat);
            membrane.castShadow = true;
            membrane.receiveShadow = true;
            this.canopyGroup.add(membrane);
        }

        this.scene.add(this.canopyGroup);
    }

    addPedestrians() {
        const pedGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.75, 8);
        const pedMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });

        const positions = [
            [3, 0, 4],
            [-4, 0, 2],
            [5, 0, -3],
            [-2, 0, -5],
            [1, 0, -2]
        ];

        positions.forEach(pos => {
            const ped = new THREE.Mesh(pedGeo, pedMat);
            ped.position.set(pos[0], 0.875, pos[2]);
            ped.castShadow = true;
            this.scene.add(ped);
        });
    }

    updateSunPosition(altitude, azimuth) {
        this.params.sunAltitude = altitude;
        this.params.sunAzimuth = azimuth;

        const altRad = (altitude * Math.PI) / 180;
        const azRad = (azimuth * Math.PI) / 180;

        const distance = 45;
        const x = distance * Math.cos(altRad) * Math.sin(azRad);
        const y = distance * Math.sin(altRad);
        const z = distance * Math.cos(altRad) * Math.cos(azRad);

        if (this.sunLight) {
            this.sunLight.position.set(x, Math.max(1, y), z);
        }
    }

    setCanopySpan(spanMeters) {
        this.params.span = spanMeters;
        this.buildCanopy();
    }

    setupControls() {
        let isDragging = false;
        let prevMousePos = { x: 0, y: 0 };

        const canvas = this.renderer.domElement;

        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            prevMousePos = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - prevMousePos.x;
            const deltaY = e.clientY - prevMousePos.y;

            if (this.canopyGroup) {
                this.canopyGroup.rotation.y += deltaX * 0.008;
            }

            prevMousePos = { x: e.clientX, y: e.clientY };
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Gentle auto-rotation when idle
        if (this.canopyGroup) {
            this.canopyGroup.rotation.y += 0.002;
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

window.Canopy3DViewer = Canopy3DViewer;
