/**
 * Full 3D Makkah Urban Environment Engine (Three.js WebGL)
 * Realistic 3D Buildings, Towers, Streets, Pavements, and Real-Time Shadow Layer
 */

class Makkah3DWorld {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sunLight = null;
        this.ambientLight = null;
        this.buildings = [];
        this.streetMeshes = [];
        this.pilgrim = null;

        // Camera Modes: 'street' (Google Maps style) or 'aerial' (Cesium / Earth style)
        this.cameraMode = 'street';
        this.isInitialized = false;

        // Navigation state
        this.waypoints = [];
        this.currentWaypointIndex = 0;
        this.progressAlongSegment = 0;
        this.isNavigating = false;
        this.walkingSpeed = 0.012; // units per frame
    }

    init() {
        if (this.isInitialized || !this.container) return;

        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky Blue (Dynamic with sun)
        this.scene.fog = new THREE.FogExp2(0xd6e8fa, 0.0025);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(55, width / height, 0.5, 2000);
        this.camera.position.set(0, 15, 35);

        // 3. Renderer with High-Precision Shadow Maps
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;

        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // 4. Lighting & Dynamic Physical Sun
        this.setupLighting();

        // 5. Construct 3D Makkah City (Ground, Streets, Towers, and Haram)
        this.buildTerrainAndStreets();
        this.build3DBuildings();
        this.buildHaramCourtyard();

        // 6. Construct 3D Pilgrim Avatar (شخص معتمر بملابس الإحرام)
        this.buildPilgrimAvatar();

        // 7. Event Listeners
        window.addEventListener('resize', () => this.onWindowResize());
        this.setupOrbitControls();

        this.isInitialized = true;
        this.animate();
    }

    setupLighting() {
        this.ambientLight = new THREE.AmbientLight(0xfff7ed, 0.55);
        this.scene.add(this.ambientLight);

        // Directional Sun Light
        this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 1200;
        this.sunLight.shadow.bias = -0.0005;

        // Wide shadow frustum to cover city street canyons
        const d = 350;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;

        this.scene.add(this.sunLight);
        this.updateSunPosition(70, 185); // Default noon position
    }

    updateSunPosition(altitudeDeg, azimuthDeg) {
        const altRad = THREE.MathUtils.degToRad(altitudeDeg);
        const azRad = THREE.MathUtils.degToRad(azimuthDeg);

        const radius = 600;
        const x = radius * Math.cos(altRad) * Math.sin(azRad);
        const y = Math.max(15, radius * Math.sin(altRad));
        const z = radius * Math.cos(altRad) * Math.cos(azRad);

        this.sunLight.position.set(x, y, z);
        this.sunLight.target.position.set(0, 0, -100);
        this.scene.add(this.sunLight.target);

        // Adjust sky and atmospheric ambient according to sun altitude
        if (altitudeDeg < 15) {
            this.scene.background.setHex(0xfdba74); // Sunset orange
            this.scene.fog.color.setHex(0xfed7aa);
            this.ambientLight.intensity = 0.35;
        } else if (altitudeDeg > 55) {
            this.scene.background.setHex(0x93c5fd); // Blazing midday sky
            this.scene.fog.color.setHex(0xdbeafe);
            this.ambientLight.intensity = 0.65;
        } else {
            this.scene.background.setHex(0x60a5fa);
            this.scene.fog.color.setHex(0xcfe4ff);
            this.ambientLight.intensity = 0.5;
        }
    }

    buildTerrainAndStreets() {
        // Base Ground Plane (Makkah Valley)
        const groundGeo = new THREE.PlaneGeometry(1600, 1600);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.95
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Main Pedestrian Boulevard: "ممشى وجهة مسار وشارع إبراهيم الخليل"
        const streetGeo = new THREE.PlaneGeometry(32, 600);
        const streetMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b, // Asphalt
            roughness: 0.8
        });
        const street = new THREE.Mesh(streetGeo, streetMat);
        street.rotation.x = -Math.PI / 2;
        street.position.set(0, 0, -100);
        street.receiveShadow = true;
        this.scene.add(street);

        // Sidewalk / Shaded Walkways on both sides (White Heat-Reflective Marble)
        const marbleMat = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.25,
            metalness: 0.05
        });

        // Left Sidewalk
        const leftSidewalkGeo = new THREE.BoxGeometry(10, 0.4, 600);
        const leftSidewalk = new THREE.Mesh(leftSidewalkGeo, marbleMat);
        leftSidewalk.position.set(-21, 0.2, -100);
        leftSidewalk.receiveShadow = true;
        this.scene.add(leftSidewalk);

        // Right Sidewalk
        const rightSidewalk = new THREE.Mesh(leftSidewalkGeo, marbleMat);
        rightSidewalk.position.set(21, 0.2, -100);
        rightSidewalk.receiveShadow = true;
        this.scene.add(rightSidewalk);

        // Road Markings (White dashed lines)
        const lineGeo = new THREE.PlaneGeometry(0.8, 12);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let z = 180; z > -380; z -= 25) {
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, 0.05, z);
            this.scene.add(line);
        }

        // Add Street Light Pillars & Palm Trees along the sidewalk
        this.addStreetFurniture();
    }

    addStreetFurniture() {
        const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 7, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
        const lampMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

        for (let z = 180; z > -350; z -= 50) {
            [-15, 15].forEach(x => {
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.set(x, 3.5, z);
                pole.castShadow = true;
                this.scene.add(pole);

                const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4), lampMat);
                lamp.position.set(x, 7, z);
                this.scene.add(lamp);
            });
        }
    }

    build3DBuildings() {
        // 1. Abraj Al-Bait (برج الساعة الملكي - 601m)
        this.createClockTower(60, 0, -280);

        // 2. Jabal Omar Towers (ناطحات سحاب جبل عمر على جانبي الشارع)
        const jabalHeights = [140, 165, 180, 150, 175, 160];
        // West Side Towers (Jabal Omar Left)
        for (let i = 0; i < 4; i++) {
            const height = jabalHeights[i];
            this.createModernTower(-55, height, 100 - i * 90, 42, 65, 0x334155, 'أبراج جبل عمر الغربية');
        }

        // East Side Towers (Jabal Omar Right)
        for (let i = 0; i < 4; i++) {
            const height = jabalHeights[(i + 2) % jabalHeights.length];
            this.createModernTower(55, height, 100 - i * 90, 42, 65, 0x475569, 'أبراج وجهة مسار الفندقية');
        }

        // 3. Shaded Pedestrian Arcades (أروقة التبريد المظللة ذات العقود الإسلامية)
        this.createShadedArcade(-21, 0, -50, 280);
    }

    createModernTower(x, height, z, width, depth, colorHex, name) {
        const group = new THREE.Group();

        // Tower Body
        const towerGeo = new THREE.BoxGeometry(width, height, depth);
        const towerMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.3,
            metalness: 0.6
        });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = height / 2;
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);

        // Glass Window Grid Panels (Realistic texture effect)
        const windowGeo = new THREE.PlaneGeometry(width * 0.9, height * 0.95);
        const windowMat = new THREE.MeshStandardMaterial({
            color: 0x93c5fd,
            roughness: 0.1,
            metalness: 0.9
        });
        const frontWindows = new THREE.Mesh(windowGeo, windowMat);
        frontWindows.position.set(0, height / 2, depth / 2 + 0.1);
        group.add(frontWindows);

        group.position.set(x, 0, z);
        this.scene.add(group);
        this.buildings.push({ mesh: group, name: name, height: height });
    }

    createClockTower(x, y, z) {
        const clockGroup = new THREE.Group();
        const baseHeight = 280;
        const totalHeight = 420;

        // Base Podium
        const baseGeo = new THREE.BoxGeometry(70, baseHeight, 70);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.5 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = baseHeight / 2;
        base.castShadow = true;
        base.receiveShadow = true;
        clockGroup.add(base);

        // Clock Face Section
        const clockHeadGeo = new THREE.BoxGeometry(50, 60, 50);
        const clockHeadMat = new THREE.MeshStandardMaterial({ color: 0x0f4c3a, metalness: 0.8 });
        const clockHead = new THREE.Mesh(clockHeadGeo, clockHeadMat);
        clockHead.position.y = baseHeight + 30;
        clockHead.castShadow = true;
        clockGroup.add(clockHead);

        // Illuminated Clock Dial (Green Islamic Dial)
        const dialGeo = new THREE.CircleGeometry(16, 32);
        const dialMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const dial = new THREE.Mesh(dialGeo, dialMat);
        dial.position.set(0, baseHeight + 30, 25.2);
        clockGroup.add(dial);

        // Spire & Golden Crescent
        const spireGeo = new THREE.ConeGeometry(8, 75, 8);
        const spireMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
        const spire = new THREE.Mesh(spireGeo, spireMat);
        spire.position.y = baseHeight + 60 + 37.5;
        spire.castShadow = true;
        clockGroup.add(spire);

        clockGroup.position.set(x, y, z);
        this.scene.add(clockGroup);
    }

    createShadedArcade(x, y, z, length) {
        // Covered Islamic Arcade along the pedestrian path
        const arcadeGroup = new THREE.Group();
        const roofGeo = new THREE.BoxGeometry(12, 1, length);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 6.5, 0);
        roof.castShadow = true;
        roof.receiveShadow = true;
        arcadeGroup.add(roof);

        // Islamic Support Pillars
        const pillarGeo = new THREE.CylinderGeometry(0.4, 0.4, 6, 8);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7 });
        for (let pz = -length / 2 + 10; pz < length / 2; pz += 20) {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(5.5, 3, pz);
            pillar.castShadow = true;
            arcadeGroup.add(pillar);
        }

        arcadeGroup.position.set(x, y, z);
        this.scene.add(arcadeGroup);
    }

    buildHaramCourtyard() {
        // The Grand Mosque Courtyard (White Marble Plaza in distance)
        const courtyardGeo = new THREE.PlaneGeometry(350, 250);
        const courtyardMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.15,
            metalness: 0.05
        });
        const courtyard = new THREE.Mesh(courtyardGeo, courtyardMat);
        courtyard.rotation.x = -Math.PI / 2;
        courtyard.position.set(0, 0.2, -450);
        courtyard.receiveShadow = true;
        this.scene.add(courtyard);

        // Minarets (منارات الحرم المكي الشريف)
        [-70, 70].forEach(mx => {
            const minaretGeo = new THREE.CylinderGeometry(2, 3, 110, 8);
            const minaretMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.3 });
            const minaret = new THREE.Mesh(minaretGeo, minaretMat);
            minaret.position.set(mx, 55, -420);
            minaret.castShadow = true;
            this.scene.add(minaret);

            const crownGeo = new THREE.ConeGeometry(3, 18, 8);
            const crownMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9 });
            const crown = new THREE.Mesh(crownGeo, crownMat);
            crown.position.set(mx, 119, -420);
            crown.castShadow = true;
            this.scene.add(crown);
        });
    }

    buildPilgrimAvatar() {
        // Detailed 3D Pilgrim Model (معتمر بملابس الإحرام البيضاء)
        this.pilgrim = new THREE.Group();

        // 1. Head
        const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 2.4;
        head.castShadow = true;
        this.pilgrim.add(head);

        // 2. Upper Ihram Garment (رداء الإحرام الأبيض - Upper body fabric)
        const torsoGeo = new THREE.CylinderGeometry(0.48, 0.55, 1.1, 12);
        const ihramMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.85,
            side: THREE.DoubleSide
        });
        const torso = new THREE.Mesh(torsoGeo, ihramMat);
        torso.position.y = 1.65;
        torso.castShadow = true;
        this.pilgrim.add(torso);

        // 3. Lower Ihram Garment (إزار الإحرام الأبيض - Lower body fabric)
        const skirtGeo = new THREE.CylinderGeometry(0.55, 0.65, 1.0, 12);
        const skirt = new THREE.Mesh(skirtGeo, ihramMat);
        skirt.position.y = 0.75;
        skirt.castShadow = true;
        this.pilgrim.add(skirt);

        // 4. Arms
        const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.85, 8);
        this.leftArm = new THREE.Mesh(armGeo, skinMat);
        this.leftArm.position.set(-0.62, 1.6, 0);
        this.leftArm.castShadow = true;
        this.pilgrim.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo, skinMat);
        this.rightArm.position.set(0.62, 1.6, 0);
        this.rightArm.castShadow = true;
        this.pilgrim.add(this.rightArm);

        // 5. Directional Arrow & Navigation Beacon on Ground
        const arrowGeo = new THREE.ConeGeometry(0.6, 1.4, 3);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.rotation.x = Math.PI / 2;
        arrow.position.set(0, 0.05, -1.8);
        this.pilgrim.add(arrow);

        // Starting Position at Masar Walkway Entrance
        this.pilgrim.position.set(-21, 0, 150);
        this.scene.add(this.pilgrim);
    }

    setWaypoints(routeCoords) {
        // Map geographic waypoints into 3D world units
        this.waypoints = [
            new THREE.Vector3(-21, 0, 150),  // Masar Entrance
            new THREE.Vector3(-21, 0, 50),   // Under Left Arcade
            new THREE.Vector3(-21, 0, -60),  // Shaded Canyon between Jabal Omar
            new THREE.Vector3(-10, 0, -180), // Cross towards Haram plaza
            new THREE.Vector3(0, 0, -320),   // Clock Tower Foot
            new THREE.Vector3(0, 0, -420)    // King Abdulaziz Gate Plaza
        ];
        this.currentWaypointIndex = 0;
        this.progressAlongSegment = 0;
    }

    setCameraMode(mode) {
        this.cameraMode = mode;
        if (mode === 'aerial') {
            // Google Earth / Cesium 3D Globe Perspective
            this.camera.position.set(120, 240, 180);
            this.camera.lookAt(0, 40, -150);
        } else {
            // Google Maps 3D Cockpit / Street View Mode
            this.updateStreetViewCamera();
        }
    }

    updateStreetViewCamera() {
        if (!this.pilgrim) return;

        // Position camera behind and above the pilgrim looking down the street
        const pilgrimPos = this.pilgrim.position;
        const camOffset = new THREE.Vector3(0, 4.2, 11);
        this.camera.position.copy(pilgrimPos).add(camOffset);

        // Look forward towards the Grand Mosque and Clock Tower
        const lookTarget = pilgrimPos.clone().add(new THREE.Vector3(0, 1.8, -25));
        this.camera.lookAt(lookTarget);
    }

    setupOrbitControls() {
        let isMouseDown = false;
        let prevMouse = { x: 0, y: 0 };
        const dom = this.renderer.domElement;

        dom.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            prevMouse = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mouseup', () => {
            isMouseDown = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            const deltaX = e.clientX - prevMouse.x;
            const deltaY = e.clientY - prevMouse.y;

            if (this.cameraMode === 'aerial') {
                this.camera.position.x += deltaX * 0.4;
                this.camera.position.y -= deltaY * 0.4;
                this.camera.lookAt(0, 40, -150);
            } else {
                // Subtle look-around in street mode
                this.camera.rotation.y -= deltaX * 0.002;
            }

            prevMouse = { x: e.clientX, y: e.clientY };
        });
    }

    startNavigation() {
        this.isNavigating = true;
        this.setCameraMode('street');
    }

    pauseNavigation() {
        this.isNavigating = false;
    }

    resumeNavigation() {
        this.isNavigating = true;
    }

    onWindowResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Animate Pilgrim walking down the 3D street
        if (this.isNavigating && this.waypoints.length > 1) {
            const p1 = this.waypoints[this.currentWaypointIndex];
            const p2 = this.waypoints[this.currentWaypointIndex + 1];

            if (p2) {
                this.progressAlongSegment += this.walkingSpeed;

                // Arm swing animation while walking
                const swing = Math.sin(Date.now() * 0.008) * 0.4;
                if (this.leftArm && this.rightArm) {
                    this.leftArm.rotation.x = swing;
                    this.rightArm.rotation.x = -swing;
                }

                // Interpolate position
                this.pilgrim.position.lerpVectors(p1, p2, this.progressAlongSegment);

                // Look in direction of travel
                this.pilgrim.lookAt(p2.x, this.pilgrim.position.y, p2.z);

                if (this.progressAlongSegment >= 1.0) {
                    this.progressAlongSegment = 0;
                    this.currentWaypointIndex++;
                    if (this.currentWaypointIndex >= this.waypoints.length - 1) {
                        this.isNavigating = false;
                        if (window.onPilgrimArrived) window.onPilgrimArrived();
                    }
                }

                // Update Camera in Street Mode
                if (this.cameraMode === 'street') {
                    this.updateStreetViewCamera();
                }
            }
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

window.Makkah3DWorld = Makkah3DWorld;
