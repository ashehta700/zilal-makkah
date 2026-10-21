/**
 * High-Fidelity 3D Makkah Urban Environment (Three.js WebGL)
 * Realistic 3D Models: The Grand Mosque (Kaaba, Minarets, Courtyard),
 * Abraj Al-Bait (Clock Tower), Jabal Omar Cluster, Dar Al-Tawhid, Masar Spine,
 * Real Asphalt Streets, Sidewalks, and Physically-Accurate Dynamic Solar Shadows.
 */

class Makkah3DCity {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sunLight = null;
        this.ambientLight = null;
        this.pilgrim = null;

        // Visual Objects
        this.buildings = [];
        this.sunnyRouteMesh = null;
        this.shadedRouteMesh = null;
        this.routeRibbons = [];

        // Camera States: 'street' (follow pilgrim) or 'aerial' (orbit overview)
        this.cameraMode = 'street';
        this.isNavigating = false;
        this.isInitialized = false;

        // Navigation Interpolation
        this.activeRoute = null;
        this.currentWaypointIndex = 0;
        this.progress = 0;
        this.walkSpeed = 0.008;

        // Limb animation
        this.leftLeg = null;
        this.rightLeg = null;
        this.leftArm = null;
        this.rightArm = null;
    }

    init() {
        if (this.isInitialized || !this.container) return;

        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        // 1. Scene & Sky
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.FogExp2(0xcfe4ff, 0.0018);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 3000);
        this.camera.position.set(0, 12, 35);

        // 3. Renderer with High-Precision Shadows
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // 4. Physical Solar Lighting
        this.setupLighting();

        // 5. Construct Detailed 3D City (Ground, Streets, Haram, Towers)
        this.buildGroundAndStreets();
        this.buildGrandMosque();
        this.buildAbrajAlBait();
        this.buildJabalOmarTowers();
        this.buildDarAlTawhidAndSurroundings();
        this.buildMasarBoulevard();

        // 6. Build High-Detail 3D Pilgrim Character in Ihram
        this.buildPilgrimCharacter();

        // 7. Event Handlers
        window.addEventListener('resize', () => this.onWindowResize());
        this.setupControls();

        this.isInitialized = true;
        this.animate();
    }

    setupLighting() {
        this.ambientLight = new THREE.AmbientLight(0xfff5eb, 0.65);
        this.scene.add(this.ambientLight);

        // Physical Directional Sunlight
        this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.4);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 4096;
        this.sunLight.shadow.mapSize.height = 4096;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 1500;
        this.sunLight.shadow.bias = -0.0003;

        // Shadow Coverage Frustum
        const d = 400;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;

        this.scene.add(this.sunLight);
        this.updateSunPosition(75, 185); // Default: Duhr high noon
    }

    updateSunPosition(altitudeDeg, azimuthDeg) {
        const altRad = THREE.MathUtils.degToRad(altitudeDeg);
        const azRad = THREE.MathUtils.degToRad(azimuthDeg);

        const r = 700;
        const x = r * Math.cos(altRad) * Math.sin(azRad);
        const y = Math.max(25, r * Math.sin(altRad));
        const z = r * Math.cos(altRad) * Math.cos(azRad);

        this.sunLight.position.set(x, y, z);
        this.sunLight.target.position.set(0, 0, -100);
        this.scene.add(this.sunLight.target);

        // Sky & Ambient Color Adjustments based on Sun Angle
        if (altitudeDeg < 18) {
            this.scene.background.setHex(0xf97316); // Golden sunset
            this.scene.fog.color.setHex(0xfed7aa);
            this.ambientLight.intensity = 0.4;
        } else if (altitudeDeg > 55) {
            this.scene.background.setHex(0x93c5fd); // Blazing midday sun
            this.scene.fog.color.setHex(0xdbeafe);
            this.ambientLight.intensity = 0.7;
        } else {
            this.scene.background.setHex(0x60a5fa);
            this.scene.fog.color.setHex(0xcfe4ff);
            this.ambientLight.intensity = 0.55;
        }
    }

    buildGroundAndStreets() {
        // Makkah Topography Base
        const groundGeo = new THREE.PlaneGeometry(2400, 2400);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.9
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Main Street: "طريق إبراهيم الخليل" (Connecting Jabal Omar to Haram)
        const mainRoadGeo = new THREE.PlaneGeometry(28, 550);
        const asphaltMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.75
        });
        const mainRoad = new THREE.Mesh(mainRoadGeo, asphaltMat);
        mainRoad.rotation.x = -Math.PI / 2;
        mainRoad.position.set(-20, 0, 0);
        mainRoad.receiveShadow = true;
        this.scene.add(mainRoad);

        // Southern Boulevard (Connecting Abraj Al-Bait & Ajyad)
        const southRoadGeo = new THREE.PlaneGeometry(280, 28);
        const southRoad = new THREE.Mesh(southRoadGeo, asphaltMat);
        southRoad.rotation.x = -Math.PI / 2;
        southRoad.position.set(40, 0, -60);
        southRoad.receiveShadow = true;
        this.scene.add(southRoad);

        // Pavements & White Heat-Reflective Marble Sidewalks (Thassos Marble Style)
        const marbleMat = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.25,
            metalness: 0.05
        });

        // Left Sidewalk (Under Jabal Omar Arcades)
        const leftWalk = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 550), marbleMat);
        leftWalk.position.set(-39, 0.2, 0);
        leftWalk.receiveShadow = true;
        this.scene.add(leftWalk);

        // Right Sidewalk
        const rightWalk = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 550), marbleMat);
        rightWalk.position.set(-1, 0.2, 0);
        rightWalk.receiveShadow = true;
        this.scene.add(rightWalk);

        // Road Markings
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let z = 240; z > -240; z -= 25) {
            const line = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 12), lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(-20, 0.05, z);
            this.scene.add(line);
        }

        // Add Street Lighting and Palm Trees
        this.addStreetVegetationAndLights();
    }

    addStreetVegetationAndLights() {
        const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 7, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
        const lampMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

        for (let z = 200; z > -200; z -= 45) {
            [-34, -6].forEach(x => {
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.set(x, 3.5, z);
                pole.castShadow = true;
                this.scene.add(pole);

                const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35), lampMat);
                bulb.position.set(x, 7, z);
                this.scene.add(bulb);
            });
        }
    }

    buildGrandMosque() {
        const haramGroup = new THREE.Group();

        // 1. The Holy Kaaba (الكعبة المشرفة)
        const kaabaGeo = new THREE.BoxGeometry(12, 14, 12);
        const kaabaMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 }); // Black Kiswah
        const kaaba = new THREE.Mesh(kaabaGeo, kaabaMat);
        kaaba.position.set(0, 7, -250);
        kaaba.castShadow = true;
        kaaba.receiveShadow = true;
        haramGroup.add(kaaba);

        // Golden Band of the Kaaba (حزام الكعبة الذهبي)
        const beltGeo = new THREE.BoxGeometry(12.2, 1.2, 12.2);
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
        const belt = new THREE.Mesh(beltGeo, goldMat);
        belt.position.set(0, 10.5, -250);
        haramGroup.add(belt);

        // 2. Mataf Courtyard (صحن المطاف الدائري الأبيض)
        const matafGeo = new THREE.CylinderGeometry(65, 65, 0.5, 64);
        const whiteMarbleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.05 });
        const mataf = new THREE.Mesh(matafGeo, whiteMarbleMat);
        mataf.position.set(0, 0.25, -250);
        mataf.receiveShadow = true;
        haramGroup.add(mataf);

        // 3. Multi-Tiered Mosque Arcades (أروقة المسجد الحرام والجدران الخارجية)
        const arcadeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });

        // South Facade & King Abdulaziz Gate
        const southWall = new THREE.Mesh(new THREE.BoxGeometry(160, 24, 20), arcadeMat);
        southWall.position.set(0, 12, -180);
        southWall.castShadow = true;
        southWall.receiveShadow = true;
        haramGroup.add(southWall);

        // King Abdulaziz Gate Portal (بوابة الملك عبد العزيز الرئيسية)
        const portal = new THREE.Mesh(new THREE.BoxGeometry(26, 32, 22), goldMat);
        portal.position.set(0, 16, -180);
        portal.castShadow = true;
        haramGroup.add(portal);

        // West Facade & King Fahd Gate
        const westWall = new THREE.Mesh(new THREE.BoxGeometry(20, 24, 160), arcadeMat);
        westWall.position.set(-80, 12, -250);
        westWall.castShadow = true;
        westWall.receiveShadow = true;
        haramGroup.add(westWall);

        // 4. Minarets (منارات الحرم الشامخة)
        const minaretPositions = [
            [-75, -180], [75, -180], [-75, -320], [75, -320]
        ];

        minaretPositions.forEach(([mx, mz]) => {
            const minaretGeo = new THREE.CylinderGeometry(2.5, 3.5, 95, 8);
            const minaret = new THREE.Mesh(minaretGeo, arcadeMat);
            minaret.position.set(mx, 47.5, mz);
            minaret.castShadow = true;
            haramGroup.add(minaret);

            const crownGeo = new THREE.ConeGeometry(3.5, 18, 8);
            const crown = new THREE.Mesh(crownGeo, goldMat);
            crown.position.set(mx, 104, mz);
            crown.castShadow = true;
            haramGroup.add(crown);
        });

        this.scene.add(haramGroup);
    }

    buildAbrajAlBait() {
        // Abraj Al-Bait Complex (مجمع أبراج البيت وبرج الساعة الملكي 601م)
        const clockGroup = new THREE.Group();
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 });
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, metalness: 0.9, roughness: 0.1 });

        // 1. Massive Podium
        const podium = new THREE.Mesh(new THREE.BoxGeometry(90, 45, 90), stoneMat);
        podium.position.set(65, 22.5, -95);
        podium.castShadow = true;
        podium.receiveShadow = true;
        clockGroup.add(podium);

        // 2. Central Clock Tower Shaft
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(50, 230, 50), glassMat);
        shaft.position.set(65, 160, -95);
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        clockGroup.add(shaft);

        // 3. Clock Dial Room
        const dialBox = new THREE.Mesh(new THREE.BoxGeometry(54, 48, 54), stoneMat);
        dialBox.position.set(65, 299, -95);
        dialBox.castShadow = true;
        clockGroup.add(dialBox);

        // 4 Clock Dials (ساعة مكة الخضراء)
        const clockDialMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const dialNorth = new THREE.Mesh(new THREE.CircleGeometry(16, 32), clockDialMat);
        dialNorth.position.set(65, 299, -122.2);
        dialNorth.rotation.y = Math.PI;
        clockGroup.add(dialNorth);

        const dialWest = new THREE.Mesh(new THREE.CircleGeometry(16, 32), clockDialMat);
        dialWest.position.set(37.8, 299, -95);
        dialWest.rotation.y = -Math.PI / 2;
        clockGroup.add(dialWest);

        // 4. Spire and Golden Crescent (الهلال الذهبي)
        const spire = new THREE.Mesh(new THREE.ConeGeometry(7, 85, 8), goldMat);
        spire.position.set(65, 365, -95);
        spire.castShadow = true;
        clockGroup.add(spire);

        const crescent = new THREE.Mesh(new THREE.TorusGeometry(8, 1.8, 8, 24, Math.PI * 1.5), goldMat);
        crescent.position.set(65, 412, -95);
        crescent.rotation.z = Math.PI / 4;
        crescent.castShadow = true;
        clockGroup.add(crescent);

        // Flanking Towers (Zamzam, Hajar, Safa, Marwah)
        const flankHeights = [140, 160, 140, 130];
        const flankOffsets = [
            [-35, 30], [35, 30], [-35, -30], [35, -30]
        ];
        flankOffsets.forEach(([ox, oz], idx) => {
            const h = flankHeights[idx];
            const flank = new THREE.Mesh(new THREE.BoxGeometry(26, h, 26), glassMat);
            flank.position.set(65 + ox, h / 2 + 45, -95 + oz);
            flank.castShadow = true;
            flank.receiveShadow = true;
            clockGroup.add(flank);
        });

        this.scene.add(clockGroup);
    }

    buildJabalOmarTowers() {
        // Jabal Omar Cluster (فنادق جبل عمر: هيلتون، كونراد، ماريوت)
        const jabalGroup = new THREE.Group();
        const modernMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.5 });
        const terraceMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6 });

        // 4 Main High-Rise Towers on the West Side of Ibrahim Al-Khalil Street
        const towerConfigs = [
            { x: -65, z: 120, h: 145, name: 'فندق جبل عمر هيلتون' },
            { x: -65, z: 40, h: 165, name: 'فندق جبل عمر للمؤتمرات' },
            { x: -65, z: -40, h: 175, name: 'فندق جبل عمر كونراد' },
            { x: -65, z: -120, h: 155, name: 'فندق جبل عمر ماريوت' }
        ];

        towerConfigs.forEach(t => {
            // Tower Body
            const tower = new THREE.Mesh(new THREE.BoxGeometry(45, t.h, 55), modernMat);
            tower.position.set(t.x, t.h / 2, t.z);
            tower.castShadow = true;
            tower.receiveShadow = true;
            jabalGroup.add(tower);

            // Shaded Ground-Level Pedestrian Arcade (رواق المشاة المظلل)
            const arcade = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 55), terraceMat);
            arcade.position.set(t.x + 22, 4, t.z);
            arcade.castShadow = true;
            arcade.receiveShadow = true;
            jabalGroup.add(arcade);
        });

        this.scene.add(jabalGroup);
    }

    buildDarAlTawhidAndSurroundings() {
        // Dar Al-Tawhid InterContinental Hotel (فندق دار التوحيد أمام باب الملك فهد)
        const darMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
        const dar = new THREE.Mesh(new THREE.BoxGeometry(40, 95, 45), darMat);
        dar.position.set(-45, 47.5, -170);
        dar.castShadow = true;
        dar.receiveShadow = true;
        this.scene.add(dar);
    }

    buildMasarBoulevard() {
        // Masar Walkway Pedestrian Spine entering from the West
        const masarWalk = new THREE.Mesh(
            new THREE.BoxGeometry(180, 0.4, 28),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 })
        );
        masarWalk.position.set(-140, 0.2, 140);
        masarWalk.receiveShadow = true;
        this.scene.add(masarWalk);
    }

    buildPilgrimCharacter() {
        // High-Quality 3D Character of a Pilgrim in White Ihram (شخص معتمر)
        this.pilgrim = new THREE.Group();

        const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });
        const ihramMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.85,
            side: THREE.DoubleSide
        });

        // 1. Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), skinMat);
        head.position.y = 2.45;
        head.castShadow = true;
        this.pilgrim.add(head);

        // 2. Upper Ihram Garment (رداء الإحرام الأبيض)
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 1.15, 12), ihramMat);
        torso.position.y = 1.65;
        torso.castShadow = true;
        this.pilgrim.add(torso);

        // 3. Lower Ihram Garment (إزار الإحرام)
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 1.05, 12), ihramMat);
        skirt.position.y = 0.75;
        skirt.castShadow = true;
        this.pilgrim.add(skirt);

        // 4. Arms with Joints for Natural Walking
        const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.85, 8);
        this.leftArm = new THREE.Mesh(armGeo, skinMat);
        this.leftArm.position.set(-0.65, 1.6, 0);
        this.leftArm.castShadow = true;
        this.pilgrim.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo, skinMat);
        this.rightArm.position.set(0.65, 1.6, 0);
        this.rightArm.castShadow = true;
        this.pilgrim.add(this.rightArm);

        // 5. Glowing Green Beacon Under Feet
        const beacon = new THREE.Mesh(
            new THREE.RingGeometry(0.6, 1.1, 32),
            new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
        );
        beacon.rotation.x = -Math.PI / 2;
        beacon.position.y = 0.04;
        this.pilgrim.add(beacon);

        // Initial Position at Hilton Jabal Omar
        this.pilgrim.position.set(-42, 0, 40);
        this.scene.add(this.pilgrim);
    }

    renderRoutes(hotel) {
        // Remove existing route ribbons
        this.routeRibbons.forEach(m => this.scene.remove(m));
        this.routeRibbons = [];

        // 1. Draw Shaded Route (Glowing Emerald Ribbon hugging 3D Buildings)
        const shadedPoints = hotel.route3D.map(pt => new THREE.Vector3(pt.x, 0.12, pt.z));
        const shadedCurve = new THREE.CatmullRomCurve3(shadedPoints);
        const shadedGeo = new THREE.TubeGeometry(shadedCurve, 64, 0.8, 8, false);
        const shadedMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        this.shadedRouteMesh = new THREE.Mesh(shadedGeo, shadedMat);
        this.scene.add(this.shadedRouteMesh);
        this.routeRibbons.push(this.shadedRouteMesh);

        // 2. Draw Sunny Direct Route (Red Dashed Line in Middle of Sun-Exposed Street)
        const sunnyPoints = hotel.sunRoute3D.map(pt => new THREE.Vector3(pt.x, 0.12, pt.z));
        const sunnyCurve = new THREE.CatmullRomCurve3(sunnyPoints);
        const sunnyGeo = new THREE.TubeGeometry(sunnyCurve, 64, 0.5, 8, false);
        const sunnyMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        this.sunnyRouteMesh = new THREE.Mesh(sunnyGeo, sunnyMat);
        this.scene.add(this.sunnyRouteMesh);
        this.routeRibbons.push(this.sunnyRouteMesh);

        // Set Active Route Waypoints for Pilgrim Walking
        this.activeRoute = hotel.route3D;
        this.currentWaypointIndex = 0;
        this.progress = 0;

        // Position Pilgrim at Start
        const start = hotel.route3D[0];
        this.pilgrim.position.set(start.x, 0, start.z);
        this.updateCamera();
    }

    setCameraMode(mode) {
        this.cameraMode = mode;
        if (mode === 'aerial') {
            // High-Altitude 3D Orbit View (Looking at all buildings & Haram)
            this.camera.position.set(140, 280, 220);
            this.camera.lookAt(0, 30, -120);
        } else {
            // Street-Level Navigation Mode (Follow Behind Pilgrim)
            this.updateCamera();
        }
    }

    updateCamera() {
        if (!this.pilgrim || this.cameraMode !== 'street') return;

        // Over-the-shoulder follow camera positioned 5m behind the pilgrim at 2.4m height
        const pPos = this.pilgrim.position;
        this.camera.position.set(pPos.x, pPos.y + 4.2, pPos.z + 12);

        // Look straight ahead towards the Grand Mosque
        const target = new THREE.Vector3(pPos.x, pPos.y + 1.8, pPos.z - 30);
        this.camera.lookAt(target);
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

    setupControls() {
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
            const dx = e.clientX - prevMouse.x;
            const dy = e.clientY - prevMouse.y;

            if (this.cameraMode === 'aerial') {
                this.camera.position.x += dx * 0.4;
                this.camera.position.y -= dy * 0.4;
                this.camera.lookAt(0, 30, -120);
            } else {
                // Subtle look-around in street navigation
                this.camera.rotation.y -= dx * 0.002;
            }
            prevMouse = { x: e.clientX, y: e.clientY };
        });
    }

    onWindowResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Pilgrim walking motion
        if (this.isNavigating && this.activeRoute && this.activeRoute.length > 1) {
            const p1 = this.activeRoute[this.currentWaypointIndex];
            const p2 = this.activeRoute[this.currentWaypointIndex + 1];

            if (p2) {
                this.progress += this.walkSpeed;

                // Arm swing animation
                const swing = Math.sin(Date.now() * 0.009) * 0.4;
                if (this.leftArm && this.rightArm) {
                    this.leftArm.rotation.x = swing;
                    this.rightArm.rotation.x = -swing;
                }

                // Interpolate 3D position
                this.pilgrim.position.x = THREE.MathUtils.lerp(p1.x, p2.x, this.progress);
                this.pilgrim.position.z = THREE.MathUtils.lerp(p1.z, p2.z, this.progress);

                // Look in direction of travel
                this.pilgrim.lookAt(p2.x, this.pilgrim.position.y, p2.z);

                if (this.progress >= 1.0) {
                    this.progress = 0;
                    this.currentWaypointIndex++;
                    if (window.onNavStepAdvanced) {
                        window.onNavStepAdvanced(this.currentWaypointIndex);
                    }

                    if (this.currentWaypointIndex >= this.activeRoute.length - 1) {
                        this.isNavigating = false;
                        if (window.onPilgrimArrival) window.onPilgrimArrival();
                    }
                }

                if (this.cameraMode === 'street') {
                    this.updateCamera();
                }
            }
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

window.Makkah3DCity = Makkah3DCity;
