/**
 * CesiumJS 3D Globe Engine for Makkah - 100% Token-Free & Production-Ready
 * Uses Free High-Resolution Esri World Imagery (No Cesium Ion Token Required)
 * Enables 3D Extruded Buildings, Physical Solar Shadows, 3D Path, and Pilgrim Entity
 */

class CesiumMakkahEngine {
    constructor(containerId) {
        this.containerId = containerId;
        this.viewer = null;
        this.isInitialized = false;
        this.pilgrimEntity = null;
        this.routeEntity = null;
        this.buildingEntities = [];
    }

    init() {
        if (this.isInitialized || typeof Cesium === 'undefined') {
            return;
        }

        try {
            // 1. Completely bypass Cesium Ion default tokens to prevent 401 Unauthorized errors
            Cesium.Ion.defaultAccessToken = '';

            // 2. High-Resolution Esri Satellite Provider (100% Free, Zero-Token)
            const esriImagery = new Cesium.UrlTemplateImageryProvider({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                credit: 'Esri World Imagery',
                maximumLevel: 19
            });

            // 3. Initialize Cesium Viewer with the custom baseLayer explicitly
            this.viewer = new Cesium.Viewer(this.containerId, {
                baseLayer: new Cesium.ImageryLayer(esriImagery),
                baseLayerPicker: false,
                geocoder: false,
                animation: false,
                timeline: false,
                homeButton: false,
                infoBox: false,
                sceneModePicker: false,
                selectionIndicator: false,
                navigationHelpButton: false,
                shadows: true, // Physical Solar Shadows enabled
                terrainShadows: Cesium.ShadowMode.ENABLED,
                contextOptions: {
                    webgl: {
                        preserveDrawingBuffer: true
                    }
                }
            });

            // Enable dynamic sun lighting and smooth shadows on the globe
            this.viewer.scene.globe.enableLighting = true;
            this.viewer.scene.globe.maximumScreenSpaceError = 2.0;

            // Optional: Add satellite place names and street boundaries overlay
            const labelsProvider = new Cesium.UrlTemplateImageryProvider({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
                maximumLevel: 19
            });
            this.viewer.imageryLayers.addImageryProvider(labelsProvider);

            // 4. Load Accurate 3D Extruded Buildings of Makkah
            this.load3DBuildings();

            // 5. Load 3D Walking Route
            this.load3DRoute();

            // 6. Create 3D Pilgrim Avatar
            this.createPilgrimEntity();

            // 7. Fly Camera to Makkah Central Area
            this.flyToMakkah();

            this.isInitialized = true;
            console.log('✅ Cesium 3D Globe initialized successfully without any token dependency!');
        } catch (err) {
            console.error('Cesium initialization failed:', err);
        }
    }

    load3DBuildings() {
        const data = window.MAKKAH_DATA;
        if (!data || !this.viewer) return;

        data.buildings.forEach(b => {
            const hierarchy = [];
            b.polygon.forEach(pt => {
                hierarchy.push(Cesium.Cartesian3.fromDegrees(pt[1], pt[0]));
            });

            const building = this.viewer.entities.add({
                name: b.name,
                polygon: {
                    hierarchy: hierarchy,
                    extrudedHeight: b.height,
                    material: Cesium.Color.fromCssColorString(b.color || '#D4AF37').withAlpha(0.88),
                    outline: true,
                    outlineColor: Cesium.Color.WHITE.withAlpha(0.6),
                    shadows: Cesium.ShadowMode.ENABLED // Real shadow cast onto ground
                }
            });

            this.buildingEntities.push(building);
        });
    }

    load3DRoute() {
        const data = window.MAKKAH_DATA;
        if (!data || !this.viewer) return;

        const positions = data.zilalRoute.map(pt => Cesium.Cartesian3.fromDegrees(pt.lng, pt.lat, 2.5));

        this.routeEntity = this.viewer.entities.add({
            name: 'مسار ظِلال مكة المظلل',
            polyline: {
                positions: positions,
                width: 7,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.35,
                    color: Cesium.Color.fromCssColorString('#10B981')
                }),
                clampToGround: true
            }
        });
    }

    createPilgrimEntity() {
        const data = window.MAKKAH_DATA;
        const start = data.zilalRoute[0];
        const initialPos = Cesium.Cartesian3.fromDegrees(start.lng, start.lat, 4);

        // High-Resolution Pilgrim Icon in White Ihram
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Glowing Emerald Badge
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // White Ihram Pilgrim Silhouette
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(32, 18, 7, 0, Math.PI * 2); // Head
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(22, 50);
        ctx.lineTo(42, 50);
        ctx.lineTo(37, 28);
        ctx.lineTo(27, 28);
        ctx.closePath();
        ctx.fill();

        this.pilgrimEntity = this.viewer.entities.add({
            name: 'المعتمر في الشارع',
            position: initialPos,
            billboard: {
                image: canvas.toDataURL(),
                width: 44,
                height: 44,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            },
            point: {
                pixelSize: 10,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2
            }
        });
    }

    updatePilgrimPosition(lat, lng) {
        if (!this.pilgrimEntity || !this.viewer) return;

        const newPos = Cesium.Cartesian3.fromDegrees(lng, lat, 4);
        this.pilgrimEntity.position = newPos;

        // Smoothly fly and follow the pilgrim in 3D
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat - 0.0018, 320),
            orientation: {
                heading: Cesium.Math.toRadians(0), // North facing Haram
                pitch: Cesium.Math.toRadians(-35),  // 3D angle
                roll: 0.0
            },
            duration: 1.2
        });
    }

    flyToMakkah() {
        if (!this.viewer) return;
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(39.8235, 21.4165, 780),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-40),
                roll: 0.0
            },
            duration: 1.8
        });
    }

    updateSunTime(date) {
        if (!this.viewer) return;
        const julianDate = Cesium.JulianDate.fromDate(date);
        this.viewer.clock.currentTime = julianDate;
        this.viewer.scene.light = new Cesium.SunLight();
    }
}

window.CesiumMakkahEngine = CesiumMakkahEngine;
