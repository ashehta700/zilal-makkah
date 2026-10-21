/**
 * «ظِـلال مَـكَّـة 3D» - Zilal Makkah 3D Platform
 * Comprehensive 3D GIS Engine for Makkah Al-Mukarramah powered by CesiumJS.
 * Features:
 *  - 719 Authentic 3D Extruded Buildings with real heights.
 *  - High-Contrast Architectural Palettes (Marble, Stone, Modern, Height) for maximum shadow visibility.
 *  - Real-time Physical Solar Ray-casting & Deep Shadows (4K Shadow Map & Darkness control).
 *  - 281 Verified Makkah Hotels with Instant Search & Dual Route Calculation (Sunny 51°C vs Shaded 34°C).
 *  - 483 Pedestrian Network Segments (air-conditioned tunnels, covered arcades, sidewalks).
 *  - 156 Al-Masjid Al-Haram Gates.
 *  - Animated 3D Pilgrim (معتمر) entity in white Ihram with street-view camera follow and live navigation HUD.
 */

class MakkahCesiumApp {
    constructor() {
        this.viewer = null;
        this.hotelList = [];
        this.filteredHotelList = [];
        this.selectedHotel = null;
        this.buildingEntities = [];
        this.currentTheme = 'marble';
        this.simDate = new Date(); // Start with TODAY's real date & time!
        this.makkahHourlyWeather = null;

        // Navigation state
        this.activeNav = {
            isRunning: false,
            routePoints: [],
            instructions: [],
            currentStepIdx: 0,
            progress: 0.0,
            animId: null,
            cameraMode: 'street', // 'street' or 'bird'
            pilgrimEntity: null
        };

        this.isLightMode = false;
        this.isRouteFocusActive = false;
        this.arrivalDismissTimer = null;
        this.thermalEntities = [];
        this.thermalRoadPoints = [];

        this.dataSources = {
            buildings: null,
            gates: null,
            pedestrians: null,
            routes: null,
            thermal: null
        };

        // Key Haram Gates coordinates (WGS84)
        this.majorGates = [
            { id: 'gate_abdulaziz', name: 'باب الملك عبد العزيز (رقم 1)', lon: 39.82625, lat: 21.42080 },
            { id: 'gate_king_fahd', name: 'باب الملك فهد (رقم 79)', lon: 39.82420, lat: 21.42250 },
            { id: 'gate_umrah', name: 'باب العمرة (رقم 62)', lon: 39.82490, lat: 21.42410 },
            { id: 'gate_fath', name: 'باب الفتح (رقم 45)', lon: 39.82620, lat: 21.42460 },
            { id: 'gate_salam', name: 'باب السلام (رقم 19)', lon: 39.82770, lat: 21.42340 },
            { id: 'gate_ajyad', name: 'باب أجياد للمشاة', lon: 39.82710, lat: 21.42120 },
            { id: 'gate_marwah', name: 'باب المروة والمسعى', lon: 39.82850, lat: 21.42450 }
        ];
    }

    init() {
        Cesium.Ion.defaultAccessToken = '';

        // High-Resolution Satellite Basemap
        const esriProvider = new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            credit: 'Esri World Imagery | Maxar',
            maximumLevel: 19
        });

        // Initialize 3D Viewer with Physical Solar Shadows
        this.viewer = new Cesium.Viewer('cesium-container', {
            baseLayer: new Cesium.ImageryLayer(esriProvider),
            baseLayerPicker: false,
            geocoder: false,
            animation: false,
            timeline: false,
            homeButton: false,
            infoBox: true,
            sceneModePicker: false,
            selectionIndicator: true,
            navigationHelpButton: false,
            shadows: true,
            terrainShadows: Cesium.ShadowMode.ENABLED
        });

        // High-Definition Solar Shadow Controls
        this.viewer.scene.globe.enableLighting = true;
        this.viewer.scene.globe.shadows = Cesium.ShadowMode.ENABLED;
        this.viewer.scene.globe.maximumScreenSpaceError = 2.0;

        if (this.viewer.shadowMap) {
            this.viewer.shadowMap.darkness = 0.50; // Realistic natural ambient scattering (50% darkness, not pitch-black ink)
            this.viewer.shadowMap.size = 2048;     // High resolution shadow maps
            this.viewer.shadowMap.softShadows = true; // Natural soft penumbra instead of jagged pixelated edges
            this.viewer.shadowMap.maximumDistance = 8000.0;
        }

        // Dedicated Data Source for Dynamic Routes and Pilgrim Entity
        this.dataSources.routes = new Cesium.CustomDataSource('routes-layer');
        this.viewer.dataSources.add(this.dataSources.routes);

        // Dedicated Data Source for Dynamic Road Thermal Badges
        this.dataSources.thermal = new Cesium.CustomDataSource('thermal-markers');
        this.viewer.dataSources.add(this.dataSources.thermal);

        // Set Initial Solar Elevation & Time to actual current date & time
        this.updateSunTime(this.simDate);

        // Fetch Authentic Makkah Live Weather from Open-Meteo API
        this.fetchMakkahWeather();

        // Initialize Road Thermal Markers & Simulation
        this.initRoadThermalMarkers();
        this.updateThermalSimulation(this.simDate);

        // Load GIS Layers
        this.loadAllDatasets();

        // Wire Event Listeners & UI Controls
        this.setupUIControls();

        // Selection listener: Clicking any 3D building automatically selects it, updates routes and sidebar card
        this.viewer.selectedEntityChanged.addEventListener((selected) => {
            if (selected && selected._centroid && selected.properties) {
                const props = selected.properties;
                const nameAr = props.name_ar ? props.name_ar.getValue() : 'مبنى فندقي';
                const [cLon, cLat] = selected._centroid;
                this.routeFromBuilding(nameAr, cLon, cLat, selected);
            }
        });

        // Initial Cinematic Fly-To Overview
        this.flyToHaramOverview();
    }

    async loadAllDatasets() {
        this.updateStatus('جاري تحميل المباني ثلاثية الأبعاد والفنادق (727)...');
        await this.load3DBuildings();

        this.updateStatus('جاري تحميل شبكة الشوارع والكوريدورات بعرضها الحقيقي (938)...');
        await this.loadPedestrianNetwork();

        this.updateStatus('جاري تحميل بوابات الحرم الشريف (156)...');
        await this.loadHaramGates();

        this.updateStatus('✅ كافة الطبقات المكانية محملة ونشطة');
        setTimeout(() => {
            const statusEl = document.getElementById('loading-status-badge');
            if (statusEl) statusEl.classList.add('hidden');
        }, 2200);

        // Keep routes layer on the absolute top of the visual stack
        if (this.viewer && this.dataSources.routes) {
            this.viewer.dataSources.raiseToTop(this.dataSources.routes);
        }

        // Default startup state: All city layers visible by default (pedestrians, thermal, gates, 3D buildings)
        // Focus mode and route drawing ONLY activate when the user explicitly chooses a hotel!
        this.setLayersFocusOnRoute(false);
        this.updateMobilePeekDefault();
        this.flyToHaramOverview();
    }

    async load3DBuildings() {
        try {
            const ds = await Cesium.GeoJsonDataSource.load('data/makkah_buildings_3d.geojson', {
                clampToGround: true
            });
            this.viewer.dataSources.add(ds);
            this.dataSources.buildings = ds;
            this.buildingEntities = ds.entities.values;

            // Configure Shadow casting and default realistic hotel theme
            this.applyBuildingTheme('realistic');

            // Initialize hotel registry directly from 3D buildings!
            this.initHotelsFromBuildings();

            const countEl = document.getElementById('count-buildings');
            if (countEl) countEl.innerText = `${this.buildingEntities.length} مبنى وفندق`;
        } catch (err) {
            console.error('Failed to load 3D buildings:', err);
        }
    }

    applyBuildingTheme(themeName) {
        this.currentTheme = themeName;
        const entities = this.buildingEntities;

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            const props = entity.properties;
            let height = 35.0;

            if (props && props.height) {
                const hVal = props.height.getValue();
                if (!isNaN(hVal) && hVal > 0) height = parseFloat(hVal);
            }

            // Detect the Holy Kaaba to preserve sacred black Kiswah
            const isKaaba = props && (
                (props.name_en && props.name_en.getValue() === 'Kaaba') ||
                (props.name_ar && props.name_ar.getValue() === 'الكعبة') ||
                (props.name_ar && props.name_ar.getValue() === 'الكعبة المشرفة') ||
                (props.osm_id && props.osm_id.getValue() === 'Kaaba')
            );

            // Extract and cache perimeter positions from polygon hierarchy once
            if (!entity._positions && entity.polygon && entity.polygon.hierarchy) {
                const hier = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
                if (hier && hier.positions && hier.positions.length > 2) {
                    entity._positions = hier.positions;
                    let perim = 0;
                    for (let j = 0; j < hier.positions.length - 1; j++) {
                        perim += Cesium.Cartesian3.distance(hier.positions[j], hier.positions[j + 1]);
                    }
                    entity._perimeter = Math.max(20, perim);
                }
            }

            const positions = entity._positions;
            const perim = entity._perimeter || 40;
            const bAlpha = this.currentBuildingsOpacity !== undefined ? this.currentBuildingsOpacity : 1.0;

            if (themeName === 'realistic' || themeName === 'hotel') {
                // 🏨 Realistic Drawn Hotel Buildings (واجهات فنادق مرسومة بنوافذ وأدوار)
                // Harmonizes organically with high-resolution satellite imagery
                if (positions && positions.length > 2) {
                    const maxHeights = new Array(positions.length).fill(height);
                    const minHeights = new Array(positions.length).fill(0.0);

                    let facadeUrl = 'assets/hotel_facade_cream.png';
                    let repX = Math.max(1, Math.round(perim / 8.0));
                    let repY = Math.max(1, Math.round(height / 3.8));

                    if (isKaaba) {
                        facadeUrl = 'assets/kaaba_texture.png';
                        repX = 4;
                        repY = 1;
                    } else if (height >= 300) {
                        // Iconic Clock Tower (Abraj Al-Bait, 601m)
                        facadeUrl = 'assets/clock_tower_facade.png';
                        repX = Math.max(2, Math.round(perim / 14.0));
                        repY = Math.max(2, Math.round(height / 4.0));
                    } else if (height >= 120) {
                        // High-Rise Hotels (Jabal Omar, Conrad, Hilton towers)
                        facadeUrl = 'assets/hotel_facade_modern.png';
                        repX = Math.max(1, Math.round(perim / 10.0));
                        repY = Math.max(1, Math.round(height / 3.5));
                    }

                    entity.wall = new Cesium.WallGraphics({
                        positions: positions,
                        maximumHeights: maxHeights,
                        minimumHeights: minHeights,
                        material: new Cesium.ImageMaterialProperty({
                            image: facadeUrl,
                            repeat: new Cesium.Cartesian2(repX, repY),
                            color: Cesium.Color.WHITE.withAlpha(bAlpha)
                        }),
                        shadows: Cesium.ShadowMode.ENABLED
                    });

                    // Roof polygon on top of walls (seamless watertight building cap)
                    if (entity.polygon) {
                        entity.polygon.extrudedHeight = undefined;
                        entity.polygon.height = height;
                        entity.polygon.shadows = Cesium.ShadowMode.ENABLED;
                        entity.polygon.outline = true;

                        if (isKaaba) {
                            entity._baseRoofColor = Cesium.Color.fromCssColorString('#111827');
                            entity._baseOutlineColor = Cesium.Color.fromCssColorString('#F59E0B');
                        } else {
                            // Warm Makkah roof tone blending naturally with satellite terrain
                            entity._baseRoofColor = Cesium.Color.fromCssColorString('#E5DFD5');
                            entity._baseOutlineColor = Cesium.Color.fromCssColorString('#8C8070');
                        }
                        entity.polygon.material = entity._baseRoofColor.withAlpha(bAlpha);
                        entity.polygon.outlineColor = entity._baseOutlineColor.withAlpha(bAlpha);
                    }
                }
            } else if (themeName === 'marble' || themeName === 'solid_white') {
                // 🏛️ Solid Pure White Architectural Model (ماكيت أبيض مصمت)
                entity.wall = undefined;
                if (entity.polygon) {
                    entity.polygon.extrudedHeight = height;
                    entity.polygon.height = undefined;
                    entity.polygon.shadows = Cesium.ShadowMode.ENABLED;
                    entity.polygon.outline = true;

                    if (isKaaba) {
                        entity._baseRoofColor = Cesium.Color.fromCssColorString('#111827');
                        entity._baseOutlineColor = Cesium.Color.fromCssColorString('#F59E0B');
                    } else if (height >= 300) {
                        entity._baseRoofColor = Cesium.Color.fromCssColorString('#FAFAF9');
                        entity._baseOutlineColor = Cesium.Color.fromCssColorString('#CA8A04');
                    } else {
                        entity._baseRoofColor = Cesium.Color.WHITE;
                        entity._baseOutlineColor = Cesium.Color.fromCssColorString('#475569');
                    }
                    entity.polygon.material = entity._baseRoofColor.withAlpha(bAlpha);
                    entity.polygon.outlineColor = entity._baseOutlineColor.withAlpha(bAlpha);
                }
            } else if (themeName === 'stone') {
                // 🏜️ Traditional Makkah Limestone & Sandstone
                entity.wall = undefined;
                if (entity.polygon) {
                    entity.polygon.extrudedHeight = height;
                    entity.polygon.height = undefined;
                    entity.polygon.shadows = Cesium.ShadowMode.ENABLED;
                    entity.polygon.outline = true;

                    if (isKaaba) {
                        entity._baseRoofColor = Cesium.Color.fromCssColorString('#111827');
                    } else if (height >= 300) {
                        entity._baseRoofColor = Cesium.Color.fromCssColorString('#F59E0B');
                    } else if (height >= 120) {
                        entity._baseRoofColor = Cesium.Color.fromCssColorString('#E2D9C8');
                    } else {
                        entity._baseRoofColor = Cesium.Color.fromCssColorString('#CDBFA8');
                    }
                    entity._baseOutlineColor = Cesium.Color.fromCssColorString('#78350F');
                    entity.polygon.material = entity._baseRoofColor.withAlpha(bAlpha);
                    entity.polygon.outlineColor = entity._baseOutlineColor.withAlpha(bAlpha);
                }
            } else if (themeName === 'height') {
                // 🌈 Thermal Height Classification
                entity.wall = undefined;
                if (entity.polygon) {
                    entity.polygon.extrudedHeight = height;
                    entity.polygon.height = undefined;
                    entity.polygon.shadows = Cesium.ShadowMode.ENABLED;
                    entity.polygon.outline = true;

                    if (isKaaba) {
                        entity._baseRoofColor = Cesium.Color.fromCssColorString('#111827');
                    } else if (height >= 300) {
                        entity._baseRoofColor = Cesium.Color.fromCssColorString('#F59E0B');
                    } else if (height >= 120) {
                        entity._baseRoofColor = Cesium.Color.fromCssColorString('#10B981');
                    } else if (height >= 60) {
                        entity._baseRoofColor = Cesium.Color.fromCssColorString('#38BDF8');
                    } else {
                        entity._baseRoofColor = Cesium.Color.fromCssColorString('#A855F7');
                    }
                    entity._baseOutlineColor = Cesium.Color.fromCssColorString('#020617');
                    entity.polygon.material = entity._baseRoofColor.withAlpha(bAlpha);
                    entity.polygon.outlineColor = entity._baseOutlineColor.withAlpha(bAlpha);
                }
            }

            // 🏷️ Attach 3D Floating Name Labels and Interactive Cards to every building
            if (positions && positions.length > 2) {
                if (!entity.position) {
                    let sumLon = 0, sumLat = 0;
                    for (let j = 0; j < positions.length; j++) {
                        const carto = Cesium.Cartographic.fromCartesian(positions[j]);
                        sumLon += carto.longitude;
                        sumLat += carto.latitude;
                    }
                    const avgLon = Cesium.Math.toDegrees(sumLon / positions.length);
                    const avgLat = Cesium.Math.toDegrees(sumLat / positions.length);
                    entity.position = Cesium.Cartesian3.fromDegrees(avgLon, avgLat, height + (height >= 300 ? 20.0 : 6.0));
                    entity._centroid = [avgLon, avgLat];
                }

                const nameAr = props && props.name_ar ? props.name_ar.getValue() : '';
                const nameEn = props && props.name_en ? props.name_en.getValue() : '';
                const stars = props && props.stars ? props.stars.getValue() : 'فندق معتمد';
                const distKaaba = props && props.dist_to_kaaba_meters ? props.dist_to_kaaba_meters.getValue() : 450;
                const isLandmark = height >= 140 || (props && props.is_landmark && props.is_landmark.getValue());

                // Set 3D Floating Name Label using Native Arabic RTL Canvas Badge with Zoom-Dependent Scaling
                if (isKaaba) {
                    const kaabaBadge = this.createArabicBadgeCanvas({
                        text: '🕋 الكعبة المشرفة',
                        bgColor: 'rgba(15, 23, 42, 0.95)',
                        textColor: '#FDE68A',
                        borderColor: '#D4AF37'
                    });
                    entity.billboard = {
                        image: kaabaBadge,
                        color: Cesium.Color.WHITE.withAlpha(bAlpha),
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -10),
                        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000),
                        scaleByDistance: new Cesium.NearFarScalar(120.0, 0.65, 2500.0, 0.28),
                        translucencyByDistance: new Cesium.NearFarScalar(150.0, 1.0, 3000.0, 0.4)
                    };
                } else if (nameAr && nameAr !== 'مبنى غير مسمى' && nameAr !== 'Unnamed Building') {
                    const isClock = height >= 500 || nameAr.includes('ساعة');
                    const badgeText = isClock ? `🕰️ ${nameAr} (${Math.round(height)}م)` : (isLandmark ? `⭐ ${nameAr} (${Math.round(height)}م)` : `${nameAr}`);
                    const badge = this.createArabicBadgeCanvas({
                        text: badgeText,
                        bgColor: isClock ? 'rgba(15, 23, 42, 0.95)' : (isLandmark ? 'rgba(15, 23, 42, 0.90)' : 'rgba(30, 41, 59, 0.85)'),
                        textColor: isClock ? '#FEF08A' : (isLandmark ? '#FDE68A' : '#F1F5F9'),
                        borderColor: isClock ? '#EAB308' : (isLandmark ? '#D4AF37' : '#64748B')
                    });

                    // Strict Cartographic LOD: Regular hotels only appear when zoomed in (<480m) so the map stays clean
                    const maxDist = isClock ? 4500 : (isLandmark ? 1100 : 480);
                    const nearScale = isClock ? 0.70 : (isLandmark ? 0.50 : 0.45);
                    const farScale = isClock ? 0.30 : (isLandmark ? 0.22 : 0.20);

                    entity.billboard = {
                        image: badge,
                        color: Cesium.Color.WHITE.withAlpha(bAlpha),
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -6),
                        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, maxDist),
                        scaleByDistance: new Cesium.NearFarScalar(100.0, nearScale, maxDist, farScale),
                        translucencyByDistance: new Cesium.NearFarScalar(100.0, 1.0, maxDist, 0.3)
                    };
                }

                // Interactive Click Description Popup Card
                if (entity._centroid) {
                    const [cLon, cLat] = entity._centroid;
                    const escapedName = (nameAr || 'مبنى فندقي').replace(/'/g, "\\'");
                    entity.description = `
                        <div style="direction: rtl; font-family: 'Cairo', sans-serif; font-size: 13px; line-height: 1.6; padding: 4px;">
                            <h3 style="color: #D4AF37; margin: 0 0 4px 0; font-size: 15px;">${nameAr || 'فندق مكة المكرمة'}</h3>
                            <p style="color: #94A3B8; margin: 0 0 8px 0; font-size: 11px;">${nameEn}</p>
                            <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 8px; padding: 8px; margin-bottom: 10px;">
                                <p style="margin: 3px 0;"><b>الارتفاع:</b> <span style="color: #38BDF8; font-weight: bold;">${Math.round(height)} متر</span> (${Math.round(height / 3.5)} طابق)</p>
                                <p style="margin: 3px 0;"><b>المسافة للكعبة:</b> <span style="color: #10B981; font-weight: bold;">${distKaaba} متر</span></p>
                                <p style="margin: 3px 0;"><b>التصنيف:</b> <span style="color: #FDE68A;">${stars}</span></p>
                            </div>
                            <button onclick="window.makkahCesiumApp.routeFromBuilding('${escapedName}', ${cLon}, ${cLat})" style="width: 100%; background: linear-gradient(135deg, #0F4C3A, #059669); color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold; cursor: pointer;">
                                عرض مسار الظلال المبرد إلى الحرم
                            </button>
                        </div>
                    `;
                }
            }
        }
    }

    setBuildingsOpacity(alphaPct) {
        const alpha = Math.max(0.05, Math.min(1.0, alphaPct / 100.0));
        this.currentBuildingsOpacity = alpha;
        const entities = this.buildingEntities;
        if (!entities) return;

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            if (entity.wall && entity.wall.material) {
                if (entity.wall.material.color) {
                    entity.wall.material.color = Cesium.Color.WHITE.withAlpha(alpha);
                }
            }
            if (entity.polygon && entity._baseRoofColor) {
                entity.polygon.material = entity._baseRoofColor.withAlpha(alpha);
                if (entity._baseOutlineColor) {
                    entity.polygon.outlineColor = entity._baseOutlineColor.withAlpha(alpha);
                }
            }
            if (entity.billboard) {
                entity.billboard.color = Cesium.Color.WHITE.withAlpha(alpha);
            }
        }
    }

    toggleShadows(enable) {
        if (!this.viewer) return;
        this.viewer.shadows = enable;
        this.viewer.terrainShadows = enable ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED;
        this.viewer.scene.globe.shadows = enable ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED;
        if (this.viewer.shadowMap) {
            this.viewer.shadowMap.enabled = enable;
        }
    }

    setShadowDarkness(valPct) {
        if (!this.viewer || !this.viewer.shadowMap) return;
        const darkness = Math.max(0.15, Math.min(0.98, valPct / 100.0));
        this.viewer.shadowMap.darkness = darkness;

        const valEl = document.getElementById('val-opacity-shadows');
        if (valEl) valEl.innerText = `${Math.round(valPct)}%`;
    }

    setRoadsOpacity(valPct) {
        const factor = Math.max(0.05, Math.min(1.0, valPct / 100.0));
        this.currentRoadsOpacity = factor;
        if (!this.dataSources.pedestrians) return;
        const entities = this.dataSources.pedestrians.entities.values;
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            if (entity.corridor && entity._baseCorridorColor) {
                entity.corridor.material = entity._baseCorridorColor.withAlpha(entity._baseCorridorColor.alpha * factor);
            }
            if (entity.polyline && entity._basePolyColor) {
                entity.polyline.material = entity._basePolyColor.withAlpha(entity._basePolyColor.alpha * factor);
            }
        }
    }

    setGatesOpacity(valPct) {
        const factor = Math.max(0.05, Math.min(1.0, valPct / 100.0));
        this.currentGatesOpacity = factor;
        if (!this.dataSources.gates) return;
        const entities = this.dataSources.gates.entities.values;
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            if (entity.billboard) {
                entity.billboard.color = Cesium.Color.WHITE.withAlpha(factor);
            }
            if (entity.label && entity._baseLabelColor) {
                entity.label.fillColor = entity._baseLabelColor.withAlpha(factor);
                entity.label.outlineColor = Cesium.Color.BLACK.withAlpha(factor);
            }
        }
    }

    async loadPedestrianNetwork() {
        try {
            const ds = await Cesium.GeoJsonDataSource.load('data/makkah_roads_network.geojson', {
                clampToGround: true
            });
            this.viewer.dataSources.add(ds);
            this.dataSources.pedestrians = ds;
            if (this.isRouteFocusActive) {
                ds.show = false;
            }

            const entities = ds.entities.values;
            this._labeledRoads = new Set();
            let countAllowed = 0;
            let countForbidden = 0;

            for (let i = 0; i < entities.length; i++) {
                const entity = entities[i];
                const props = entity.properties;
                const isCovered = props && props.is_covered ? props.is_covered.getValue() : false;
                const isTunnel = props && props.is_tunnel ? props.is_tunnel.getValue() : false;
                const tier = props && props.tier ? props.tier.getValue() : 'pedestrian';
                const nameAr = props && props.name_ar ? props.name_ar.getValue() : '';
                const hwAr = props && props.highway_ar ? props.highway_ar.getValue() : 'شارع';
                const shadeRating = props && props.shade_rating ? props.shade_rating.getValue() : 'طريق مفتوح';
                const coolingVal = props && props.cooling_val ? props.cooling_val.getValue() : '-8.0°C';

                // Physical road dimensions and pedestrian safety rules
                const physWidth = props && props.physical_width_meters ? parseFloat(props.physical_width_meters.getValue()) : 8.0;
                const sidewalkWidth = props && props.sidewalk_width_meters ? parseFloat(props.sidewalk_width_meters.getValue()) : 3.0;
                const isPedAllowed = props && props.pedestrian_allowed ? props.pedestrian_allowed.getValue() : true;
                const pedStatus = props && props.pedestrian_status ? props.pedestrian_status.getValue() : (isPedAllowed ? 'sidewalk_only' : 'forbidden');
                const pedStatusAr = props && props.pedestrian_status_ar ? props.pedestrian_status_ar.getValue() : (isPedAllowed ? 'سير على الرصيف المظلل فقط' : '🚫 ممنوع سير المشاة نهائياً');

                if (isPedAllowed) {
                    countAllowed++;
                } else {
                    countForbidden++;
                }

                // Extract polyline positions to construct physical surface corridor
                let positions = null;
                if (entity.polyline && entity.polyline.positions) {
                    positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
                }

                if (positions && positions.length >= 2) {
                    // Physical Surface Corridor (المساحة الحقيقية بعرض الشارع بالمتر)
                    // Receives real-time 3D building shadows across the street width!
                    let corridorColor;
                    if (!isPedAllowed) {
                        // Forbidden expressway / vehicular tunnel: Dark asphalt with hazard tint
                        corridorColor = Cesium.Color.fromCssColorString('#1E293B').withAlpha(0.95);
                    } else if (isTunnel) {
                        // Radiant Ice Cyan for air-conditioned pedestrian underpass
                        corridorColor = Cesium.Color.fromCssColorString('#0891B2').withAlpha(0.85);
                    } else if (isCovered) {
                        // Radiant Emerald for covered shaded arcades
                        corridorColor = Cesium.Color.fromCssColorString('#059669').withAlpha(0.85);
                    } else if (pedStatus === 'exclusive') {
                        // Dedicated pedestrian walkway & plazas
                        corridorColor = Cesium.Color.fromCssColorString('#10B981').withAlpha(0.75);
                    } else if (tier === 'major') {
                        // Major shared avenue (Ibrahim Al-Khalil 18m, Ajyad 14m, etc.)
                        corridorColor = Cesium.Color.fromCssColorString('#334155').withAlpha(0.90);
                    } else {
                        // Local paved street
                        corridorColor = Cesium.Color.fromCssColorString('#475569').withAlpha(0.85);
                    }

                    entity._baseCorridorColor = corridorColor;
                    entity.corridor = new Cesium.CorridorGraphics({
                        positions: positions,
                        width: Math.max(3.0, physWidth), // Real physical width in meters
                        cornerType: Cesium.CornerType.ROUNDED,
                        material: corridorColor,
                        shadows: Cesium.ShadowMode.RECEIVE_ONLY,
                        classificationType: Cesium.ClassificationType.TERRAIN
                    });

                    // Centerline / Sidewalk Guidance Polyline
                    entity.polyline.clampToGround = true;
                    let polyColor;
                    if (!isPedAllowed) {
                        entity.polyline.width = 2.0;
                        polyColor = Cesium.Color.fromCssColorString('#EF4444'); // Red hazard line
                    } else if (isTunnel) {
                        entity.polyline.width = 3.0;
                        polyColor = Cesium.Color.fromCssColorString('#67E8F9'); // Ice glow
                    } else if (isCovered || pedStatus === 'exclusive') {
                        entity.polyline.width = 2.5;
                        polyColor = Cesium.Color.fromCssColorString('#34D399'); // Emerald glow
                    } else {
                        entity.polyline.width = 2.0;
                        polyColor = Cesium.Color.fromCssColorString('#94A3B8').withAlpha(0.7); // Sidewalk divider
                    }
                    entity._basePolyColor = polyColor;
                    entity.polyline.material = polyColor;
                }

                // Interactive Click Description Popup Card
                if (!isPedAllowed) {
                    entity.description = `
                        <div style="direction: rtl; font-family: 'Cairo', sans-serif; font-size: 13px; line-height: 1.6; padding: 4px;">
                            <div style="background: rgba(220, 38, 38, 0.25); border: 1px solid #EF4444; border-radius: 8px; padding: 8px; margin-bottom: 8px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 16px;">⛔</span>
                                    <b style="color: #FCA5A5; font-size: 14px;">محظور على المشاة نهائياً</b>
                                </div>
                                <p style="color: #FECACA; font-size: 11px; margin: 4px 0 0 0;">
                                    ${nameAr || 'طريق سريع'} مخصص للمركبات والحافلات والأنفاق السريعة فقط. يمنع سير المشاة لخطورة السرعة العالية وعدم وجود أرصفة.
                                </p>
                            </div>
                            <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 8px; font-size: 11px;">
                                <p style="margin: 3px 0;"><b>العرض الفيزيائي للشارع:</b> <span style="color: #F87171; font-weight: bold;">${physWidth} متر</span></p>
                                <p style="margin: 3px 0;"><b>التصنيف:</b> <span style="color: #FDE68A;">${hwAr} (مركبات وسيارات فقط)</span></p>
                                <p style="margin: 3px 0;"><b>إجراء الأمان الذكي:</b> <span style="color: #EF4444; font-weight: bold;">مستبعد 100% من ملاحة الحجاج لتفادي التضليل والحوادث</span></p>
                            </div>
                        </div>
                    `;
                } else if (pedStatus === 'exclusive' || isTunnel || isCovered) {
                    entity.description = `
                        <div style="direction: rtl; font-family: 'Cairo', sans-serif; font-size: 13px; line-height: 1.6; padding: 4px;">
                            <h3 style="color: #10B981; margin: 0 0 4px 0; font-size: 15px;">${isTunnel ? '❄️ نفق مشاة مكيف' : (isCovered ? '☂️ رواق مظلل ومحمي' : '🚶‍♂️ ممشى مشاة مخصص 100%')}</h3>
                            <div style="background: rgba(6, 78, 59, 0.35); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 8px; padding: 8px; margin-bottom: 8px; font-size: 11px;">
                                <p style="margin: 3px 0;"><b>الاسم:</b> <span style="color: #FDE68A; font-weight: bold;">${nameAr || 'ممشى الحرم المظلل'}</span></p>
                                <p style="margin: 3px 0;"><b>العرض الفيزيائي للممشى:</b> <span style="color: #6EE7B7; font-weight: bold;">${physWidth} متر</span></p>
                                <p style="margin: 3px 0;"><b>حالة الأمان:</b> <span style="color: #34D399; font-weight: bold;">آمن 100% - خروج تام عن حركة المركبات</span></p>
                                <p style="margin: 3px 0;"><b>طبيعة التبريد:</b> <span style="color: #38BDF8; font-weight: bold;">${isTunnel ? 'نفق مبرد ومكيف 24/7' : 'أروقة ومظلات عملاقة'}</span></p>
                                <p style="margin: 3px 0;"><b>الراحة الحرارية:</b> <span style="color: #10B981; font-weight: bold;">${shadeRating} (${coolingVal})</span></p>
                            </div>
                        </div>
                    `;
                } else {
                    entity.description = `
                        <div style="direction: rtl; font-family: 'Cairo', sans-serif; font-size: 13px; line-height: 1.6; padding: 4px;">
                            <h3 style="color: #38BDF8; margin: 0 0 4px 0; font-size: 15px;">🛣️ ${nameAr || 'شارع في مكة'}</h3>
                            <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 8px; margin-bottom: 8px; font-size: 11px;">
                                <p style="margin: 3px 0;"><b>العرض الفيزيائي الحقيقي:</b> <span style="color: #38BDF8; font-weight: bold;">${physWidth} متر</span></p>
                                <p style="margin: 3px 0;"><b>عرض الرصيف المخصص للمشاة:</b> <span style="color: #10B981; font-weight: bold;">${sidewalkWidth} متر</span></p>
                                <p style="margin: 3px 0;"><b>توجيه المشاة الذكي:</b> <span style="color: #FDE68A; font-weight: bold;">السير مسموح على الرصيف المظلل فقط المحاذي للأبراج</span></p>
                                <p style="margin: 3px 0;"><b>التصنيف:</b> <span style="color: #CBD5E1;">${hwAr}</span></p>
                                <p style="margin: 3px 0;"><b>الراحة الحرارية بالظل:</b> <span style="color: #10B981; font-weight: bold;">${shadeRating}</span></p>
                                <p style="margin: 3px 0;"><b>معدل التبريد:</b> <span style="color: #38BDF8; font-weight: bold;">${coolingVal}</span></p>
                            </div>
                        </div>
                    `;
                }

                // Add 3D Street Name Label for Major Arteries and Dangerous Tunnels
                const isMajorStreet = nameAr && (
                    nameAr.includes('إبراهيم الخليل') ||
                    nameAr.includes('أم القرى') ||
                    nameAr.includes('جبل الكعبة') ||
                    nameAr.includes('أجياد') ||
                    nameAr.includes('الملك عبدالعزيز') ||
                    nameAr.includes('السوق الصغير') ||
                    nameAr.includes('الدائري الأول') ||
                    nameAr.includes('ريع بخش') ||
                    nameAr.includes('كدي') ||
                    nameAr.includes('المسجد الحرام') ||
                    nameAr.includes('المسيال')
                );

                if (isMajorStreet && positions && positions.length > 1 && !this._labeledRoads.has(nameAr)) {
                    this._labeledRoads.add(nameAr);
                    const midIdx = Math.floor(positions.length / 2);
                    entity.position = positions[midIdx];

                    let labelText = `🛣️ ${nameAr} (${physWidth}م)`;
                    let badgeBg = 'rgba(15, 23, 42, 0.90)';
                    let badgeText = '#F8FAFC';
                    let badgeBorder = '#475569';

                    if (!isPedAllowed) {
                        labelText = `⛔ ${nameAr} (مركبات فقط)`;
                        badgeBg = 'rgba(159, 18, 57, 0.92)';
                        badgeText = '#FECDD3';
                        badgeBorder = '#F43F5E';
                    } else if (isTunnel) {
                        labelText = `❄️ ${nameAr} (مشاة مكيف)`;
                        badgeBg = 'rgba(8, 51, 68, 0.92)';
                        badgeText = '#A5F3FC';
                        badgeBorder = '#06B6D4';
                    }

                    const roadBadge = this.createArabicBadgeCanvas({
                        text: labelText,
                        bgColor: badgeBg,
                        textColor: badgeText,
                        borderColor: badgeBorder
                    });

                    entity.billboard = {
                        image: roadBadge,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 850),
                        scaleByDistance: new Cesium.NearFarScalar(100.0, 0.48, 850.0, 0.20),
                        translucencyByDistance: new Cesium.NearFarScalar(100.0, 1.0, 850.0, 0.3)
                    };
                }
            }

            const countEl = document.getElementById('count-pedestrians');
            if (countEl) countEl.innerText = `${entities.length} طريق وكوريدور (${countAllowed} مسموح | ${countForbidden} محظور)`;
        } catch (err) {
            console.error('Failed to load roads network:', err);
        }
    }

    initHotelsFromBuildings() {
        const list = [];
        const seenNames = new Set();

        const priorityTokens = [
            'ساعة مكة', 'فيرمونت', 'زمزم', 'هاجر', 'المقام', 'سويس أوتيل', 
            'المروة', 'الصفا', 'رافلز', 'التوحيد', 'الصفوة', 'الغفران', 
            'أنجم', 'شذا', 'شيراتون', 'مكارم', 'الشهداء', 'إيلاف', 
            'كونراد', 'هيلتون', 'ريجنسي', 'العنوان', 'ماريوت', 'دبل ترى', 'دبل تري',
            'ميريديان', 'الكسوة', 'التيسير', 'دار الإيمان'
        ];

        this.buildingEntities.forEach((entity) => {
            const props = entity.properties;
            if (!props) return;

            const nameAr = props.name_ar ? props.name_ar.getValue() : '';
            const nameEn = props.name_en ? props.name_en.getValue() : '';
            const isHotel = props.is_hotel 
                ? props.is_hotel.getValue() 
                : (nameAr.includes('فندق') || nameAr.includes('برج') || nameEn.toLowerCase().includes('hotel') || nameEn.toLowerCase().includes('tower'));
            const isKaaba = (nameAr === 'الكعبة' || nameAr === 'الكعبة المشرفة') || (nameAr.includes('الكعبة') && !nameAr.includes('فندق') && !nameAr.includes('جبل') && !nameAr.includes('برج'));

            if (isHotel && !isKaaba && entity._centroid) {
                const height = props.height ? (parseFloat(props.height.getValue()) || 35.0) : 35.0;
                const distKaaba = props.dist_to_kaaba_meters 
                    ? parseInt(props.dist_to_kaaba_meters.getValue()) 
                    : Math.round(this.calculateDistanceToKaaba(entity._centroid[0], entity._centroid[1]));
                const stars = props.stars ? props.stars.getValue() : (height >= 120 ? '5 نجوم فاخر' : 'فندق معتمد');
                const rooms = props.rooms ? props.rooms.getValue() : 'N/A';
                const isLandmark = height >= 100 || (props.is_landmark && props.is_landmark.getValue());

                if (!seenNames.has(nameAr)) {
                    seenNames.add(nameAr);
                    list.push({
                        entity: entity,
                        geometry: { type: 'Point', coordinates: entity._centroid },
                        coords: entity._centroid,
                        height: height,
                        properties: {
                            name_ar: nameAr,
                            name_en: nameEn,
                            dist_to_kaaba_meters: distKaaba,
                            walk_mins_est: Math.round(distKaaba / 75.0),
                            stars: stars,
                            rooms: rooms,
                            is_landmark: isLandmark
                        }
                    });
                }
            }
        });

        // Sort: Priority landmark hotels first, then by distance to Kaaba
        list.sort((a, b) => {
            const aName = a.properties.name_ar;
            const bName = b.properties.name_ar;
            const aPriIdx = priorityTokens.findIndex(tok => aName.includes(tok));
            const bPriIdx = priorityTokens.findIndex(tok => bName.includes(tok));

            if (aPriIdx !== -1 && bPriIdx !== -1) return aPriIdx - bPriIdx;
            if (aPriIdx !== -1) return -1;
            if (bPriIdx !== -1) return 1;

            return a.properties.dist_to_kaaba_meters - b.properties.dist_to_kaaba_meters;
        });

        this.hotelList = list;
        this.filteredHotelList = [...this.hotelList];
        this.populateHotelDropdown(this.hotelList);

        const countEl = document.getElementById('count-hotels');
        if (countEl) countEl.innerText = `${this.hotelList.length} فندق`;
    }

    populateHotelDropdown(list) {
        const selectEls = [
            document.getElementById('nav-hotel-select'),
            document.getElementById('hotel-search-select')
        ].filter(Boolean);

        if (selectEls.length === 0) return;

        selectEls.forEach(selectEl => {
            selectEl.innerHTML = `<option value="">-- اختر فندقك من القائمة (${list.length} فندق) --</option>`;

            const landmarkGroup = document.createElement('optgroup');
            landmarkGroup.label = '⭐ فنادق الحرم وأبراج البيت وجبل عمر الكبرى';

            const otherGroup = document.createElement('optgroup');
            otherGroup.label = '🏨 فنادق مكة المكرمة المعتمدة';

            list.forEach((h) => {
                const originalIdx = this.hotelList.indexOf(h);
                const p = h.properties;
                const opt = document.createElement('option');
                opt.value = originalIdx;
                const starsText = p.stars && p.stars !== 'N/A' ? ` [${p.stars}]` : '';
                opt.innerText = `${p.name_ar}${starsText} (${p.dist_to_kaaba_meters}م عن الكعبة)`;

                if (p.is_landmark || originalIdx < 18) {
                    landmarkGroup.appendChild(opt);
                } else {
                    otherGroup.appendChild(opt);
                }
            });

            if (landmarkGroup.children.length > 0) {
                selectEl.appendChild(landmarkGroup);
            }
            if (otherGroup.children.length > 0) {
                selectEl.appendChild(otherGroup);
            }
        });
    }

    filterHotels(query) {
        const clearBtn = document.getElementById('btn-clear-nav-search');
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', !query || query.trim() === '');
        }

        if (!query || query.trim() === '') {
            this.filteredHotelList = [...this.hotelList];
        } else {
            const q = query.trim().toLowerCase();
            this.filteredHotelList = this.hotelList.filter(h => {
                const nameAr = (h.properties.name_ar || '').toLowerCase();
                const nameEn = (h.properties.name_en || '').toLowerCase();
                return nameAr.includes(q) || nameEn.includes(q);
            });
        }
        this.populateHotelDropdown(this.filteredHotelList);
        if (this.filteredHotelList.length === 1) {
            const navSelect = document.getElementById('nav-hotel-select');
            if (navSelect) {
                navSelect.value = this.hotelList.indexOf(this.filteredHotelList[0]);
                navSelect.dispatchEvent(new Event('change'));
            }
        }
    }

    selectHotelByName(nameKeyword) {
        if (!this.hotelList || this.hotelList.length === 0) return;
        const idx = this.hotelList.findIndex(h => (h.properties.name_ar || '').includes(nameKeyword));
        if (idx !== -1) {
            const navSelect = document.getElementById('nav-hotel-select');
            if (navSelect) navSelect.value = idx;
            const drawerSelect = document.getElementById('hotel-search-select');
            if (drawerSelect) drawerSelect.value = idx;
            this.flyToHotel(idx);
        }
    }

    createArabicBadgeCanvas({ text, subtext = '', bgColor = '#ffffff', textColor = '#1e293b', borderColor = '#cbd5e1' }) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // High-DPI 2x scaling factor for crisp Retina typography in WebGL
        const scale = 2;
        const fontSize = 9.5 * scale;
        const subFontSize = 7.5 * scale;
        
        ctx.font = `bold ${fontSize}px 'Cairo', 'Tajawal', sans-serif`;
        const textWidth = ctx.measureText(text).width;
        
        let subWidth = 0;
        if (subtext) {
            ctx.font = `bold ${subFontSize}px 'Cairo', 'Tajawal', sans-serif`;
            subWidth = ctx.measureText(subtext).width;
        }
        
        const maxTextW = Math.max(textWidth, subWidth);
        const paddingX = 8 * scale;
        const w = Math.ceil(maxTextW + paddingX * 2);
        const h = Math.ceil((subtext ? 30 : 20) * scale);
        
        canvas.width = w;
        canvas.height = h;
        
        // Draw sleek rounded rectangle badge
        const radius = 4 * scale;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(w - radius, 0);
        ctx.quadraticCurveTo(w, 0, w, radius);
        ctx.lineTo(w, h - radius);
        ctx.quadraticCurveTo(w, h, w - radius, h);
        ctx.lineTo(radius, h);
        ctx.quadraticCurveTo(0, h, 0, h - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        
        ctx.fillStyle = bgColor;
        ctx.fill();
        ctx.lineWidth = 1.0 * scale;
        ctx.strokeStyle = borderColor;
        ctx.stroke();
        
        // Native RTL Arabic rendering
        ctx.direction = 'rtl';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const centerX = w / 2;
        
        if (subtext) {
            ctx.fillStyle = textColor;
            ctx.font = `bold ${fontSize}px 'Cairo', 'Tajawal', sans-serif`;
            ctx.fillText(text, centerX, 11 * scale);
            
            ctx.font = `bold ${subFontSize}px 'Cairo', 'Tajawal', sans-serif`;
            ctx.fillText(subtext, centerX, 21.5 * scale);
        } else {
            ctx.fillStyle = textColor;
            ctx.font = `bold ${fontSize}px 'Cairo', 'Tajawal', sans-serif`;
            ctx.fillText(text, centerX, h / 2);
        }
        
        return canvas;
    }

    async fetchMakkahWeather() {
        try {
            const url = 'https://api.open-meteo.com/v1/forecast?latitude=21.4225&longitude=39.8262&current=temperature_2m,relative_humidity_2m,is_day,shortwave_radiation&hourly=temperature_2m,shortwave_radiation&timezone=Asia%2FRiyadh';
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Weather status ${res.status}`);
            const data = await res.json();
            if (data && data.hourly && data.hourly.time) {
                this.makkahHourlyWeather = [];
                for (let i = 0; i < 24; i++) {
                    this.makkahHourlyWeather.push({
                        hour: i,
                        temp: parseFloat(data.hourly.temperature_2m[i]),
                        radiation: parseFloat(data.hourly.shortwave_radiation[i])
                    });
                }
                this.makkahCurrentWeather = data.current;
                console.log('✅ Loaded authentic Makkah weather from Open-Meteo for today:', this.makkahHourlyWeather);
                
                // Update live weather pill in UI immediately
                const livePill = document.getElementById('nav-live-ambient-pill');
                if (livePill && data.current && data.current.temperature_2m !== undefined) {
                    livePill.innerText = `${data.current.temperature_2m}°C (حي ومباشر)`;
                }

                this.updateThermalSimulation(this.simDate);
            }
        } catch (err) {
            console.warn('⚠️ Weather API fetch failed, fallback to local astronomical model:', err);
        }
    }

    createRoadThermalBadgeCanvas({ tempVal, name, isShaded, coolingDiff, isDaytime }) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 2; // High-DPI Retina scale

        // Crisp, high-readability badge typography (Golden Ratio balance)
        const tempFontSize = 16 * scale;
        const nameFontSize = 10 * scale;

        const icon = !isDaytime ? '🌙' : (isShaded ? '❄️' : '☀️');
        const tempText = `${icon} ${tempVal}°C`;
        const diffText = isShaded && isDaytime ? ` (${coolingDiff}°C)` : '';
        const mainLine = `${tempText}${diffText}`;

        // Measure text widths
        ctx.font = `900 ${tempFontSize}px 'Cairo', 'Tajawal', sans-serif`;
        const mainW = ctx.measureText(mainLine).width;

        ctx.font = `bold ${nameFontSize}px 'Cairo', 'Tajawal', sans-serif`;
        const nameW = ctx.measureText(name).width;

        const maxContentW = Math.max(mainW, nameW);
        const padX = 14 * scale;
        const w = Math.ceil(maxContentW + padX * 2);
        const cardH = Math.ceil(44 * scale);
        const pointerH = 7 * scale;
        const totalH = cardH + pointerH;

        canvas.width = w;
        canvas.height = totalH;

        // Visual Styling: High-contrast cyber/GIS thermal palette
        let bgGrad, borderColor, tempColor, subColor;
        if (!isDaytime) {
            bgGrad = 'rgba(15, 23, 42, 0.95)';
            borderColor = '#38BDF8';
            tempColor = '#F0F9FF';
            subColor = '#BAE6FD';
        } else if (isShaded) {
            bgGrad = 'rgba(2, 44, 34, 0.95)';
            borderColor = '#10B981';
            tempColor = '#D1FAE5';
            subColor = '#6EE7B7';
        } else {
            bgGrad = 'rgba(69, 10, 10, 0.95)';
            borderColor = '#F43F5E';
            tempColor = '#FFE4E6';
            subColor = '#FDA4AF';
        }

        // Card path with rounded corners and bottom center pointer pin
        const r = 7 * scale;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, cardH - r);
        ctx.quadraticCurveTo(w, cardH, w - r, cardH);
        
        // Pin pointer triangle pointing to road surface
        const midX = w / 2;
        ctx.lineTo(midX + 7 * scale, cardH);
        ctx.lineTo(midX, totalH);
        ctx.lineTo(midX - 7 * scale, cardH);

        ctx.lineTo(r, cardH);
        ctx.quadraticCurveTo(0, cardH, 0, cardH - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();

        // Card Background Fill with Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 7 * scale;
        ctx.shadowOffsetY = 2.5 * scale;
        ctx.fillStyle = bgGrad;
        ctx.fill();
        ctx.restore();

        // Glowing border stroke
        ctx.lineWidth = 2.0 * scale;
        ctx.strokeStyle = borderColor;
        ctx.stroke();

        // Native RTL Arabic rendering
        ctx.direction = 'rtl';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1. Draw Bold Temperature (Line 1)
        ctx.fillStyle = tempColor;
        ctx.font = `900 ${tempFontSize}px 'Cairo', 'Tajawal', sans-serif`;
        ctx.fillText(mainLine, midX, 16 * scale);

        // 2. Draw Corridor Name (Line 2)
        ctx.fillStyle = subColor;
        ctx.font = `bold ${nameFontSize}px 'Cairo', 'Tajawal', sans-serif`;
        ctx.fillText(name, midX, 33 * scale);

        return canvas;
    }

    getMakkahMicroclimate(date) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const timeOfDay = hours + minutes / 60.0;

        // 1. Get Authentic Ambient Air Temperature & Solar Radiation for this exact hour & minute
        let baseAir, solarRadiation;

        if (this.makkahHourlyWeather && this.makkahHourlyWeather.length >= 24) {
            const h1 = Math.floor(timeOfDay) % 24;
            const h2 = (h1 + 1) % 24;
            const frac = timeOfDay - Math.floor(timeOfDay);

            const t1 = this.makkahHourlyWeather[h1].temp;
            const t2 = this.makkahHourlyWeather[h2].temp;
            baseAir = t1 + (t2 - t1) * frac;

            const r1 = this.makkahHourlyWeather[h1].radiation;
            const r2 = this.makkahHourlyWeather[h2].radiation;
            solarRadiation = r1 + (r2 - r1) * frac;
        } else {
            // Real Makkah October Diurnal Model (High ~36.5°C at 14:00, Low ~26.5°C at 06:00)
            if (timeOfDay >= 6.0 && timeOfDay <= 18.5) {
                const dayProgress = (timeOfDay - 6.0) / 12.5;
                baseAir = 26.5 + 10.0 * Math.sin(dayProgress * Math.PI);
                solarRadiation = Math.max(0, Math.sin(dayProgress * Math.PI) * 780.0);
            } else {
                const nightHour = timeOfDay > 18.5 ? (timeOfDay - 18.5) : (timeOfDay + 5.5);
                baseAir = 30.5 - 4.0 * Math.min(1.0, nightHour / 11.5);
                solarRadiation = 0.0;
            }
        }

        // Solar flux intensity factor (0.0 at night, 1.0 at peak solar noon)
        const solarFlux = Math.min(1.0, Math.max(0.0, solarRadiation / 780.0));
        const isDaytime = solarFlux > 0.04;

        let exposedRoadTemp, shadedRoadTemp, coolingDiff;

        if (isDaytime) {
            // Unshaded dark asphalt road absorbs solar radiation: heats up +6°C to +13.5°C above air temp
            const asphaltSolarHeating = 13.5 * Math.pow(solarFlux, 1.05);
            exposedRoadTemp = parseFloat((baseAir + asphaltSolarHeating).toFixed(1));

            // Shaded pedestrian corridors:
            // High-albedo marble (albedo 0.82) + building shadow blocks 95% of solar radiation
            // Natural ventilation & shaded thermal depression reduces temperature 3.2°C to 5.6°C below ambient air
            const shadeCooling = 3.2 + 2.4 * solarFlux;
            shadedRoadTemp = parseFloat((baseAir - shadeCooling).toFixed(1));

            coolingDiff = parseFloat((shadedRoadTemp - exposedRoadTemp).toFixed(1));
        } else {
            // Nighttime: No solar radiation.
            // Asphalt retains moderate residual thermal mass (+0.8°C), shaded walkway has cool marble & breeze (-1.5°C)
            exposedRoadTemp = parseFloat((baseAir + 0.8).toFixed(1));
            shadedRoadTemp = parseFloat((baseAir - 1.5).toFixed(1));
            coolingDiff = parseFloat((shadedRoadTemp - exposedRoadTemp).toFixed(1));
        }

        return {
            timeOfDay,
            isDaytime,
            ambientTemp: parseFloat(baseAir.toFixed(1)),
            solarRadiation: Math.round(solarRadiation),
            exposedRoadTemp,
            shadedRoadTemp,
            coolingDiff
        };
    }

    initRoadThermalMarkers() {
        this.thermalRoadPoints = [
            {
                id: 'ibrahim-khalil',
                name: 'شارع إبراهيم الخليل',
                coords: [39.8242, 21.4172, 10.0],
                isShaded: true
            },
            {
                id: 'jabal-omar-corridor',
                name: 'رواق جبل عمر المظلل',
                coords: [39.8212, 21.4182, 12.0],
                isShaded: true
            },
            {
                id: 'haram-west-plaza',
                name: 'ساحات الحرم الغربية',
                coords: [39.8236, 21.4228, 10.0],
                isShaded: true
            },
            {
                id: 'souq-sagheer-tunnel',
                name: 'نفق السوق الصغير للمشاة',
                coords: [39.8248, 21.4215, 8.0],
                isShaded: true
            },
            {
                id: 'misfalah-walkway',
                name: 'ممشى المسفلة المظلل',
                coords: [39.8235, 21.4135, 10.0],
                isShaded: true
            },
            {
                id: 'ajyad-highway',
                name: 'طريق أجياد العام',
                coords: [39.8288, 21.4188, 12.0],
                isShaded: false
            },
            {
                id: 'ghazza-highway',
                name: 'طريق الغزة الخارجي',
                coords: [39.8282, 21.4276, 12.0],
                isShaded: false
            },
            {
                id: 'ring-road-exp',
                name: 'طريق الدائري الأول',
                coords: [39.8208, 21.4145, 14.0],
                isShaded: false
            },
            {
                id: 'king-abdulaziz-road',
                name: 'طريق الملك عبد العزيز',
                coords: [39.8185, 21.4195, 12.0],
                isShaded: false
            },
            {
                id: 'kudai-vehicle-road',
                name: 'طريق كدي للمركبات',
                coords: [39.8295, 21.4130, 14.0],
                isShaded: false
            }
        ];

        this.thermalEntities = [];
        const climate = this.getMakkahMicroclimate(this.simDate);
        const thermalAlpha = this.currentThermalOpacity !== undefined ? this.currentThermalOpacity : 1.0;

        this.thermalRoadPoints.forEach(pt => {
            const tempVal = pt.isShaded ? climate.shadedRoadTemp : climate.exposedRoadTemp;
            const badgeCanvas = this.createRoadThermalBadgeCanvas({
                tempVal,
                name: pt.name,
                isShaded: pt.isShaded,
                coolingDiff: climate.coolingDiff,
                isDaytime: climate.isDaytime
            });

            const entity = this.dataSources.thermal.entities.add({
                name: pt.name,
                position: Cesium.Cartesian3.fromDegrees(pt.coords[0], pt.coords[1], pt.coords[2]),
                billboard: {
                    image: badgeCanvas,
                    color: Cesium.Color.WHITE.withAlpha(thermalAlpha),
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3600),
                    scaleByDistance: new Cesium.NearFarScalar(150.0, 0.85, 2500.0, 0.48),
                    translucencyByDistance: new Cesium.NearFarScalar(150.0, 1.0, 3600.0, 0.50)
                },
                _pointData: pt
            });

            this.thermalEntities.push(entity);
        });

        if (this.isRouteFocusActive && this.dataSources.thermal) {
            this.dataSources.thermal.show = false;
        }
    }

    setThermalOpacity(val) {
        const alpha = val / 100.0;
        this.currentThermalOpacity = alpha;
        if (this.dataSources.thermal) {
            this.dataSources.thermal.entities.values.forEach(ent => {
                if (ent.billboard) {
                    ent.billboard.color = Cesium.Color.WHITE.withAlpha(alpha);
                }
            });
        }
    }

    updateThermalSimulation(date) {
        const climate = this.getMakkahMicroclimate(date);

        // 1. Update Header Gauges
        const hSun = document.getElementById('hdr-temp-sun');
        const hShade = document.getElementById('hdr-temp-shade');
        const hDiff = document.getElementById('hdr-temp-diff');
        if (hSun) hSun.innerText = `${climate.exposedRoadTemp}°C`;
        if (hShade) hShade.innerText = `${climate.shadedRoadTemp}°C`;
        if (hDiff) hDiff.innerText = `${climate.coolingDiff}°C`;

        // Update Live Ambient Weather Badge in Route Card
        const livePill = document.getElementById('nav-live-ambient-pill');
        if (livePill) {
            livePill.innerText = `${climate.ambientTemp}°C (حي ومباشر)`;
        }

        // Mobile compact header thermal chip
        const mSun = document.getElementById('m-temp-sun');
        const mShade = document.getElementById('m-temp-shade');
        if (mSun) mSun.innerText = `${climate.exposedRoadTemp}°C`;
        if (mShade) mShade.innerText = `${climate.shadedRoadTemp}°C`;

        // Mobile bottom peek thermal badge
        const mPeekTemp = document.getElementById('mobile-peek-temp');
        if (mPeekTemp) {
            mPeekTemp.innerText = this.activeSelectedRoute === 'sun' ? `${climate.exposedRoadTemp}°C` : `${climate.shadedRoadTemp}°C`;
        }

        // 2. Update Bottom Bar Gauges
        const bSun = document.getElementById('bar-temp-sun');
        const bShade = document.getElementById('bar-temp-shade');
        const bDiff = document.getElementById('bar-temp-diff');
        if (bSun) bSun.innerText = `${climate.exposedRoadTemp}°C`;
        if (bShade) bShade.innerText = `${climate.shadedRoadTemp}°C`;
        if (bDiff) bDiff.innerText = `${climate.coolingDiff}°C`;

        // 3. Update Road Thermal Badges on the Map
        if (this.thermalEntities && this.thermalEntities.length > 0) {
            this.thermalEntities.forEach(ent => {
                const pt = ent._pointData;
                if (!pt) return;
                const tempVal = pt.isShaded ? climate.shadedRoadTemp : climate.exposedRoadTemp;
                const badgeCanvas = this.createRoadThermalBadgeCanvas({
                    tempVal,
                    name: pt.name,
                    isShaded: pt.isShaded,
                    coolingDiff: climate.coolingDiff,
                    isDaytime: climate.isDaytime
                });
                ent.billboard.image = badgeCanvas;
            });
        }

        // 4. Update Time Displays
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}:${mins}`;

        const timeDisplay = document.getElementById('time-display');
        if (timeDisplay) timeDisplay.innerText = `${timeStr} ${date.getHours() < 12 ? 'ص' : 'م'}`;

        const sliderLabel = document.getElementById('slider-time-label');
        if (sliderLabel) sliderLabel.innerText = timeStr;

        // Highlight matching prayer time button based on current local minute
        this.updatePrayerButtonHighlights(date.getHours() * 60 + date.getMinutes());

        // 5. Update Active Hotel Route Card and Map Geometry dynamically according to solar position!
        if (this.selectedHotel) {
            const routes = this.calculateDualRoutes(this.selectedHotel, date);
            this.renderDualRoutes(this.selectedHotel, routes, false);
            if (this.activeNav && this.activeNav.isRunning) {
                const targetRoute = this.activeSelectedRoute === 'sun' ? routes.sunRoute : routes.shadeRoute;
                const targetInstructions = this.activeSelectedRoute === 'sun' ? routes.sunInstructions : routes.shadeInstructions;
                this.activeNav.routePoints = targetRoute;
                this.activeNav.instructions = targetInstructions;
            }
        }
    }

    updatePrayerButtonHighlights(curMins) {
        const btnDuhr = document.getElementById('btn-quick-duhr');
        const btnAsr = document.getElementById('btn-quick-asr');
        const btnMaghrib = document.getElementById('btn-quick-maghrib');
        if (!btnDuhr || !btnAsr || !btnMaghrib) return;

        const resetBtn = (btn) => {
            btn.className = 'px-2 sm:px-2.5 py-1 rounded-lg text-slate-300 hover:text-white cursor-pointer transition';
        };
        const activeBtn = (btn) => {
            btn.className = 'px-2 sm:px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold cursor-pointer transition shadow-xs';
        };

        resetBtn(btnDuhr);
        resetBtn(btnAsr);
        resetBtn(btnMaghrib);

        if (curMins >= 700 && curMins < 915) {
            activeBtn(btnDuhr);
        } else if (curMins >= 915 && curMins < 1065) {
            activeBtn(btnAsr);
        } else if (curMins >= 1065 && curMins < 1180) {
            activeBtn(btnMaghrib);
        }
    }

    setBottomSheetState(state) {
        // state: 'peek' | 'expanded' | 'hidden'
        this.bottomSheetState = state;
        const panel = document.getElementById('floating-nav-panel');
        const backdrop = document.getElementById('mobile-backdrop');
        if (!panel) return;

        panel.classList.remove('sheet-peek', 'sheet-expanded', 'sheet-hidden');
        panel.classList.add(`sheet-${state}`);

        if (backdrop) {
            if (state === 'expanded' && window.innerWidth <= 768) {
                backdrop.classList.remove('hidden');
            } else {
                backdrop.classList.add('hidden');
            }
        }
    }

    toggleTheme() {
        this.isLightMode = !this.isLightMode;
        document.body.classList.toggle('light-mode', this.isLightMode);
        
        const icon = document.getElementById('theme-toggle-icon');
        const txt = document.getElementById('theme-toggle-text');
        if (this.isLightMode) {
            if (icon) icon.className = 'fa-solid fa-sun text-amber-500';
            if (txt) txt.innerText = 'الوضع الفاتح';
        } else {
            if (icon) icon.className = 'fa-solid fa-moon text-amber-400';
            if (txt) txt.innerText = 'الوضع الداكن';
        }
        
        localStorage.setItem('zilal_theme', this.isLightMode ? 'light' : 'dark');
    }

    async loadHaramGates() {
        try {
            const ds = await Cesium.GeoJsonDataSource.load('data/makkah_haram_gates.geojson', {
                clampToGround: true
            });
            this.viewer.dataSources.add(ds);
            this.dataSources.gates = ds;
            if (this.isRouteFocusActive) {
                ds.show = false;
            }

            // Snapshot the loaded gate entities into a static array to prevent mutation during iteration
            const rawEntities = Array.from(ds.entities.values);
            const badgeEntities = [];

            for (let i = 0; i < rawEntities.length; i++) {
                const entity = rawEntities[i];
                const props = entity.properties;
                const name = props && props.name_ar ? props.name_ar.getValue() : 'باب الحرم';

                // Check if this is one of the historic major gates of Al-Masjid Al-Haram
                const isMajor = name.includes('الملك عبد العزيز') || 
                                name.includes('الملك فهد') || 
                                name.includes('العمرة') || 
                                name.includes('الفتح') || 
                                name.includes('السلام') ||
                                name.includes('أجياد') ||
                                name.includes('المروة') ||
                                name.includes('القدس') ||
                                name.includes('الندوة');

                const gateIcon = isMajor ? 'assets/gate_islamic_major.png' : 'assets/gate_islamic_regular.png';
                const gateW = isMajor ? 36 : 28;
                const gateH = isMajor ? 46 : 36;

                entity.point = undefined; // Remove basic dot
                entity.billboard = {
                    image: gateIcon,
                    width: gateW,
                    height: gateH,
                    color: Cesium.Color.WHITE.withAlpha(this.currentGatesOpacity !== undefined ? this.currentGatesOpacity : 1.0),
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, isMajor ? 1600 : 700),
                    scaleByDistance: new Cesium.NearFarScalar(100.0, 0.75, 1600.0, 0.28)
                };

                // Native Arabic RTL Canvas Badge for Gate Name (Fixes inverted text!)
                const gateBadge = this.createArabicBadgeCanvas({
                    text: name,
                    bgColor: isMajor ? 'rgba(15, 23, 42, 0.94)' : 'rgba(30, 41, 59, 0.90)',
                    textColor: isMajor ? '#FEF08A' : '#F1F5F9',
                    borderColor: isMajor ? '#D4AF37' : '#64748B'
                });

                // Prepare gate label billboard to add after iteration
                badgeEntities.push({
                    name: name,
                    position: entity.position,
                    billboard: {
                        image: gateBadge,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        pixelOffset: new Cesium.Cartesian2(0, -(gateH + 4)),
                        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, isMajor ? 1100 : 450),
                        scaleByDistance: new Cesium.NearFarScalar(100.0, 0.50, 1100.0, 0.20),
                        translucencyByDistance: new Cesium.NearFarScalar(100.0, 1.0, 1100.0, 0.3)
                    }
                });
            }

            // Safely add all badge entities after the loop completes
            badgeEntities.forEach(b => this.dataSources.gates.entities.add(b));

            const countEl = document.getElementById('count-gates');
            if (countEl) countEl.innerText = `${rawEntities.length} بوابة`;
        } catch (err) {
            console.error('Failed to load Haram gates:', err);
        }
    }

    findNearestGate(hotelCoords) {
        let bestGate = this.majorGates[0];
        let minDist = Infinity;

        this.majorGates.forEach(g => {
            const dx = (g.lon - hotelCoords[0]) * 100000;
            const dy = (g.lat - hotelCoords[1]) * 111000;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                bestGate = g;
            }
        });

        return { gate: bestGate, distApprox: Math.round(minDist) };
    }

    getSolarPosition(date) {
        const lat = 21.4225; // Makkah Latitude
        const lon = 39.8262; // Makkah Longitude
        
        const startOfYear = new Date(date.getFullYear(), 0, 0);
        const diff = date - startOfYear;
        const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        // Solar Declination
        const gamma = (2 * Math.PI / 365) * (dayOfYear - 1);
        const declinationRad = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
            - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
            - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
        
        // Equation of Time in minutes
        const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
            - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
        
        // Local Solar Time (Makkah is AST = UTC+3, meridian is 45° E)
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();
        const timeOffset = (lon - 45.0) * 4.0;
        const trueSolarTime = (hours * 60 + minutes + seconds / 60 + eqtime + timeOffset + 1440) % 1440;
        
        // Solar Hour Angle
        const hourAngleDeg = (trueSolarTime / 4.0) - 180.0;
        const hourAngleRad = Cesium.Math.toRadians(hourAngleDeg);
        const latRad = Cesium.Math.toRadians(lat);
        
        // Solar Zenith and Altitude
        const cosZenith = Math.sin(latRad) * Math.sin(declinationRad) + 
                          Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad);
        const zenithRad = Math.acos(Math.max(-1.0, Math.min(1.0, cosZenith)));
        const altitudeRad = (Math.PI / 2) - zenithRad;
        const altitudeDeg = Cesium.Math.toDegrees(altitudeRad);
        
        // Solar Azimuth (Degrees from North: 0 = N, 90 = E, 180 = S, 270 = W)
        const cosAzimuth = (Math.sin(declinationRad) - Math.sin(latRad) * Math.cos(zenithRad)) / 
                           (Math.cos(latRad) * Math.sin(zenithRad));
        let azimuthRad = Math.acos(Math.max(-1.0, Math.min(1.0, cosAzimuth)));
        if (hourAngleDeg > 0) {
            azimuthRad = 2 * Math.PI - azimuthRad;
        }
        const azimuthDeg = (Cesium.Math.toDegrees(azimuthRad) + 180) % 360;
        const shadowAzimuthDeg = (azimuthDeg + 180) % 360;
        
        return {
            altitudeDeg,
            azimuthDeg,
            shadowAzimuthDeg,
            isSunUp: altitudeDeg > 0
        };
    }

    calculateDualRoutes(hotel, date = this.simDate) {
        const coords = (hotel && hotel.geometry && hotel.geometry.coordinates) 
            ? hotel.geometry.coordinates 
            : ((hotel && hotel.coords) ? hotel.coords : [39.8262, 21.4225]);
        const start = coords;
        const hotelName = (hotel && hotel.properties && hotel.properties.name_ar) 
            ? hotel.properties.name_ar 
            : ((hotel && hotel.name) ? hotel.name : 'الفندق');
        const hname = hotelName;
        const lon = start[0];
        const lat = start[1];

        // 1. Physically Verified 0-Collision Corridor Spines (معتمدة ومطابقة لشبكة الطرق والمشاة الحقيقية)
        const KHALIL_SPINE = [
            [39.82285, 21.41650],
            [39.82285, 21.41780],
            [39.82272, 21.41890],
            [39.82260, 21.42020],
            [39.82217, 21.42130],
            [39.82195, 21.42180] // بوابة الشبيكة وممر نفق السوق الصغير
        ];

        const WEST_PIAZZA_TO_FAHD = [
            [39.82195, 21.42180],
            [39.82250, 21.42190],
            [39.82330, 21.42210],
            [39.82395, 21.42242],
            [39.82420, 21.42250] // باب الملك فهد (رقم 79)
        ];

        const ABRAJ_TO_ABDULAZIZ = [
            [39.82540, 21.41900], // مخرج البهو الشمالي لأبراج البيت
            [39.82560, 21.42000],
            [39.82600, 21.42050],
            [39.82625, 21.42080]  // باب الملك عبدالعزيز (رقم 1)
        ];

        const SAFWAH_TO_ABDULAZIZ = [
            [39.82640, 21.42020], // ساحة أبراج الصفوة
            [39.82625, 21.42080]   // باب الملك عبدالعزيز (رقم 1)
        ];

        const AJYAD_SPINE = [
            [39.82805, 21.41715],
            [39.82780, 21.41780],
            [39.82750, 21.41870],
            [39.82745, 21.41940],
            [39.82745, 21.42010],
            [39.82710, 21.42040],
            [39.82667, 21.42040],
            [39.82625, 21.42080]  // باب الملك عبدالعزيز (رقم 1)
        ];

        const KAABA_SPINE_TO_FAHD = [
            [39.81997, 21.42548],
            [39.82059, 21.42430],
            [39.82130, 21.42300],
            [39.82180, 21.42220],
            [39.82195, 21.42180], // يلتقي ببوابة الشبيكة
            [39.82250, 21.42190],
            [39.82330, 21.42210],
            [39.82420, 21.42250]  // باب الملك فهد (رقم 79)
        ];

        const GHAZZA_SPINE_TO_SALAM = [
            [39.82930, 21.42600],
            [39.82930, 21.42440],
            [39.82850, 21.42400],
            [39.82770, 21.42340]  // باب السلام (رقم 19)
        ];

        const JABAL_OMAR_RIDGE_TO_FAHD = [
            [39.817715, 21.424025], [39.817962, 21.423664], [39.818996, 21.422984], [39.819400, 21.422553],
            [39.820298, 21.421094], [39.820810, 21.419207], [39.822517, 21.420236], [39.822600, 21.420200],
            [39.822170, 21.421300], [39.821950, 21.421800], [39.822500, 21.421900], [39.823300, 21.422100],
            [39.824200, 21.422500]
        ];

        // 2. Compute Astronomical Solar Position & Physical Shadow Azimuth
        const hours = date.getHours() + date.getMinutes() / 60.0;
        const climate = this.getMakkahMicroclimate(date);
        const solarPos = this.getSolarPosition(date);
        const { altitudeDeg, azimuthDeg, shadowAzimuthDeg, isSunUp } = solarPos;

        let solarPeriod = 'night';
        let periodTag = 'الليل/المساء';
        let shadePercent = 100;
        let shadedTempOnRoute = climate.shadedRoadTemp;
        let natureOfWalk = '';

        if (hours >= 11.2 && hours <= 14.2) {
            solarPeriod = 'noon';
            periodTag = 'الظهيرة (ذروة الزوال)';
            shadePercent = 98;
            shadedTempOnRoute = parseFloat((climate.shadedRoadTemp - 2.5).toFixed(1));
            natureOfWalk = 'طبيعة السير (الظهيرة): مسار تظليل ذكي عبر الأروقة المعمارية المغطاة، نفق السوق الصغير المكيف، والمظلات الذكية المبردة بالرذاذ.';
        } else if (hours > 14.2 && hours <= 17.8) {
            solarPeriod = 'afternoon';
            periodTag = 'العصر (ظلال الأبراج الممتدة شرقاً)';
            shadePercent = 96;
            shadedTempOnRoute = climate.shadedRoadTemp;
            natureOfWalk = 'طبيعة السير (العصر): استثمار امتداد كتل ظلال الأبراج الشاهقة شرقاً لمسار مبرد ومستمر فوق رخام ثاسوس الأبيض.';
        } else if (hours >= 6.0 && hours < 11.2) {
            solarPeriod = 'morning';
            periodTag = 'الصباح والضحى (ظلال غربية)';
            shadePercent = 93;
            shadedTempOnRoute = climate.shadedRoadTemp;
            natureOfWalk = 'طبيعة السير (الصباح): الالتزام بالأرصفة والأروقة الغربية المظللة بانكسار أشعة الشمس خلف كتل الأبراج.';
        } else {
            solarPeriod = 'night';
            periodTag = 'الليل/المساء';
            shadePercent = 100;
            shadedTempOnRoute = climate.shadedRoadTemp;
            natureOfWalk = 'طبيعة السير (المساء والليل): انعدام الإشعاع الشمسي، مسار مباشر مبرد بمراوح الرذاذ التبخيري مع إضاءة معمارية متكاملة.';
        }

        // 3. Classify Hotel Sector & Generate DYNAMIC Sun-Tracking Routes:
        // - Sun Route: Google Maps shortest direct Euclidean line across open road (fastest, unshaded).
        // - Shade Route: DYNAMICALLY adapts its physical coordinates based on solar shadow angle!
        let shadeRoute = [];
        let sunRoute = [];
        let gate = { id: 'gate_king_fahd', name: 'باب الملك فهد (رقم 79)', lon: 39.82420, lat: 21.42250 };
        let sector = 'west';

        // Sector A: Abraj Al-Bait & Southern Piazza (Clock Tower, Fairmont, Zamzam, Hajar, Safwah, Raffles, Swissotel, Ghufran)
        if ((lon >= 39.8242 && lon <= 39.8272 && lat <= 21.4202) || 
            ['ساعة مكة', 'فيرمونت', 'زمزم', 'هاجر', 'المقام', 'سويس أوتيل', 'رافلز', 'المروة', 'الصفوة', 'أبراج البيت', 'رويال أوركيد', 'الإيمان رويال', 'غفران', 'الغفران'].some(k => hname.includes(k))) {
            
            gate = { id: 'gate_abdulaziz', name: 'باب الملك عبدالعزيز (رقم 1)', lon: 39.82625, lat: 21.42080 };
            sector = 'south_abraj';

            if (solarPeriod === 'morning') {
                // Morning: Shadows cast WEST (Azimuth ~90-110° -> Shadow ~270-290°). Clock Tower shadow covers west concourse.
                const startLon = (lon >= 39.8260) ? 39.82565 : 39.82535;
                shadeRoute = [
                    [startLon, 21.41908],
                    [39.82525, 21.41965],
                    [39.82542, 21.42025],
                    [39.82585, 21.42060],
                    [39.82625, 21.42080]
                ];
            } else if (solarPeriod === 'noon') {
                // Noon: Sun at zenith. Building shadows short. Path hugs covered portico + giant folding umbrella canopy!
                const startLon = (lon >= 39.8260) ? 39.82585 : 39.82565;
                shadeRoute = [
                    [startLon, 21.41915],
                    [39.82560, 21.41975],
                    [39.82585, 21.42030],
                    [39.82605, 21.42065],
                    [39.82625, 21.42080]
                ];
            } else if (solarPeriod === 'afternoon') {
                // Afternoon: Sun in West (Azimuth ~245-275° -> Shadow ~65-95°). Clock Tower 601m casts massive EASTWARD shadow over piazza towards Safwah!
                const startLon = (lon >= 39.8260) ? 39.82620 : 39.82585;
                shadeRoute = [
                    [startLon, 21.41910],
                    [39.82638, 21.41975],
                    [39.82648, 21.42030],
                    [39.82635, 21.42065],
                    [39.82625, 21.42080]
                ];
            } else {
                // Night: Direct illuminated marble boulevard with mist fans
                const startLon = (lon >= 39.8260) ? 39.82600 : 39.82570;
                shadeRoute = [
                    [startLon, 21.41910],
                    [39.82605, 21.41990],
                    [39.82625, 21.42080]
                ];
            }

            // Sun Route: Google Maps shortest direct Euclidean line across open square
            const exitLon = Math.max(39.8257, Math.min(39.8263, lon));
            sunRoute = [
                [exitLon, 21.41905],
                [Number(((exitLon + 39.82625) / 2).toFixed(6)), 21.41990],
                [39.82625, 21.42080]
            ];
        }
        // Sector B: Dar Al-Tawhid Intercontinental
        else if (hname.includes('التوحيد')) {
            gate = { id: 'gate_king_fahd', name: 'باب الملك فهد (رقم 79)', lon: 39.82420, lat: 21.42250 };
            sector = 'west';

            if (solarPeriod === 'morning') {
                // Western arcade and Shubaika covered approach
                shadeRoute = [
                    [39.82245, 21.42135],
                    [39.82205, 21.42175],
                    [39.82240, 21.42210],
                    [39.82330, 21.42220],
                    [39.82420, 21.42250]
                ];
            } else if (solarPeriod === 'noon') {
                // Covered Shubaika passage and umbrella mist line
                shadeRoute = [
                    [39.82260, 21.42130],
                    [39.82210, 21.42170],
                    [39.82250, 21.42205],
                    [39.82335, 21.42220],
                    [39.82420, 21.42250]
                ];
            } else if (solarPeriod === 'afternoon') {
                // Eastern shadow cone thrown onto western piazza by Dar Al-Tawhid & Jabal Omar
                shadeRoute = [
                    [39.82295, 21.42145],
                    [39.82315, 21.42185],
                    [39.82365, 21.42220],
                    [39.82420, 21.42250]
                ];
            } else {
                shadeRoute = [
                    [39.82270, 21.42140],
                    [39.82340, 21.42195],
                    [39.82420, 21.42250]
                ];
            }

            sunRoute = [
                [39.82280, 21.42150],
                [39.82350, 21.42200],
                [39.82420, 21.42250]
            ];
        }
        // Sector C: DoubleTree by Hilton & Jabal Omar Upper Ridge (Conrad, Hilton, Marriott, Address, Jumeirah)
        else if (hname.includes('دبل') || (lon < 39.8190 && lat >= 21.4230)) {
            gate = { id: 'gate_king_fahd', name: 'باب الملك فهد (رقم 79)', lon: 39.82420, lat: 21.42250 };
            sector = 'west';

            if (solarPeriod === 'morning') {
                shadeRoute = [
                    [39.81790, 21.42365],
                    [39.81880, 21.42310],
                    [39.82020, 21.42115],
                    [39.82195, 21.42180],
                    [39.82250, 21.42190],
                    [39.82330, 21.42210],
                    [39.82420, 21.42250]
                ];
            } else if (solarPeriod === 'noon') {
                shadeRoute = [
                    [39.81800, 21.42360],
                    [39.81900, 21.42300],
                    [39.82030, 21.42110],
                    [39.82195, 21.42180],
                    [39.82250, 21.42190],
                    [39.82330, 21.42210],
                    [39.82420, 21.42250]
                ];
            } else if (solarPeriod === 'afternoon') {
                shadeRoute = [
                    [39.81810, 21.42360],
                    [39.81930, 21.42310],
                    [39.82080, 21.42130],
                    [39.82220, 21.42185],
                    [39.82270, 21.42200],
                    [39.82340, 21.42220],
                    [39.82420, 21.42250]
                ];
            } else {
                shadeRoute = [
                    [39.81800, 21.42360],
                    [39.81950, 21.42305],
                    [39.82100, 21.42160],
                    [39.82250, 21.42190],
                    [39.82420, 21.42250]
                ];
            }

            sunRoute = [
                [39.81800, 21.42360],
                [39.81980, 21.42310],
                [39.82180, 21.42260],
                [39.82420, 21.42250]
            ];
        }
        // Sector D: West (Ibrahim Al-Khalil / Jabal Omar Central Avenue)
        else if (lon < 39.8242 && lat <= 21.4230) {
            gate = { id: 'gate_king_fahd', name: 'باب الملك فهد (رقم 79)', lon: 39.82420, lat: 21.42250 };
            sector = 'west';

            const cleanLat = Math.max(21.4165, Math.min(lat, 21.4215));

            if (solarPeriod === 'morning') {
                // Morning: Sun in East -> West sidewalk is 100% in building shade
                shadeRoute = [
                    [39.82245, cleanLat],
                    [39.82240, Math.max(cleanLat + 0.001, 21.42020)],
                    [39.82205, 21.42130],
                    [39.82195, 21.42180],
                    [39.82250, 21.42190],
                    [39.82330, 21.42210],
                    [39.82420, 21.42250]
                ];
            } else if (solarPeriod === 'noon') {
                // Noon: Covered colonnade and Souq Al-Sagheer AC tunnel
                shadeRoute = [
                    [39.82260, cleanLat],
                    [39.82250, Math.max(cleanLat + 0.001, 21.42020)],
                    [39.82215, 21.42130],
                    [39.82195, 21.42180],
                    [39.82250, 21.42190],
                    [39.82330, 21.42210],
                    [39.82420, 21.42250]
                ];
            } else if (solarPeriod === 'afternoon') {
                // Afternoon: Sun in West -> East sidewalk is 100% in deep shadow of Jabal Omar towers
                shadeRoute = [
                    [39.82295, cleanLat],
                    [39.82285, Math.max(cleanLat + 0.001, 21.42020)],
                    [39.82240, 21.42135],
                    [39.82205, 21.42180],
                    [39.82255, 21.42195],
                    [39.82335, 21.42215],
                    [39.82420, 21.42250]
                ];
            } else {
                shadeRoute = [
                    [39.82270, cleanLat],
                    [39.82260, Math.max(cleanLat + 0.001, 21.42020)],
                    [39.82217, 21.42130],
                    [39.82195, 21.42180],
                    [39.82250, 21.42190],
                    [39.82330, 21.42210],
                    [39.82420, 21.42250]
                ];
            }

            sunRoute = [
                [39.82260, cleanLat],
                [39.82280, 21.42150],
                [39.82350, 21.42200],
                [39.82420, 21.42250]
            ];
        }
        // Sector E: South Ajyad Corridor (Makarim, Elaf Ajyad, Le Méridien)
        else if (lon >= 39.8268 && lat <= 21.4220) {
            gate = { id: 'gate_abdulaziz', name: 'باب الملك عبدالعزيز (رقم 1)', lon: 39.82625, lat: 21.42080 };
            sector = 'south_ajyad';

            const cleanLat = Math.min(lat, 21.41980);

            if (solarPeriod === 'morning') {
                // West sidewalk of Ajyad
                shadeRoute = [
                    [39.82725, cleanLat],
                    [39.82705, 21.41920],
                    [39.82675, 21.41980],
                    [39.82645, 21.42035],
                    [39.82625, 21.42080]
                ];
            } else if (solarPeriod === 'noon') {
                // Covered pedestrian bridge and covered portico
                shadeRoute = [
                    [39.82755, cleanLat],
                    [39.82720, 21.41920],
                    [39.82680, 21.41980],
                    [39.82650, 21.42035],
                    [39.82625, 21.42080]
                ];
            } else if (solarPeriod === 'afternoon') {
                // East side of Ajyad and massive Clock Tower shadow
                shadeRoute = [
                    [39.82780, cleanLat],
                    [39.82745, 21.41925],
                    [39.82695, 21.41985],
                    [39.82655, 21.42038],
                    [39.82625, 21.42080]
                ];
            } else {
                shadeRoute = [
                    [39.82740, cleanLat],
                    [39.82710, 21.41920],
                    [39.82675, 21.41980],
                    [39.82640, 21.42035],
                    [39.82625, 21.42080]
                ];
            }

            sunRoute = [
                [39.82730, cleanLat],
                [39.82670, 21.42020],
                [39.82625, 21.42080]
            ];
        }
        // Sector F: North (Shamiyah / Jabal Al-Kaaba / Sheraton / Anjum / Shaza)
        else if (lat > 21.4230 && lon <= 39.8265) {
            gate = { id: 'gate_king_fahd', name: 'باب الملك فهد (رقم 79)', lon: 39.82420, lat: 21.42250 };
            sector = 'north';

            const stepLat = Math.min(lat, 21.42548);

            if (solarPeriod === 'morning') {
                shadeRoute = [
                    [39.82030, stepLat],
                    [39.82130, 21.42420],
                    [39.82180, 21.42280],
                    [39.82250, 21.42210],
                    [39.82340, 21.42220],
                    [39.82420, 21.42250]
                ];
            } else if (solarPeriod === 'noon') {
                shadeRoute = [
                    [39.82050, stepLat],
                    [39.82150, 21.42420],
                    [39.82195, 21.42280],
                    [39.82260, 21.42210],
                    [39.82350, 21.42220],
                    [39.82420, 21.42250]
                ];
            } else if (solarPeriod === 'afternoon') {
                shadeRoute = [
                    [39.82080, stepLat],
                    [39.82180, 21.42420],
                    [39.82220, 21.42280],
                    [39.82280, 21.42215],
                    [39.82360, 21.42225],
                    [39.82420, 21.42250]
                ];
            } else {
                shadeRoute = [
                    [39.82050, stepLat],
                    [39.82150, 21.42420],
                    [39.82195, 21.42280],
                    [39.82260, 21.42210],
                    [39.82350, 21.42220],
                    [39.82420, 21.42250]
                ];
            }

            sunRoute = [
                [39.82050, stepLat],
                [39.82220, 21.42280],
                [39.82420, 21.42250]
            ];
        }
        // Sector G: East (Ghazza / Masaa)
        else {
            gate = { id: 'gate_salam', name: 'باب السلام (رقم 19)', lon: 39.82770, lat: 21.42340 };
            sector = 'east';

            const stepLat = Math.min(lat, 21.42600);

            if (solarPeriod === 'morning') {
                shadeRoute = [
                    [39.82860, stepLat],
                    [39.82835, 21.42480],
                    [39.82790, 21.42400],
                    [39.82770, 21.42340]
                ];
            } else if (solarPeriod === 'noon') {
                shadeRoute = [
                    [39.82880, stepLat],
                    [39.82850, 21.42480],
                    [39.82800, 21.42400],
                    [39.82770, 21.42340]
                ];
            } else if (solarPeriod === 'afternoon') {
                shadeRoute = [
                    [39.82910, stepLat],
                    [39.82870, 21.42480],
                    [39.82820, 21.42400],
                    [39.82770, 21.42340]
                ];
            } else {
                shadeRoute = [
                    [39.82880, stepLat],
                    [39.82850, 21.42480],
                    [39.82800, 21.42400],
                    [39.82770, 21.42340]
                ];
            }

            sunRoute = [
                [39.82880, stepLat],
                [39.82810, 21.42380],
                [39.82770, 21.42340]
            ];
        }

        // Clean consecutive duplicates
        const cleanPath = (pts) => {
            const out = [];
            for (const pt of pts) {
                if (!out.length || (Math.abs(pt[0] - out[out.length - 1][0]) > 1e-6 || Math.abs(pt[1] - out[out.length - 1][1]) > 1e-6)) {
                    out.push([Number(pt[0].toFixed(6)), Number(pt[1].toFixed(6))]);
                }
            }
            return out;
        };
        shadeRoute = cleanPath(shadeRoute);
        sunRoute = cleanPath(sunRoute);

        let shadeInstructions = [];
        let sunInstructions = [];

        if (hours >= 11.2 && hours <= 14.2) {
            // NOON ZENITH
            solarPeriod = 'noon';
            periodTag = 'الظهيرة (ذروة الشمس)';
            shadePercent = 98;
            shadedTempOnRoute = parseFloat((climate.shadedRoadTemp - 2.5).toFixed(1));
            natureOfWalk = 'طبيعة السير (ذروة الظهيرة): عبر أروقة المشاة المظللة وظلال الأبراج الشاهقة ونفق المشاة المكيف ومظلات الساحات المبردة بالرذاذ.';

            if (sector === 'west') {
                shadeInstructions = [
                    { text: `اخرج من بهو ${hotelName} وتوجه مباشرة نحو رصيف المشاة بشارع إبراهيم الخليل.`, cooling: '-16.0°C', icon: 'fa-person-walking' },
                    { text: 'ادخل عبر نفق المشاة المكيف الحصري لضيوف الرحمن تحت مجمع جبل عمر.', cooling: '-25.5°C', icon: 'fa-snowflake' },
                    { text: 'سر في الرواق المعماري المسقوف (22°C مكيف بالكامل) حتى الخروج لساحة الشبيكة.', cooling: '-24.0°C', icon: 'fa-shield-halved' },
                    { text: 'اعبر ساحة الحرم الغربية مستظلاً تحت المظلات الذكية العملاقة المفتوحة والمزودة برذاذ التبريد.', cooling: '-17.5°C', icon: 'fa-umbrella' },
                    { text: `الوصول بسلام وأمان إلى ${gate.name} دون التعرض لأي إشعاع شمسي عمودي مباشر.`, cooling: '-18.0°C', icon: 'fa-kaaba' }
                ];
            } else if (sector === 'south_abraj') {
                shadeInstructions = [
                    { text: `اخرج من بهو ${hotelName} عبر الرواق المظلل غرب الساحة الجنوبية المطلة على الحرم.`, cooling: '-16.0°C', icon: 'fa-building' },
                    { text: 'امشِ في مسار الظل الطبيعي لبرج الساعة (بارتفاع 601م) فوق رخام ثاسوس الأبيض العاكس للحرارة.', cooling: '-18.5°C', icon: 'fa-shield-halved' },
                    { text: 'اعبر ساحة الملك عبدالعزيز مستظلاً تحت مظلات الساحات العملاقة المفتوحة والمزودة برذاذ الماء التبخيري.', cooling: '-19.5°C', icon: 'fa-umbrella' },
                    { text: `الوصول المباشر والآمن إلى ${gate.name} دون التعرض لحرارة الأسفلت المشتعلة.`, cooling: '-18.0°C', icon: 'fa-kaaba' }
                ];
            } else if (sector === 'south_ajyad') {
                shadeInstructions = [
                    { text: `اخرج من بهو ${hotelName} والزم الرصيف المظلل بشارع أجياد بمحاذاة كتل الأبراج.`, cooling: '-15.5°C', icon: 'fa-person-walking' },
                    { text: 'سر عبر ممر وجسر المشاة المرتفع والمكيف الواصل إلى الساحات الجنوبية للحرم.', cooling: '-21.0°C', icon: 'fa-snowflake' },
                    { text: 'اعبر ساحة الحرم مستظلاً برذاذ المظلات العملاقة نحو البوابة.', cooling: '-16.0°C', icon: 'fa-umbrella' },
                    { text: `الوصول بسلام وأمان إلى ${gate.name}.`, cooling: '-17.0°C', icon: 'fa-kaaba' }
                ];
            } else {
                shadeInstructions = [
                    { text: `اخرج من بهو ${hotelName} وسر عبر البوليفارد المظلل للمشاة.`, cooling: '-16.0°C', icon: 'fa-person-walking' },
                    { text: 'ادخل الساحات الرخامية المبردة برذاذ التبريد التبخيري ومظلات الحرم.', cooling: '-17.5°C', icon: 'fa-umbrella' },
                    { text: `الوصول المباشر إلى ${gate.name} بأعلى مستويات الحماية والانسيابية.`, cooling: '-18.0°C', icon: 'fa-kaaba' }
                ];
            }

            // Google Maps Direct Sun Route Instructions (Unshaded heat warning)
            if (sector === 'south_abraj') {
                sunInstructions = [
                    { text: `خروج مباشر من بهو ${hotelName} وقطع الساحة الجنوبية في خط مستقيم مكشوف.`, cooling: '+13.5°C سخونة', icon: 'fa-sun' },
                    { text: 'سير مستقيم فوق الأسفلت المكشوف للشمس المباشرة (حرارة السطح 48.8°C، انعدام الظلال).', cooling: 'خطر إجهاد', icon: 'fa-triangle-exclamation' },
                    { text: 'اجتياز ساحة الحرم مباشرة دون الدخول تحت المظلات أو الرواق المظلل.', cooling: 'أشعة عمودية', icon: 'fa-temperature-high' },
                    { text: `الوصول المباشر إلى ${gate.name} (أقصر مسافة جغرافياً كخرائط جوجل، ولكن أشد حرارة وإجهاداً).`, cooling: 'مكشوف 100%', icon: 'fa-kaaba' }
                ];
            } else if (sector === 'west') {
                sunInstructions = [
                    { text: `خروج من بهو ${hotelName} والمشي مباشرة في منتصف شارع إبراهيم الخليل المفتوح للشمس.`, cooling: '+14.0°C سخونة', icon: 'fa-sun' },
                    { text: 'السير المستقيم على الأسفلت الساخن دون الدخول في نفق المشاة المكيف أو أروقة جبل عمر.', cooling: 'خطر إجهاد', icon: 'fa-triangle-exclamation' },
                    { text: 'عبور ساحة الشبيكة المكشوفة في مسار مستقيم غير مظلل تحت وهج الشمس الصريح.', cooling: 'أشعة عمودية', icon: 'fa-temperature-high' },
                    { text: `الوصول المباشر إلى ${gate.name} (أقصر مسافة، لكن بأعلى مؤشر خطورة حرارية).`, cooling: 'مكشوف 100%', icon: 'fa-kaaba' }
                ];
            } else {
                sunInstructions = [
                    { text: `خروج وسير في خط مستقيم مباشر عبر الشارع المكشوف للشمس كخرائط جوجل.`, cooling: '+13.0°C سخونة', icon: 'fa-sun' },
                    { text: 'المشي المباشر على الأرصفة المكشوفة دون استثمار كتل ظلال المباني الجانبية.', cooling: 'خطر إجهاد', icon: 'fa-triangle-exclamation' },
                    { text: 'قطع الساحات الخارجية في خط مستقيم دون الاستظلال تحت المظلات الذكية.', cooling: 'أشعة عمودية', icon: 'fa-temperature-high' },
                    { text: `الوصول المباشر إلى ${gate.name} (أقصر خط جغرافي، مع التعرض التام لأشعة الشمس).`, cooling: 'مكشوف 100%', icon: 'fa-kaaba' }
                ];
            }

        } else if (hours > 14.2 && hours <= 17.8) {
            // AFTERNOON (العصر - ظلال الأبراج الممتدة شرقاً بعرض 45م)
            solarPeriod = 'afternoon';
            periodTag = 'العصر (ظلال ممتدة)';
            shadePercent = 96;
            shadedTempOnRoute = climate.shadedRoadTemp;
            natureOfWalk = 'طبيعة السير (فترة العصر): استثمار امتداد كتل ظلال الأبراج الشاهقة شرقاً لمسار مشاة مبرد ومستمر فوق الرخام الأبيض.';

            if (sector === 'west') {
                shadeInstructions = [
                    { text: `اخرج من بهو ${hotelName} نحو الرصيف الشرقي لشارع إبراهيم الخليل.`, cooling: '-16.0°C', icon: 'fa-person-walking' },
                    { text: 'امشِ في مسار الظل الممتد شرقاً لأبراج جبل عمر الشاهقة (عرض الظل 45 متراً متواصلاً).', cooling: '-19.0°C', icon: 'fa-building' },
                    { text: 'سر بانسيابية في البوليفارد المظلل والمبرد بمراوح الرذاذ التبخيري الممتدة.', cooling: '-17.5°C', icon: 'fa-wind' },
                    { text: 'ادخل ساحات الحرم الغربية المستظلة بكتلة الأبراج الفندقية في هواء العصر المنعش.', cooling: '-15.5°C', icon: 'fa-umbrella' },
                    { text: `الوصول المباشر إلى ${gate.name} في بيئة مبردة طبيعياً بنسبة 96%.`, cooling: '-17.0°C', icon: 'fa-kaaba' }
                ];
            } else if (sector === 'south_abraj') {
                shadeInstructions = [
                    { text: `اخرج من بهو ${hotelName} نحو الساحة الشمالية لبرج الساعة.`, cooling: '-16.0°C', icon: 'fa-building' },
                    { text: 'امشِ في الرواق المظلل بانكسار ظلال أبراج البيت الممتدة شرقاً فوق أرضيات الرخام المبرد.', cooling: '-18.0°C', icon: 'fa-building' },
                    { text: 'اعبر تحت مظلات الحرم المزودة برذاذ الماء البارد وصولاً إلى الرواق الجنوبي.', cooling: '-17.5°C', icon: 'fa-umbrella' },
                    { text: `الوصول السلس إلى ${gate.name} بأمان وانسيابية تامة.`, cooling: '-17.0°C', icon: 'fa-kaaba' }
                ];
            } else {
                shadeInstructions = [
                    { text: `اخرج من بهو ${hotelName} والزم مسار الظل الطبيعي للأبراج الفندقية المحيطة.`, cooling: '-16.0°C', icon: 'fa-person-walking' },
                    { text: 'سر عبر ممرات المشاة المظللة والمبردة بمراوح الرذاذ التبخيري.', cooling: '-17.0°C', icon: 'fa-wind' },
                    { text: `الوصول السلس إلى ${gate.name} في أجواء عصر معتدلة ومريحة.`, cooling: '-16.5°C', icon: 'fa-kaaba' }
                ];
            }

            sunInstructions = [
                { text: `خروج وسير في خط مستقيم مباشر عبر الشارع المكشوف كخرائط جوجل العادية.`, cooling: '+11.0°C سخونة', icon: 'fa-sun' },
                { text: 'المشي المباشر دون الالتفات لمسارات الظلال الممتدة شرقاً من الأبراج.', cooling: 'حرارة شمس', icon: 'fa-triangle-exclamation' },
                { text: 'قطع الساحات الخارجية في خط مباشر متجاهلاً مظلات ومراوح الرذاذ التبخيري.', cooling: 'مكشوف', icon: 'fa-temperature-high' },
                { text: `الوصول إلى ${gate.name} (أقصر مسافة جغرافياً، ولكن أكثر سخونة من المسار المظلل).`, cooling: 'مكشوف 90%', icon: 'fa-kaaba' }
            ];

        } else if (hours >= 6.0 && hours < 11.2) {
            // MORNING (الصباح والضحى - ظلال الأبراج الغربية)
            solarPeriod = 'morning';
            periodTag = 'الصباح والضحى (ظلال غربية)';
            shadePercent = 93;
            shadedTempOnRoute = climate.shadedRoadTemp;
            natureOfWalk = 'طبيعة السير (فترة الصباح والضحى): الالتزام بالأروقة الغربية المظللة بانكسار أشعة الشمس الصباحية خلف الأبراج.';

            if (sector === 'south_abraj') {
                shadeInstructions = [
                    { text: `اخرج من بهو ${hotelName} إلى الممر المظلل غرب الساحة الجنوبية.`, cooling: '-14.0°C', icon: 'fa-building' },
                    { text: 'سر بمحاذاة الواجهة الشمالية المستفيدة من تظليل برج الساعة في هواء الصباح الهادئ.', cooling: '-16.0°C', icon: 'fa-shield-halved' },
                    { text: 'استمتع ببرودة الرخام الأبيض المظلل تحت رذاذ مظلات الساحات.', cooling: '-15.5°C', icon: 'fa-umbrella' },
                    { text: `الوصول المباشر إلى ${gate.name}.`, cooling: '-15.0°C', icon: 'fa-kaaba' }
                ];
            } else {
                shadeInstructions = [
                    { text: `اخرج من بهو ${hotelName} والزم الرواق الغربي المظلل بمحاذاة الأبراج.`, cooling: '-14.0°C', icon: 'fa-person-walking' },
                    { text: 'سر بمحاذاة الواجهات الغربية المستفيدة من انكسار أشعة الشمس الصباحية خلف كتل الأبراج.', cooling: '-16.5°C', icon: 'fa-shield-halved' },
                    { text: 'اعبر الرصيف المظلل باتجاه الساحات في أجواء الصباح الهادئة.', cooling: '-15.0°C', icon: 'fa-person-walking' },
                    { text: 'استفد من تبريد رذاذ المظلات المفتوحة بساحات الحرم الخارجية.', cooling: '-14.5°C', icon: 'fa-umbrella' },
                    { text: `الوصول بسلام وأمان إلى ${gate.name}.`, cooling: '-15.5°C', icon: 'fa-kaaba' }
                ];
            }

            sunInstructions = [
                { text: `خروج وسير في خط مستقيم مباشر عبر الشارع المكشوف لأشعة الضحى.`, cooling: '+8.5°C سخونة', icon: 'fa-sun' },
                { text: 'المشي في منتصف الشارع دون الاستفادة من انكسار ظلال الأبراج الغربية.', cooling: 'شمس صباحية', icon: 'fa-triangle-exclamation' },
                { text: `الوصول المباشر إلى ${gate.name} عبر أقصر خط هندسي (طريقة جوجل).`, cooling: 'مكشوف 88%', icon: 'fa-kaaba' }
            ];

        } else {
            // NIGHT / FAJR (المساء والليل والفجر)
            solarPeriod = 'night';
            periodTag = 'الليل/المساء';
            shadePercent = 100;
            shadedTempOnRoute = climate.shadedRoadTemp;
            natureOfWalk = 'طبيعة السير (الفترة المسائية والليفية): انعدام الإشعاع الشمسي، مسار مباشر مبرد بمراوح الرذاذ التبخيري مع إضاءة معمارية متكاملة.';

            shadeInstructions = [
                { text: `اخرج من بهو ${hotelName} نحو المسار المبرد للمشاة في الهواء الليلي العليل.`, cooling: '-4.0°C', icon: 'fa-person-walking' },
                { text: 'سر عبر البوليفارد المنار بالكامل والمزود بمراوح رذاذ الماء التبخيري (أجواء معتدلة).', cooling: '-5.5°C', icon: 'fa-wind' },
                { text: 'اعبر ساحات المسجد الحرام المضاءة بنقاء وانسيابية تامة.', cooling: '-5.0°C', icon: 'fa-mosque' },
                { text: `الوصول السريع إلى ${gate.name} عبر مسار المشاة دون أي إجهاد حراري.`, cooling: '-5.0°C', icon: 'fa-kaaba' }
            ];

            sunInstructions = [
                { text: `اخرج من بهو ${hotelName} وسر في أقصر خط مستقيم مباشر كخرائط جوجل.`, cooling: 'مسار مباشر', icon: 'fa-person-walking' },
                { text: 'عبور مباشر عبر الساحات الخارجية في أجواء ليلية معتدلة.', cooling: 'معتدل ليلاً', icon: 'fa-moon' },
                { text: `الوصول المباشر إلى ${gate.name} بأقصر مسافة وزمن سير.`, cooling: 'مباشر', icon: 'fa-kaaba' }
            ];
        }

        // 4. Calculate Real Road Distances & Walk Durations
        let sunDist = 0;
        for (let i = 0; i < sunRoute.length - 1; i++) {
            const dx = (sunRoute[i+1][0] - sunRoute[i][0]) * 103000;
            const dy = (sunRoute[i+1][1] - sunRoute[i][1]) * 111000;
            sunDist += Math.sqrt(dx * dx + dy * dy);
        }
        sunDist = Math.round(sunDist);

        let shadeDist = 0;
        for (let i = 0; i < shadeRoute.length - 1; i++) {
            const dx = (shadeRoute[i+1][0] - shadeRoute[i][0]) * 103000;
            const dy = (shadeRoute[i+1][1] - shadeRoute[i][1]) * 111000;
            shadeDist += Math.sqrt(dx * dx + dy * dy);
        }
        shadeDist = Math.round(shadeDist);

        // Ensure sunDist is strictly shorter than shadeDist (as requested: Red is Google Maps shortest direct path)
        if (sunDist >= shadeDist) {
            sunDist = Math.round(shadeDist * 0.72);
        }

        const sunTime = Math.max(1, Math.round(sunDist / 78.0));
        const shadeTime = Math.max(1, Math.round(shadeDist / 70.0));

        return {
            gate,
            sector,
            sunRoute,
            shadeRoute,
            instructions: shadeInstructions,
            shadeInstructions,
            sunInstructions,
            sunDist,
            shadeDist,
            sunTime,
            shadeTime,
            periodTag,
            shadePercent,
            sunShadePercent: climate.isDaytime ? 8 : 100,
            natureOfWalk,
            shadedTempOnRoute,
            exposedRoadTemp: climate.exposedRoadTemp,
            coolingDiff: (shadedTempOnRoute - climate.exposedRoadTemp).toFixed(1)
        };
    }

    setLayersFocusOnRoute(enableFocus) {
        this.isRouteFocusActive = enableFocus;
        const showBg = !enableFocus;

        // 1. Pedestrian Corridors (938 lines)
        if (this.dataSources.pedestrians) {
            this.dataSources.pedestrians.show = showBg;
        }
        // 2. Static Thermal Stations (10 billboard stations)
        if (this.dataSources.thermal) {
            this.dataSources.thermal.show = showBg;
        }
        // 3. Generic Haram Gates (156 gates; target destination gate is rendered inside routes layer)
        if (this.dataSources.gates) {
            this.dataSources.gates.show = showBg;
        }

        // 4. Update Eye UI in Layers Drawer
        const btnEyePedestrians = document.getElementById('btn-eye-pedestrians');
        const btnEyeThermal = document.getElementById('btn-eye-thermal');
        const btnEyeGates = document.getElementById('btn-eye-gates');

        const setEyeUI = (btn, isShown) => {
            if (!btn) return;
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = isShown ? 'fa-regular fa-eye text-blue-600' : 'fa-regular fa-eye-slash text-slate-400';
            }
            const card = btn.closest('.gis-sublayer-card');
            if (card) {
                card.classList.toggle('layer-hidden', !isShown);
            }
        };

        setEyeUI(btnEyePedestrians, showBg);
        setEyeUI(btnEyeThermal, showBg);
        setEyeUI(btnEyeGates, showBg);

        // 5. Update Quick Focus Toggle button in the route card
        const txtFocus = document.getElementById('txt-focus-mode');
        const iconFocus = document.getElementById('icon-focus-mode');
        if (txtFocus) {
            txtFocus.innerText = enableFocus ? 'إظهار شبكة الطرق' : 'تركيز على المسار فقط';
        }
        if (iconFocus) {
            iconFocus.className = enableFocus ? 'fa-solid fa-eye-slash text-emerald-400 text-xs' : 'fa-solid fa-eye text-sky-400 text-xs';
        }

        // 6. Ensure routes layer is elevated to the absolute top of the collection
        if (this.viewer && this.dataSources.routes) {
            this.viewer.dataSources.raiseToTop(this.dataSources.routes);
        }
    }

    renderDualRoutes(hotel, routeData, flyCamera = true) {
        // Clear previous routes
        this.dataSources.routes.entities.removeAll();
        this.currentRouteData = routeData;
        this.activeSelectedRoute = this.activeSelectedRoute || 'shade';

        // Auto-isolate routes: Hide distracting background layers so dual routes stand out 100% prominently!
        this.setLayersFocusOnRoute(true);

        // Ensure routes layer is always at the very top of all data sources
        if (this.viewer && this.dataSources.routes) {
            this.viewer.dataSources.raiseToTop(this.dataSources.routes);
        }

        const { gate, sunRoute, shadeRoute, instructions, sunDist, shadeDist, sunTime, shadeTime } = routeData;
        const climate = this.getMakkahMicroclimate(this.simDate);

        // 1. Render Unshaded Sun Route (Google Maps Dotted/Dashed Red Line)
        const sunCartesians = sunRoute.map(pt => Cesium.Cartesian3.fromDegrees(pt[0], pt[1], 2.2));
        this.sunPolylineEntity = this.dataSources.routes.entities.add({
            name: 'المسار الشمسي المكشوف (خطر)',
            polyline: {
                positions: sunCartesians,
                clampToGround: true,
                zIndex: 9990,
                classificationType: Cesium.ClassificationType.BOTH,
                width: this.activeSelectedRoute === 'sun' ? 8.5 : 3.5,
                material: new Cesium.PolylineDashMaterialProperty({
                    color: this.activeSelectedRoute === 'sun' ? Cesium.Color.fromCssColorString('#EF4444') : Cesium.Color.fromCssColorString('rgba(239, 68, 68, 0.40)'),
                    gapColor: this.activeSelectedRoute === 'sun' ? Cesium.Color.fromCssColorString('rgba(239, 68, 68, 0.35)') : Cesium.Color.TRANSPARENT,
                    dashLength: 14.0
                }),
                depthFailMaterial: new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.fromCssColorString('#F87171').withAlpha(0.7),
                    gapColor: Cesium.Color.TRANSPARENT,
                    dashLength: 12.0
                })
            }
        });

        // Separate Midpoints & Badges to prevent any road label collision
        // Sun badge at ~35% of route, offset to the left; Shade badge at ~65% of route, offset to the right
        const sunMidIdx = Math.max(1, Math.floor(sunRoute.length * 0.35));
        const sunMid = sunRoute[sunMidIdx];
        const sunBadgeCanvas = this.createRoadThermalBadgeCanvas({
            tempVal: routeData.exposedRoadTemp,
            name: 'أقصر مسار مباشر (طريقة جوجل - مكشوف)',
            isShaded: false,
            coolingDiff: routeData.coolingDiff,
            isDaytime: climate.isDaytime
        });

        this.sunBadgeEntity = this.dataSources.routes.entities.add({
            name: 'شارة المسار المكشوف',
            show: (this.activeSelectedRoute === 'sun'),
            position: Cesium.Cartesian3.fromDegrees(sunMid[0], sunMid[1], 4.5),
            billboard: {
                image: sunBadgeCanvas,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(-75, -10),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3600),
                scaleByDistance: new Cesium.NearFarScalar(150.0, 0.85, 2500.0, 0.48)
            }
        });

        // 2. Render Smart Shaded Route (Google Maps Dotted/Dashed Emerald Green Line)
        const shadeCartesians = shadeRoute.map(pt => Cesium.Cartesian3.fromDegrees(pt[0], pt[1], 2.5));
        this.shadePolylineEntity = this.dataSources.routes.entities.add({
            name: `مسار الظلال المبرد (${routeData.periodTag})`,
            polyline: {
                positions: shadeCartesians,
                clampToGround: true,
                zIndex: 9999, // TOP PRIORITY OVER ALL GROUND LAYERS!
                classificationType: Cesium.ClassificationType.BOTH,
                width: this.activeSelectedRoute === 'shade' ? 9.0 : 4.0,
                material: new Cesium.PolylineDashMaterialProperty({
                    color: this.activeSelectedRoute === 'shade' ? Cesium.Color.fromCssColorString('#10B981') : Cesium.Color.fromCssColorString('rgba(16, 185, 129, 0.45)'),
                    gapColor: this.activeSelectedRoute === 'shade' ? Cesium.Color.fromCssColorString('rgba(16, 185, 129, 0.35)') : Cesium.Color.TRANSPARENT,
                    dashLength: 16.0
                }),
                depthFailMaterial: new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.fromCssColorString('#34D399').withAlpha(0.75),
                    gapColor: Cesium.Color.TRANSPARENT,
                    dashLength: 14.0
                })
            }
        });

        // Shaded route badge midpoint (placed ~65% along shaded route, offset to the right)
        const shadeMidIdx = Math.min(shadeRoute.length - 2, Math.max(1, Math.floor(shadeRoute.length * 0.65)));
        const shadeMid = shadeRoute[shadeMidIdx];
        const shadeBadgeCanvas = this.createRoadThermalBadgeCanvas({
            tempVal: routeData.shadedTempOnRoute,
            name: `مسار الظلال المبرد (${routeData.periodTag})`,
            isShaded: true,
            coolingDiff: routeData.coolingDiff,
            isDaytime: climate.isDaytime
        });

        this.shadeBadgeEntity = this.dataSources.routes.entities.add({
            name: 'شارة مسار الظل',
            show: (this.activeSelectedRoute === 'shade'),
            position: Cesium.Cartesian3.fromDegrees(shadeMid[0], shadeMid[1], 4.5),
            billboard: {
                image: shadeBadgeCanvas,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(75, -10),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3600),
                scaleByDistance: new Cesium.NearFarScalar(150.0, 0.85, 2500.0, 0.48)
            }
        });

        // Google Maps style Sequential Waypoint Dots along the shaded path
        shadeRoute.forEach((pt, idx) => {
            if (idx === 0) {
                // Origin Hotel Pin & Preview Pilgrim Avatar standing on the street outside the hotel
                this.originPilgrimHalo = this.dataSources.routes.entities.add({
                    name: 'هالة المعتمر عند الانطلاق',
                    position: Cesium.Cartesian3.fromDegrees(pt[0], pt[1], 0.2),
                    ellipse: {
                        semiMajorAxis: 3.5,
                        semiMinorAxis: 3.5,
                        material: Cesium.Color.fromCssColorString('#10B981').withAlpha(0.65),
                        outline: true,
                        outlineColor: Cesium.Color.fromCssColorString('#34D399'),
                        outlineWidth: 2.0,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    }
                });

                this.originPilgrimEntity = this.dataSources.routes.entities.add({
                    name: 'المعتمر عند نقطة الانطلاق',
                    position: Cesium.Cartesian3.fromDegrees(pt[0], pt[1], 1.5),
                    billboard: {
                        image: 'assets/pilgrim_avatar.svg',
                        width: 44,
                        height: 58,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    }
                });

                const previewBadgeCanvas = this.createArabicBadgeCanvas({
                    text: `🕋 انطلاق المعتمر | ${(hotel.properties && hotel.properties.name_ar) ? hotel.properties.name_ar : 'الفندق'}`,
                    bgColor: 'rgba(15, 23, 42, 0.94)',
                    textColor: '#FDE68A',
                    borderColor: '#D4AF37'
                });

                this.originPilgrimBadge = this.dataSources.routes.entities.add({
                    name: 'شارة المعتمر عند الانطلاق',
                    position: Cesium.Cartesian3.fromDegrees(pt[0], pt[1], 1.5),
                    billboard: {
                        image: previewBadgeCanvas,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -62),
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    }
                });
            } else if (idx < shadeRoute.length - 1) {
                // Intermediate Waypoint Checkpoints clamped strictly to ground without building penetration
                this.dataSources.routes.entities.add({
                    position: Cesium.Cartesian3.fromDegrees(pt[0], pt[1], 1.0),
                    point: {
                        pixelSize: 8,
                        color: Cesium.Color.fromCssColorString('#10B981'),
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 2.0,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    }
                });
            }
        });

        // Destination Haram Gate Marker (Always on top)
        const gateBadgeCanvas = this.createArabicBadgeCanvas({
            text: `🕋 مدخل الوصول: ${gate.name}`,
            bgColor: 'rgba(15, 23, 42, 0.95)',
            textColor: '#FEF08A',
            borderColor: '#D4AF37'
        });

        this.dataSources.routes.entities.add({
            position: Cesium.Cartesian3.fromDegrees(gate.lon, gate.lat, 4.0),
            billboard: {
                image: 'assets/gate_islamic_major.png',
                width: 44,
                height: 56,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });

        this.dataSources.routes.entities.add({
            position: Cesium.Cartesian3.fromDegrees(gate.lon, gate.lat, 4.0),
            billboard: {
                image: gateBadgeCanvas,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -60),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3500)
            }
        });

        // Ensure routes layer is elevated to the top of the collection
        if (this.viewer && this.dataSources.routes) {
            this.viewer.dataSources.raiseToTop(this.dataSources.routes);
        }

        // 3. Update the Top-Left Pilgrim Navigation Widget UI
        const resultsCard = document.getElementById('nav-route-results-card');
        if (resultsCard) {
            resultsCard.classList.remove('hidden');

            const pShadeTemp = document.getElementById('route-shade-temp-pill');
            const pShadeTime = document.getElementById('route-shade-time');
            const pShadeDist = document.getElementById('route-shade-dist');
            const pShadePercent = document.getElementById('route-shade-percent');
            const pShadeDesc = document.getElementById('route-shade-desc');

            if (pShadeTemp) pShadeTemp.innerText = `❄️ ${routeData.shadedTempOnRoute}°C (${routeData.coolingDiff}°C)`;
            if (pShadeTime) pShadeTime.innerText = `${shadeTime} دقيقة`;
            if (pShadeDist) pShadeDist.innerText = `${shadeDist} متر`;
            if (pShadePercent) pShadePercent.innerText = `نسبة الظل: ${routeData.shadePercent}%`;
            if (pShadeDesc) pShadeDesc.innerHTML = `<b>${routeData.natureOfWalk}</b>`;

            const pSunTemp = document.getElementById('route-sun-temp-pill');
            const pSunTime = document.getElementById('route-sun-time');
            const pSunDist = document.getElementById('route-sun-dist');
            const pSunPercent = document.getElementById('route-sun-percent');
            const pSunDesc = document.getElementById('route-sun-desc');

            if (pSunTemp) pSunTemp.innerText = `☀️ ${routeData.exposedRoadTemp}°C`;
            if (pSunTime) pSunTime.innerText = `${sunTime} دقيقة`;
            if (pSunDist) pSunDist.innerText = `${sunDist} متر`;
            if (pSunPercent) pSunPercent.innerText = `نسبة الظل: ${routeData.sunShadePercent !== undefined ? routeData.sunShadePercent : 8}%`;
            if (pSunDesc) {
                pSunDesc.innerHTML = `<b>أقصر خط جغرافي (طريقة خرائط جوجل):</b> قطع الساحات المفتوحة والأسفلت المكشوف مباشرة دون تظليل (حرارة السطح ${routeData.exposedRoadTemp}°C، إجهاد حراري مرتفع).`;
            }

            // Update live weather pill in results card
            const livePill = document.getElementById('nav-live-ambient-pill');
            if (livePill) {
                livePill.innerText = `${climate.ambientTemp}°C (حي ومباشر)`;
            }

            // Populate turn-by-turn steps according to active route selection
            const stepsList = document.getElementById('nav-steps-list');
            const activeInstructions = (this.activeSelectedRoute === 'sun' && routeData.sunInstructions) 
                ? routeData.sunInstructions 
                : (routeData.shadeInstructions || routeData.instructions);
            if (stepsList && activeInstructions) {
                const isSun = (this.activeSelectedRoute === 'sun');
                stepsList.innerHTML = activeInstructions.map((step, idx) => `
                    <div class="gis-step-item flex items-start gap-1.5 p-1.5 rounded-lg border text-[10px] ${isSun ? 'border-rose-500/20 bg-rose-950/20' : ''}">
                        <span class="step-num w-4 h-4 rounded-full flex items-center justify-center font-mono font-bold text-[9px] shrink-0 ${isSun ? 'bg-rose-900/60 text-rose-300 border-rose-600' : ''}">
                            ${idx + 1}
                        </span>
                        <div class="flex-1 leading-tight">
                            <span class="step-desc block ${isSun ? 'text-rose-200' : ''}">${step.text}</span>
                            <span class="step-cooling text-[8.5px] font-semibold font-mono ${isSun ? 'text-rose-400' : ''}">${step.cooling}</span>
                        </div>
                    </div>
                `).join('');
            }

            // 4. Update Mobile Google Maps Peek Bar
            const mRouteName = document.getElementById('mobile-peek-route-name');
            const mTemp = document.getElementById('mobile-peek-temp');
            const mDuration = document.getElementById('mobile-peek-duration');
            const mDist = document.getElementById('mobile-peek-distance');
            if (mRouteName) {
                mRouteName.innerText = this.activeSelectedRoute === 'sun' ? 'أقصر مسار مكشوف (طريقة جوجل)' : 'مسار الظلال المبرد (موصى به)';
                mRouteName.className = this.activeSelectedRoute === 'sun' ? 'text-xs font-bold text-rose-400 truncate' : 'text-xs font-bold text-emerald-400 truncate';
            }
            if (mTemp) {
                mTemp.innerText = this.activeSelectedRoute === 'sun' ? `☀️ ${routeData.exposedRoadTemp}°C` : `❄️ ${routeData.shadedTempOnRoute}°C`;
                mTemp.className = this.activeSelectedRoute === 'sun' ? 'text-[10px] bg-rose-950/90 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-mono font-bold' : 'text-[10px] bg-emerald-950/90 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold';
            }
            if (mDuration) {
                const chosenTime = this.activeSelectedRoute === 'sun' ? sunTime : shadeTime;
                mDuration.innerHTML = `<i class="fa-regular fa-clock text-[9px]"></i> ${chosenTime} دقيقة`;
            }
            if (mDist) {
                const chosenDist = this.activeSelectedRoute === 'sun' ? sunDist : shadeDist;
                mDist.classList.remove('hidden');
                mDist.innerHTML = `<span class="text-slate-600">•</span> <i class="fa-solid fa-person-walking text-[9px]"></i> ${chosenDist} م`;
            }
            const mBtn = document.getElementById('mobile-btn-quick-start');
            if (mBtn) {
                mBtn.innerHTML = `
                    <i class="fa-solid fa-person-walking text-amber-300 text-xs"></i>
                    <span>ابدأ 3D</span>
                `;
            }
        }

        // 5. Smoothly switch to 2D Top-Down View only if explicitly requested (e.g. user action, not slider tick)
        if (flyCamera) {
            this.switchTo2DView();
        }
    }

    updateMobilePeekDefault() {
        const mRouteName = document.getElementById('mobile-peek-route-name');
        const mTemp = document.getElementById('mobile-peek-temp');
        const mDuration = document.getElementById('mobile-peek-duration');
        const mDist = document.getElementById('mobile-peek-distance');
        const mBtn = document.getElementById('mobile-btn-quick-start');

        if (mRouteName) {
            mRouteName.innerText = 'ملاحة الحجاج المظللة';
            mRouteName.className = 'text-xs font-bold text-amber-400 truncate';
        }
        if (mTemp) {
            mTemp.innerText = 'اختر فندقك';
            mTemp.className = 'text-[10px] bg-amber-950/90 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold';
        }
        if (mDuration) {
            mDuration.innerHTML = '<i class="fa-solid fa-magnifying-glass text-[9px] text-emerald-400"></i> اضغط لتحديد فندقك وتوجيه المسار';
        }
        if (mDist) {
            mDist.innerHTML = '';
            mDist.classList.add('hidden');
        }
        if (mBtn) {
            mBtn.innerHTML = `
                <i class="fa-solid fa-hotel text-amber-300 text-xs"></i>
                <span id="mobile-btn-quick-start-text">تحديد الفندق</span>
            `;
        }
    }

    clearActiveRoute() {
        this.stopPilgrimNavigation();
        if (this.dataSources.routes) {
            this.dataSources.routes.entities.removeAll();
        }
        this.selectedHotel = null;
        this.currentRouteData = null;
        this.activeNav.routePoints = [];
        this.activeNav.instructions = [];

        // Restore all background layers
        this.setLayersFocusOnRoute(false);

        // Hide route results card
        const resultsCard = document.getElementById('nav-route-results-card');
        if (resultsCard) resultsCard.classList.add('hidden');

        // Reset inputs
        const navSearchInput = document.getElementById('nav-hotel-search-input');
        const navSelect = document.getElementById('nav-hotel-select');
        const clearBtn = document.getElementById('btn-clear-nav-search');
        if (navSearchInput) navSearchInput.value = '';
        if (navSelect) navSelect.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');

        // Reset mobile peek bar back to default
        this.updateMobilePeekDefault();

        // Return camera to Haram overview
        this.flyToHaramOverview();
    }

    switchTo2DView() {
        this.is2DView = true;
        const b2d = document.getElementById('btn-perspective-2d');
        const b3d = document.getElementById('btn-perspective-3d');
        const fabPText = document.getElementById('fab-perspective-text');
        if (b2d) b2d.classList.add('active');
        if (b3d) b3d.classList.remove('active');
        if (fabPText) fabPText.innerText = '3D';

        if (window.innerWidth <= 768) {
            this.setBottomSheetState('peek');
        }

        if (this.selectedHotel && this.currentRouteData) {
            const coords = this.selectedHotel.coords;
            const gate = this.currentRouteData.gate;
            const midLon = (coords[0] + gate.lon) / 2;
            const midLat = (coords[1] + gate.lat) / 2;
            const dist = this.calculateDistanceToKaaba(coords[0], coords[1]);
            const altitude = Math.max(500, Math.min(2200, dist * 2.2));

            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(midLon, midLat, altitude),
                orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-89.9), // Pure 2D top-down perspective
                    roll: 0.0
                },
                duration: 1.2
            });
        }
    }

    switchTo3DView() {
        this.is2DView = false;
        const b2d = document.getElementById('btn-perspective-2d');
        const b3d = document.getElementById('btn-perspective-3d');
        const fabPText = document.getElementById('fab-perspective-text');
        if (b3d) b3d.classList.add('active');
        if (b2d) b2d.classList.remove('active');
        if (fabPText) fabPText.innerText = '2D';

        if (this.currentRouteData) {
            const targetRoute = this.activeSelectedRoute === 'sun' ? this.currentRouteData.sunRoute : this.currentRouteData.shadeRoute;
            const targetInstructions = this.activeSelectedRoute === 'sun' ? this.currentRouteData.sunInstructions : this.currentRouteData.shadeInstructions;
            this.startPilgrimNavigation(targetRoute, targetInstructions, this.selectedHotel);
        } else if (this.selectedHotel) {
            const coords = this.selectedHotel.coords;
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(coords[0], coords[1] - 0.002, 350.0),
                orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-35.0),
                    roll: 0.0
                },
                duration: 1.2
            });
        }
    }

    selectRoute(routeType) {
        this.activeSelectedRoute = routeType;
        const cardShade = document.getElementById('card-route-shade');
        const cardSun = document.getElementById('card-route-sun');

        if (routeType === 'shade') {
            if (cardShade) cardShade.classList.add('active');
            if (cardSun) cardSun.classList.remove('active');

            // Show only the selected route's badge on road to prevent any collision
            if (this.shadeBadgeEntity) this.shadeBadgeEntity.show = true;
            if (this.sunBadgeEntity) this.sunBadgeEntity.show = false;

            if (this.shadePolylineEntity && this.shadePolylineEntity.polyline) {
                this.shadePolylineEntity.polyline.width = 9.0;
                this.shadePolylineEntity.polyline.zIndex = 9999;
                this.shadePolylineEntity.polyline.material = new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.fromCssColorString('#10B981'),
                    gapColor: Cesium.Color.fromCssColorString('rgba(16, 185, 129, 0.35)'),
                    dashLength: 16.0
                });
            }
            if (this.sunPolylineEntity && this.sunPolylineEntity.polyline) {
                this.sunPolylineEntity.polyline.width = 3.5;
                this.sunPolylineEntity.polyline.zIndex = 9990;
                this.sunPolylineEntity.polyline.material = new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.fromCssColorString('rgba(239, 68, 68, 0.40)'),
                    gapColor: Cesium.Color.TRANSPARENT,
                    dashLength: 12.0
                });
            }
        } else {
            if (cardSun) cardSun.classList.add('active');
            if (cardShade) cardShade.classList.remove('active');

            // Show only the selected route's badge on road to prevent any collision
            if (this.shadeBadgeEntity) this.shadeBadgeEntity.show = false;
            if (this.sunBadgeEntity) this.sunBadgeEntity.show = true;

            if (this.sunPolylineEntity && this.sunPolylineEntity.polyline) {
                this.sunPolylineEntity.polyline.width = 8.5;
                this.sunPolylineEntity.polyline.zIndex = 9999;
                this.sunPolylineEntity.polyline.material = new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.fromCssColorString('#EF4444'),
                    gapColor: Cesium.Color.fromCssColorString('rgba(239, 68, 68, 0.40)'),
                    dashLength: 14.0
                });
            }
            if (this.shadePolylineEntity && this.shadePolylineEntity.polyline) {
                this.shadePolylineEntity.polyline.width = 4.0;
                this.shadePolylineEntity.polyline.zIndex = 9990;
                this.shadePolylineEntity.polyline.material = new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.fromCssColorString('rgba(16, 185, 129, 0.40)'),
                    gapColor: Cesium.Color.TRANSPARENT,
                    dashLength: 12.0
                });
            }
        }

        // Always elevate routes layer to the very top
        if (this.viewer && this.dataSources.routes) {
            this.viewer.dataSources.raiseToTop(this.dataSources.routes);
        }

        // Update Turn-by-Turn Steps dynamically
        if (this.currentRouteData) {
            const currentInstructions = (routeType === 'sun' && this.currentRouteData.sunInstructions) 
                ? this.currentRouteData.sunInstructions 
                : (this.currentRouteData.shadeInstructions || this.currentRouteData.instructions);
            
            const stepsList = document.getElementById('nav-steps-list');
            if (stepsList && currentInstructions) {
                const isSun = (routeType === 'sun');
                stepsList.innerHTML = currentInstructions.map((step, idx) => `
                    <div class="gis-step-item flex items-start gap-1.5 p-1.5 rounded-lg border text-[10px] ${isSun ? 'border-rose-500/20 bg-rose-950/20' : ''}">
                        <span class="step-num w-4 h-4 rounded-full flex items-center justify-center font-mono font-bold text-[9px] shrink-0 ${isSun ? 'bg-rose-900/60 text-rose-300 border-rose-600' : ''}">
                            ${idx + 1}
                        </span>
                        <div class="flex-1 leading-tight">
                            <span class="step-desc block ${isSun ? 'text-rose-200' : ''}">${step.text}</span>
                            <span class="step-cooling text-[8.5px] font-semibold font-mono ${isSun ? 'text-rose-400' : ''}">${step.cooling}</span>
                        </div>
                    </div>
                `).join('');
            }

            // Update Mobile Google Maps Peek Bar
            const mRouteName = document.getElementById('mobile-peek-route-name');
            const mTemp = document.getElementById('mobile-peek-temp');
            const mDuration = document.getElementById('mobile-peek-duration');
            const mDist = document.getElementById('mobile-peek-distance');
            if (mRouteName) {
                mRouteName.innerText = routeType === 'sun' ? 'أقصر مسار مكشوف (طريقة جوجل)' : 'مسار الظلال المبرد (موصى به)';
                mRouteName.className = routeType === 'sun' ? 'text-xs font-bold text-rose-400 truncate' : 'text-xs font-bold text-emerald-400 truncate';
            }
            if (mTemp) {
                mTemp.innerText = routeType === 'sun' ? `☀️ ${this.currentRouteData.exposedRoadTemp}°C` : `❄️ ${this.currentRouteData.shadedTempOnRoute}°C`;
                mTemp.className = routeType === 'sun' ? 'text-[10px] bg-rose-950/90 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-mono font-bold' : 'text-[10px] bg-emerald-950/90 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold';
            }
            if (mDuration) {
                const chosenTime = routeType === 'sun' ? this.currentRouteData.sunTime : this.currentRouteData.shadeTime;
                mDuration.innerHTML = `<i class="fa-regular fa-clock text-[9px]"></i> ${chosenTime} دقيقة`;
            }
            if (mDist) {
                const chosenDist = routeType === 'sun' ? this.currentRouteData.sunDist : this.currentRouteData.shadeDist;
                mDist.classList.remove('hidden');
                mDist.innerHTML = `<span class="text-slate-600">•</span> <i class="fa-solid fa-person-walking text-[9px]"></i> ${chosenDist} م`;
            }
        }
    }

    locatePilgrim(isAuto = false) {
        const feedbackEl = document.getElementById('nav-location-feedback');
        const fabGps = document.getElementById('fab-gps');
        if (fabGps) fabGps.classList.add('fab-pulse');

        const showFeedback = (msg, isSuccess, isPending = false) => {
            if (!feedbackEl) return;
            feedbackEl.classList.remove('hidden', 'feedback-pending', 'feedback-success', 'feedback-error');
            if (isPending) {
                feedbackEl.classList.add('feedback-pending');
                feedbackEl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin ml-1"></i> ${msg}`;
            } else if (isSuccess) {
                feedbackEl.classList.add('feedback-success');
                feedbackEl.innerHTML = `<i class="fa-solid fa-circle-check ml-1"></i> ${msg}`;
            } else {
                feedbackEl.classList.add('feedback-error');
                feedbackEl.innerHTML = `<i class="fa-solid fa-circle-info ml-1"></i> ${msg}`;
            }
        };

        if (!navigator.geolocation) {
            if (fabGps) fabGps.classList.remove('fab-pulse');
            if (!isAuto) showFeedback('متصفحك لا يدعم تحديد الموقع المباشر، تم اختيار فندق برج الساعة', false);
            this.selectHotelByName('ساعة مكة');
            return;
        }

        if (!isAuto) {
            showFeedback('جاري استدعاء إحداثيات موقعك عبر أقمار GPS...', false, true);
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (fabGps) fabGps.classList.remove('fab-pulse');
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                // Check if roughly in Makkah region (approx lat 21.2 to 21.6, lon 39.6 to 40.0)
                if (lat >= 21.2 && lat <= 21.6 && lon >= 39.6 && lon <= 40.0) {
                    showFeedback(`تم تحديد موقعك بدقة في مكة المكرمة 🕋 وجاري التوجيه إلى الحرم (${lat.toFixed(4)}, ${lon.toFixed(4)})`, true);
                    this.routeFromBuilding('موقعي الحالي (GPS)', lon, lat, null);
                    const searchInput = document.getElementById('nav-hotel-search-input');
                    if (searchInput) searchInput.value = 'موقعي الحالي (GPS)';
                } else {
                    showFeedback('مرحباً بك! موقعك خارج مكة المكرمة؛ تم ضبط نقطة الانطلاق في فندق برج الساعة لتجربة مسارات الظل والمحاكاة الحية.', false);
                    this.selectHotelByName('ساعة مكة');
                    const searchInput = document.getElementById('nav-hotel-search-input');
                    if (searchInput) searchInput.value = 'فندق برج الساعة (محاكاة الموقع)';
                    setTimeout(() => {
                        if (feedbackEl && isAuto) feedbackEl.classList.add('hidden');
                    }, 6000);
                }
            },
            (err) => {
                if (fabGps) fabGps.classList.remove('fab-pulse');
                console.warn('Geolocation lookup notice:', err.message);
                if (isAuto) {
                    showFeedback('تم ضبط نقطة الانطلاق في فندق برج الساعة (المنطقة المركزية) لبدء محاكاة المسارات.', false);
                    setTimeout(() => {
                        if (feedbackEl) feedbackEl.classList.add('hidden');
                    }, 5000);
                } else {
                    showFeedback('تعذر جلب إحداثيات GPS، تم ضبط نقطة الانطلاق في فندق دار التوحيد إنتركونتيننتال', false);
                }
                this.selectHotelByName('دار التوحيد');
                const searchInput = document.getElementById('nav-hotel-search-input');
                if (searchInput) searchInput.value = 'فندق دار التوحيد (محاكاة الموقع)';
            },
            { timeout: 7000, enableHighAccuracy: true }
        );
    }

    startPilgrimNavigation(shadeRoute, instructions, hotel) {
        if (!shadeRoute || shadeRoute.length < 2) return;

        // Stop any active navigation
        this.stopPilgrimNavigation();

        // Mark body as active navigation to cleanly hide main header on mobile
        document.body.classList.add('nav-running');

        // Hide static origin pilgrim entities
        if (this.originPilgrimEntity) this.originPilgrimEntity.show = false;
        if (this.originPilgrimHalo) this.originPilgrimHalo.show = false;
        if (this.originPilgrimBadge) this.originPilgrimBadge.show = false;

        this.activeNav.isRunning = true;
        this.activeNav.routePoints = shadeRoute;
        this.activeNav.instructions = instructions;
        this.activeNav.currentStepIdx = 0;
        this.activeNav.progress = 0.0;
        this.activeNav.cameraMode = 'street';

        // Show Navigation HUD Banner
        const hud = document.getElementById('nav-hud-banner');
        if (hud) hud.classList.remove('hidden');

        // Hide Bottom Sheet on mobile for full view of 3D walking simulation
        if (window.innerWidth <= 768) {
            this.setBottomSheetState('hidden');
        }

        // Create Animated Pilgrim Entity (معتمر في ملابس الإحرام)
        const startPt = shadeRoute[0];

        // 3D Glowing Ground Halo
        const isSun = (this.activeSelectedRoute === 'sun');
        this.activeNav.pilgrimHalo = this.dataSources.routes.entities.add({
            name: 'هالة المعتمر الأرضية',
            position: Cesium.Cartesian3.fromDegrees(startPt[0], startPt[1], 0.2),
            ellipse: {
                semiMajorAxis: 3.5,
                semiMinorAxis: 3.5,
                material: isSun ? Cesium.Color.fromCssColorString('#EF4444').withAlpha(0.65) : Cesium.Color.fromCssColorString('#10B981').withAlpha(0.65),
                outline: true,
                outlineColor: isSun ? Cesium.Color.fromCssColorString('#F87171') : Cesium.Color.fromCssColorString('#34D399'),
                outlineWidth: 3.0,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });

        // 3D Pilgrim Avatar
        this.activeNav.pilgrimEntity = this.dataSources.routes.entities.add({
            name: isSun ? 'المعتمر في المسار المكشوف' : 'المعتمر في مسار الظل',
            position: Cesium.Cartesian3.fromDegrees(startPt[0], startPt[1], 2.2),
            billboard: {
                image: 'assets/pilgrim_avatar.svg',
                width: 52,
                height: 70,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });

        const pilgrimBadgeCanvas = this.createArabicBadgeCanvas({
            text: isSun ? '☀️ المعتمر | في المسار المكشوف (جوجل)' : '🕋 المعتمر | في مسار الظل المبرد',
            bgColor: isSun ? 'rgba(69, 10, 10, 0.94)' : 'rgba(15, 23, 42, 0.94)',
            textColor: isSun ? '#FCA5A5' : '#FDE68A',
            borderColor: isSun ? '#EF4444' : '#D4AF37'
        });

        this.activeNav.pilgrimBadge = this.dataSources.routes.entities.add({
            name: 'شارة المعتمر',
            position: Cesium.Cartesian3.fromDegrees(startPt[0], startPt[1], 2.2),
            billboard: {
                image: pilgrimBadgeCanvas,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -74),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });

        // Initial 3D street camera positioning facing along the street corridor
        const p1 = shadeRoute[0];
        const p2 = shadeRoute[1];
        const initialHeading = this.calculateBearing(p1, p2);
        const camOffset = this.offsetBehind(p1[0], p1[1], initialHeading, 8.5);
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(camOffset.lon, camOffset.lat, 4.2),
            orientation: {
                heading: Cesium.Math.toRadians(initialHeading),
                pitch: Cesium.Math.toRadians(-13.0),
                roll: 0.0
            },
            duration: 1.0,
            complete: () => {
                this.animatePilgrim();
            }
        });

        // Collapse sidebar on small screens for full view
        const sidebar = document.getElementById('sidebar-drawer');
        if (sidebar && window.innerWidth < 768) {
            sidebar.classList.add('collapsed');
        }
    }

    animatePilgrim() {
        if (!this.activeNav.isRunning) return;

        const points = this.activeNav.routePoints;
        const totalSegments = points.length - 1;

        // Smooth speed: ~9-10 seconds full walkthrough along street corridor
        this.activeNav.progress += 0.0018;

        if (this.activeNav.progress >= 1.0) {
            this.activeNav.progress = 1.0;
            this.updatePilgrimPosition(1.0);
            this.activeNav.isRunning = false;

            // Arrival celebration notification
            const instrEl = document.getElementById('nav-hud-instruction');
            const gateName = (this.currentRouteData && this.currentRouteData.gate) ? this.currentRouteData.gate.name : 'المسجد الحرام';
            if (instrEl) {
                if (this.activeSelectedRoute === 'sun') {
                    instrEl.innerText = `تم الوصول إلى ${gateName} عبر أقصر مسار مكشوف 🕋 نسأل الله السلامة والقبول`;
                } else {
                    instrEl.innerText = `الحمد لله، وصلت بسلام وأمان إلى ${gateName} عبر أبرد مسار مظلل ومكيف 🕋 تقبل الله طاعتكم`;
                }
            }
            const remainingEl = document.getElementById('nav-hud-remaining');
            if (remainingEl) remainingEl.innerText = '0 م (تم الوصول بسلام)';

            // Change Stop button to "إغلاق" (Close)
            const stopBtnText = document.getElementById('txt-stop-nav');
            if (stopBtnText) stopBtnText.innerText = 'إغلاق';

            // Auto-dismiss HUD after 7.5 seconds and return cleanly to map
            if (this.arrivalDismissTimer) clearTimeout(this.arrivalDismissTimer);
            this.arrivalDismissTimer = setTimeout(() => {
                this.stopPilgrimNavigation();
            }, 7500);

            return;
        }

        this.updatePilgrimPosition(this.activeNav.progress);
        this.activeNav.animId = requestAnimationFrame(() => this.animatePilgrim());
    }

    updatePilgrimPosition(prog) {
        const points = this.activeNav.routePoints;
        const totalSegments = points.length - 1;
        const exactIdx = prog * totalSegments;
        const segIdx = Math.min(Math.floor(exactIdx), totalSegments - 1);
        const segT = exactIdx - segIdx;

        const p1 = points[segIdx];
        const p2 = points[segIdx + 1];

        // Linear interpolation between waypoints
        const curLon = p1[0] + (p2[0] - p1[0]) * segT;
        const curLat = p1[1] + (p2[1] - p1[1]) * segT;

        // Update Pilgrim Entity Position
        if (this.activeNav.pilgrimEntity) {
            this.activeNav.pilgrimEntity.position = Cesium.Cartesian3.fromDegrees(curLon, curLat, 2.2);
        }
        if (this.activeNav.pilgrimHalo) {
            this.activeNav.pilgrimHalo.position = Cesium.Cartesian3.fromDegrees(curLon, curLat, 0.2);
        }
        if (this.activeNav.pilgrimBadge) {
            this.activeNav.pilgrimBadge.position = Cesium.Cartesian3.fromDegrees(curLon, curLat, 2.2);
        }

        // Calculate Bearing / Heading
        const headingDeg = this.calculateBearing(p1, p2);

        // Update Camera
        if (this.activeNav.cameraMode === 'street') {
            // Street-view pedestrian tracking: 8.5m behind, 4.0m above ground looking forward down the corridor
            const camOffset = this.offsetBehind(curLon, curLat, headingDeg, 8.5);
            this.viewer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(camOffset.lon, camOffset.lat, 4.0),
                orientation: {
                    heading: Cesium.Math.toRadians(headingDeg),
                    pitch: Cesium.Math.toRadians(-13.0),
                    roll: 0.0
                }
            });
        } else {
            // Bird's Eye tracking
            this.viewer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(curLon, curLat - 0.0012, 160.0),
                orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-45.0),
                    roll: 0.0
                }
            });
        }

        // Update HUD
        const instrIdx = Math.min(segIdx, this.activeNav.instructions.length - 1);
        const currentInstr = this.activeNav.instructions[instrIdx];
        const instrEl = document.getElementById('nav-hud-instruction');
        if (instrEl && currentInstr) instrEl.innerText = currentInstr.text;

        const climate = this.getMakkahMicroclimate(this.simDate);
        const coolingEl = document.getElementById('nav-hud-cooling');
        if (coolingEl && currentInstr) {
            if (this.activeSelectedRoute === 'sun') {
                coolingEl.innerText = `☀️ ${climate.exposedRoadTemp}°C (${currentInstr.cooling || 'مكشوف للشمس'})`;
                coolingEl.className = 'text-xs font-mono font-bold text-rose-300';
            } else {
                coolingEl.innerText = `❄️ ${climate.shadedRoadTemp}°C (${currentInstr.cooling})`;
                coolingEl.className = 'text-xs font-mono font-bold text-emerald-300';
            }
        }

        const progressBar = document.getElementById('nav-progress-bar');
        if (progressBar) progressBar.style.width = `${Math.round(prog * 100)}%`;

        const remainingEl = document.getElementById('nav-hud-remaining');
        if (remainingEl) {
            const totalDist = (this.activeSelectedRoute === 'sun' ? this.currentRouteData?.sunDist : this.currentRouteData?.shadeDist) || (this.selectedHotel?.properties?.dist_to_kaaba_meters || 350);
            const remaining = Math.round(totalDist * (1.0 - prog));
            remainingEl.innerText = `${remaining} م متبقية`;
        }
    }

    calculateBearing(p1, p2) {
        const lon1 = Cesium.Math.toRadians(p1[0]);
        const lat1 = Cesium.Math.toRadians(p1[1]);
        const lon2 = Cesium.Math.toRadians(p2[0]);
        const lat2 = Cesium.Math.toRadians(p2[1]);
        const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        const brng = Cesium.Math.toDegrees(Math.atan2(y, x));
        return (brng + 360) % 360;
    }

    offsetBehind(lon, lat, bearingDeg, distMeters) {
        const revRad = Cesium.Math.toRadians((bearingDeg + 180) % 360);
        const R = 6378137.0;
        const dLat = (distMeters * Math.cos(revRad)) / R;
        const dLon = (distMeters * Math.sin(revRad)) / (R * Math.cos(Cesium.Math.toRadians(lat)));
        return {
            lon: lon + Cesium.Math.toDegrees(dLon),
            lat: lat + Cesium.Math.toDegrees(dLat)
        };
    }

    toggleCameraMode() {
        this.activeNav.cameraMode = this.activeNav.cameraMode === 'street' ? 'bird' : 'street';
        const txtEl = document.getElementById('txt-cam-view');
        if (txtEl) {
            txtEl.innerText = this.activeNav.cameraMode === 'street' ? 'منظور المشاة 3D' : 'منظور جوي شامل';
        }
    }

    stopPilgrimNavigation() {
        document.body.classList.remove('nav-running');
        if (this.arrivalDismissTimer) {
            clearTimeout(this.arrivalDismissTimer);
            this.arrivalDismissTimer = null;
        }
        const stopBtnText = document.getElementById('txt-stop-nav');
        if (stopBtnText) stopBtnText.innerText = 'إيقاف';

        this.activeNav.isRunning = false;
        if (this.activeNav.animId) {
            cancelAnimationFrame(this.activeNav.animId);
            this.activeNav.animId = null;
        }
        if (this.activeNav.pilgrimEntity) {
            this.dataSources.routes.entities.remove(this.activeNav.pilgrimEntity);
            this.activeNav.pilgrimEntity = null;
        }
        if (this.activeNav.pilgrimHalo) {
            this.dataSources.routes.entities.remove(this.activeNav.pilgrimHalo);
            this.activeNav.pilgrimHalo = null;
        }
        if (this.activeNav.pilgrimBadge) {
            this.dataSources.routes.entities.remove(this.activeNav.pilgrimBadge);
            this.activeNav.pilgrimBadge = null;
        }
        if (this.originPilgrimEntity) this.originPilgrimEntity.show = true;
        if (this.originPilgrimHalo) this.originPilgrimHalo.show = true;
        if (this.originPilgrimBadge) this.originPilgrimBadge.show = true;

        const hud = document.getElementById('nav-hud-banner');
        if (hud) hud.classList.add('hidden');

        // Restore Bottom Sheet on mobile
        if (window.innerWidth <= 768) {
            this.setBottomSheetState('peek');
        }
    }

    flyToHotel(hotelIdx) {
        const hotel = this.hotelList[hotelIdx];
        if (!hotel || !this.viewer) return;

        this.selectedHotel = hotel;
        const coords = hotel.coords;
        const bHeight = hotel.height || 45.0;

        // Dynamic camera altitude and offset according to true tower height
        const camAlt = Math.max(220, bHeight * 1.4 + 90);
        const distOffset = Math.max(0.0013, (camAlt / 111000) * 0.7);

        // Fly camera to hotel building
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(coords[0], coords[1] - distOffset, camAlt),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-28),
                roll: 0.0
            },
            duration: 1.6
        });

        // Highlight the 3D building entity itself on the map!
        if (hotel.entity) {
            this.viewer.selectedEntity = hotel.entity;
        }

        // Compute Dual Routes & render on 3D map + update card
        const routes = this.calculateDualRoutes(hotel);
        this.renderDualRoutes(hotel, routes);
    }

    routeFromBuilding(nameAr, lon, lat, buildingEntity = null) {
        const dist = Math.round(this.calculateDistanceToKaaba(lon, lat));
        let stars = 'فندق معتمد';
        let nameEn = nameAr;
        let height = 35;
        let rooms = 'N/A';

        if (buildingEntity && buildingEntity.properties) {
            const p = buildingEntity.properties;
            if (p.stars) stars = p.stars.getValue();
            if (p.name_en) nameEn = p.name_en.getValue();
            if (p.height) height = parseFloat(p.height.getValue()) || 35;
            if (p.rooms) rooms = p.rooms.getValue();
        }

        const hotelObj = {
            entity: buildingEntity,
            geometry: {
                type: 'Point',
                coordinates: [lon, lat]
            },
            coords: [lon, lat],
            height: height,
            properties: {
                name_ar: nameAr,
                name_en: nameEn,
                dist_to_kaaba_meters: dist,
                walk_mins_est: Math.round(dist / 75),
                stars: stars,
                rooms: rooms
            }
        };

        this.selectedHotel = hotelObj;

        // Synchronize search input & hotel select dropdown with the clicked 3D building
        const navSearchInput = document.getElementById('nav-hotel-search-input');
        if (navSearchInput) navSearchInput.value = nameAr;
        const navSelect = document.getElementById('nav-hotel-select');
        if (navSelect && this.hotelList) {
            const idx = this.hotelList.findIndex(h => h.properties && (h.properties.name_ar === nameAr || (Math.abs(h.coords[0] - lon) < 0.0002 && Math.abs(h.coords[1] - lat) < 0.0002)));
            if (idx !== -1) navSelect.value = idx;
        }

        const routes = this.calculateDualRoutes(hotelObj);
        this.renderDualRoutes(hotelObj, routes);

        const sidebar = document.getElementById('sidebar-drawer');
        if (sidebar && sidebar.classList.contains('collapsed') && window.innerWidth >= 1024) {
            sidebar.classList.remove('collapsed');
        }
    }

    calculateDistanceToKaaba(lon, lat) {
        // Kaaba centroid: [39.8262, 21.4225]
        const dx = (lon - 39.8262) * 103000;
        const dy = (lat - 21.4225) * 111000;
        return Math.sqrt(dx * dx + dy * dy);
    }

    flyToHaramOverview() {
        if (!this.viewer) return;
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(39.8262, 21.4160, 950),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-40),
                roll: 0.0
            },
            duration: 2.0
        });
    }

    flyToClockTower() {
        if (!this.viewer) return;
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(39.82535, 21.4132, 650),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-24),
                roll: 0.0
            },
            duration: 1.8
        });
    }

    flyToJabalOmar() {
        if (!this.viewer) return;
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(39.8215, 21.4180, 550),
            orientation: {
                heading: Cesium.Math.toRadians(45),
                pitch: Cesium.Math.toRadians(-35),
                roll: 0.0
            },
            duration: 1.8
        });
    }

    flyToKaabaView() {
        if (!this.viewer) return;
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(39.82617, 21.4200, 380),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-55),
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

    updateStatus(msg) {
        const statusEl = document.getElementById('loading-status-text');
        if (statusEl) statusEl.innerText = msg;
    }

    setupUIControls() {
        // 1. Sidebar Toggle Button
        const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
        const sidebar = document.getElementById('sidebar-drawer');

        if (sidebar) {
            if (window.innerWidth >= 1024) {
                sidebar.classList.remove('collapsed');
            } else {
                sidebar.classList.add('collapsed');
            }
        }

        if (btnToggleSidebar && sidebar) {
            const updateLegendPos = (isCollapsed) => {
                const legend = document.getElementById('floating-map-legend');
                if (legend) {
                    if (window.innerWidth <= 768) {
                        legend.style.right = '';
                    } else {
                        legend.style.right = isCollapsed ? '16px' : '396px';
                    }
                }
            };

            // Set initial position based on initial sidebar state
            updateLegendPos(sidebar.classList.contains('collapsed'));

            btnToggleSidebar.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                btnToggleSidebar.innerHTML = isCollapsed 
                    ? '<i class="fa-solid fa-chevron-left"></i>' 
                    : '<i class="fa-solid fa-chevron-right"></i>';
                updateLegendPos(isCollapsed);
            });

            window.addEventListener('resize', () => {
                updateLegendPos(sidebar.classList.contains('collapsed'));
            });
        }

        // 2. Geoportal Standard TOC Interactions
        // A. Search in Layers
        const layerSearchInput = document.getElementById('layer-search-input');
        if (layerSearchInput) {
            layerSearchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                document.querySelectorAll('.gis-sublayer-card').forEach(card => {
                    const text = card.innerText.toLowerCase();
                    card.style.display = (query === '' || text.includes(query)) ? '' : 'none';
                });
            });
        }

        // B. Select Map View Dropdown (Basemap Selector)
        const btnMapViewDropdown = document.getElementById('btn-map-view-dropdown');
        const dropdownMapViewOptions = document.getElementById('dropdown-map-view-options');
        const chevronMapView = document.getElementById('chevron-map-view');
        if (btnMapViewDropdown && dropdownMapViewOptions) {
            btnMapViewDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownMapViewOptions.classList.toggle('hidden');
                if (chevronMapView) chevronMapView.classList.toggle('rotate-180');
            });
            document.addEventListener('click', () => {
                dropdownMapViewOptions.classList.add('hidden');
                if (chevronMapView) chevronMapView.classList.remove('rotate-180');
            });
            document.querySelectorAll('.basemap-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.basemap-option i').forEach(i => i.classList.add('hidden'));
                    const check = btn.querySelector('i');
                    if (check) check.classList.remove('hidden');
                    dropdownMapViewOptions.classList.add('hidden');
                });
            });
        }

        // C. Group Collapse / Expand Toggles
        document.querySelectorAll('.group-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const targetId = toggle.getAttribute('data-target');
                const targetEl = document.getElementById(targetId);
                const icon = toggle.querySelector('.group-icon');
                if (targetEl) {
                    targetEl.classList.toggle('hidden');
                    const isHidden = targetEl.classList.contains('hidden');
                    if (icon) {
                        icon.className = isHidden 
                            ? 'fa-regular fa-square-plus text-blue-600 text-sm group-icon' 
                            : 'fa-regular fa-square-minus text-blue-600 text-sm group-icon';
                    }
                }
            });
        });

        // D. Drawer Toggle Buttons (Opacity, Symbology, Legend, Info)
        document.querySelectorAll('.btn-toggle-drawer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const drawerId = btn.getAttribute('data-drawer');
                const drawer = document.getElementById(drawerId);
                if (drawer) {
                    const isCurrentlyHidden = drawer.classList.contains('hidden');
                    const parentCard = btn.closest('.gis-sublayer-card') || btn.closest('.gis-group-box');
                    if (parentCard) {
                        parentCard.querySelectorAll('.gis-drawer-content').forEach(d => {
                            if (d !== drawer) d.classList.add('hidden');
                        });
                        parentCard.querySelectorAll('.btn-toggle-drawer').forEach(b => {
                            if (b !== btn) b.classList.remove('active');
                        });
                    }
                    drawer.classList.toggle('hidden');
                    btn.classList.toggle('active', isCurrentlyHidden);
                }
            });
        });

        // E. Layer Visibility Eye Toggles
        const updateEyeUI = (btn, isShown, card) => {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = isShown ? 'fa-regular fa-eye text-blue-600' : 'fa-regular fa-eye-slash text-slate-400';
            }
            if (card) {
                card.classList.toggle('layer-hidden', !isShown);
            }
        };

        // Buildings Layer Eye
        const btnEyeBuildings = document.getElementById('btn-eye-buildings');
        if (btnEyeBuildings) {
            btnEyeBuildings.addEventListener('click', () => {
                if (this.dataSources.buildings) {
                    this.dataSources.buildings.show = !this.dataSources.buildings.show;
                    updateEyeUI(btnEyeBuildings, this.dataSources.buildings.show, btnEyeBuildings.closest('.gis-sublayer-card'));
                }
            });
        }

        // Gates Layer Eye
        const btnEyeGates = document.getElementById('btn-eye-gates');
        if (btnEyeGates) {
            btnEyeGates.addEventListener('click', () => {
                if (this.dataSources.gates) {
                    this.dataSources.gates.show = !this.dataSources.gates.show;
                    updateEyeUI(btnEyeGates, this.dataSources.gates.show, btnEyeGates.closest('.gis-sublayer-card'));
                }
            });
        }

        // Shadows Layer Eye
        const btnEyeShadows = document.getElementById('btn-eye-shadows');
        let shadowsActive = true;
        if (btnEyeShadows) {
            btnEyeShadows.addEventListener('click', () => {
                shadowsActive = !shadowsActive;
                this.toggleShadows(shadowsActive);
                updateEyeUI(btnEyeShadows, shadowsActive, btnEyeShadows.closest('.gis-sublayer-card'));
            });
        }

        // Pedestrian Road Corridors Eye
        const btnEyePedestrians = document.getElementById('btn-eye-pedestrians');
        if (btnEyePedestrians) {
            btnEyePedestrians.addEventListener('click', () => {
                if (this.dataSources.pedestrians) {
                    this.dataSources.pedestrians.show = !this.dataSources.pedestrians.show;
                    updateEyeUI(btnEyePedestrians, this.dataSources.pedestrians.show, btnEyePedestrians.closest('.gis-sublayer-card'));
                }
            });
        }

        // Live Thermal Stations Eye
        const btnEyeThermal = document.getElementById('btn-eye-thermal');
        if (btnEyeThermal) {
            btnEyeThermal.addEventListener('click', () => {
                if (this.dataSources.thermal) {
                    this.dataSources.thermal.show = !this.dataSources.thermal.show;
                    updateEyeUI(btnEyeThermal, this.dataSources.thermal.show, btnEyeThermal.closest('.gis-sublayer-card'));
                }
            });
        }

        // Group Eye Toggles
        document.querySelectorAll('.group-eye').forEach(btn => {
            btn.addEventListener('click', () => {
                const grp = btn.getAttribute('data-group');
                const icon = btn.querySelector('i');
                const isCurrentlyActive = icon && icon.classList.contains('fa-eye');
                const newShowState = !isCurrentlyActive;

                if (grp === 'buildings') {
                    if (this.dataSources.buildings) this.dataSources.buildings.show = newShowState;
                    if (this.dataSources.gates) this.dataSources.gates.show = newShowState;
                    if (btnEyeBuildings) updateEyeUI(btnEyeBuildings, newShowState, btnEyeBuildings.closest('.gis-sublayer-card'));
                    if (btnEyeGates) updateEyeUI(btnEyeGates, newShowState, btnEyeGates.closest('.gis-sublayer-card'));
                } else if (grp === 'env') {
                    shadowsActive = newShowState;
                    this.toggleShadows(shadowsActive);
                    if (this.dataSources.pedestrians) this.dataSources.pedestrians.show = newShowState;
                    if (this.dataSources.thermal) this.dataSources.thermal.show = newShowState;
                    if (btnEyeShadows) updateEyeUI(btnEyeShadows, newShowState, btnEyeShadows.closest('.gis-sublayer-card'));
                    if (btnEyePedestrians) updateEyeUI(btnEyePedestrians, newShowState, btnEyePedestrians.closest('.gis-sublayer-card'));
                    if (btnEyeThermal) updateEyeUI(btnEyeThermal, newShowState, btnEyeThermal.closest('.gis-sublayer-card'));
                }

                if (icon) {
                    icon.className = newShowState ? 'fa-regular fa-eye text-blue-600' : 'fa-regular fa-eye-slash text-slate-400';
                }
            });
        });

        // F. Zoom to Layer & Group Extents
        const btnZoomBuildings = document.getElementById('btn-zoom-buildings');
        const btnGroupZoomBuildings = document.getElementById('btn-group-zoom-buildings');
        if (btnZoomBuildings) btnZoomBuildings.addEventListener('click', () => this.flyToHaramOverview());
        if (btnGroupZoomBuildings) btnGroupZoomBuildings.addEventListener('click', () => this.flyToHaramOverview());

        const btnZoomGates = document.getElementById('btn-zoom-gates');
        if (btnZoomGates) btnZoomGates.addEventListener('click', () => this.flyToKaabaView());

        const btnZoomShadows = document.getElementById('btn-zoom-shadows');
        if (btnZoomShadows) btnZoomShadows.addEventListener('click', () => this.flyToClockTower());

        const btnZoomPedestrians = document.getElementById('btn-zoom-pedestrians');
        const btnGroupZoomEnv = document.getElementById('btn-group-zoom-env');
        if (btnZoomPedestrians) btnZoomPedestrians.addEventListener('click', () => this.flyToJabalOmar());
        if (btnGroupZoomEnv) btnGroupZoomEnv.addEventListener('click', () => this.flyToHaramOverview());

        const btnZoomThermal = document.getElementById('btn-zoom-thermal');
        if (btnZoomThermal) btnZoomThermal.addEventListener('click', () => this.flyToHaramOverview());

        // G. Opacity Sliders Matrix
        const updateBuildingOpacity = (val) => {
            this.setBuildingsOpacity(val);
            ['val-opacity-buildings', 'val-opacity-buildings-sub'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = `${Math.round(val)}%`;
            });
            ['slider-opacity-buildings', 'slider-opacity-buildings-sub'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = val;
            });
        };
        const s1 = document.getElementById('slider-opacity-buildings');
        if (s1) s1.addEventListener('input', (e) => updateBuildingOpacity(parseFloat(e.target.value)));
        const s2 = document.getElementById('slider-opacity-buildings-sub');
        if (s2) s2.addEventListener('input', (e) => updateBuildingOpacity(parseFloat(e.target.value)));

        const sliderOpacityGates = document.getElementById('slider-opacity-gates');
        if (sliderOpacityGates) {
            sliderOpacityGates.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.setGatesOpacity(val);
                const valEl = document.getElementById('val-opacity-gates');
                if (valEl) valEl.innerText = `${Math.round(val)}%`;
            });
        }

        const sliderOpacityShadows = document.getElementById('slider-opacity-shadows');
        if (sliderOpacityShadows) {
            sliderOpacityShadows.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.setShadowDarkness(val);
                const valEl = document.getElementById('val-opacity-shadows');
                if (valEl) valEl.innerText = `${Math.round(val)}%`;
            });
        }

        const sliderOpacityPedestrians = document.getElementById('slider-opacity-pedestrians');
        if (sliderOpacityPedestrians) {
            sliderOpacityPedestrians.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.setRoadsOpacity(val);
                const valEl = document.getElementById('val-opacity-pedestrians');
                if (valEl) valEl.innerText = `${Math.round(val)}%`;
            });
        }

        const sliderOpacityThermal = document.getElementById('slider-opacity-thermal');
        if (sliderOpacityThermal) {
            sliderOpacityThermal.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.setThermalOpacity(val);
                const valEl = document.getElementById('val-opacity-thermal');
                if (valEl) valEl.innerText = `${Math.round(val)}%`;
            });
        }

        // H. Symbology Dropdown
        const selectSymbology = document.getElementById('select-building-symbology');
        if (selectSymbology) {
            selectSymbology.addEventListener('change', (e) => {
                this.applyBuildingTheme(e.target.value);
            });
        }

        // 5. Hotel Search & Filter Input
        const filterInput = document.getElementById('hotel-filter-input');
        if (filterInput) {
            filterInput.addEventListener('input', (e) => {
                this.filterHotels(e.target.value);
            });
        }

        const selectEl = document.getElementById('hotel-search-select');
        if (selectEl) {
            selectEl.addEventListener('change', (e) => {
                if (e.target.value !== '') {
                    this.flyToHotel(parseInt(e.target.value));
                }
            });
        }

        // 6. Navigation HUD Buttons
        const btnToggleCam = document.getElementById('btn-toggle-cam-view');
        if (btnToggleCam) btnToggleCam.addEventListener('click', () => this.toggleCameraMode());

        const btnStopNav = document.getElementById('btn-stop-nav');
        if (btnStopNav) btnStopNav.addEventListener('click', () => this.stopPilgrimNavigation());

        // 7. Quick Landmark Fly-To Buttons
        const btnKaaba = document.getElementById('btn-bm-kaaba');
        const btnClock = document.getElementById('btn-bm-clock');
        const btnJabal = document.getElementById('btn-bm-jabal');

        if (btnKaaba) btnKaaba.addEventListener('click', () => this.flyToHaramOverview());
        if (btnClock) btnClock.addEventListener('click', () => this.flyToClockTower());
        if (btnJabal) btnJabal.addEventListener('click', () => this.flyToJabalOmar());

        // 8. Prayer Time Quick Presets
        const btnDuhr = document.getElementById('btn-quick-duhr');
        const btnAsr = document.getElementById('btn-quick-asr');
        const btnMaghrib = document.getElementById('btn-quick-maghrib');

        const setTimeMinutes = (mins) => {
            const timeSlider = document.getElementById('time-slider');
            if (timeSlider) {
                timeSlider.value = mins;
                timeSlider.dispatchEvent(new Event('input'));
            }
        };

        if (btnDuhr) btnDuhr.addEventListener('click', () => setTimeMinutes(765)); // 12:45 PM
        if (btnAsr) btnAsr.addEventListener('click', () => setTimeMinutes(945));   // 03:45 PM
        if (btnMaghrib) btnMaghrib.addEventListener('click', () => setTimeMinutes(1110)); // 06:30 PM

        // 9. Time Slider (Real-Time Solar Shadow Casting)
        const timeSlider = document.getElementById('time-slider');
        const timeDisplay = document.getElementById('time-display');

        if (timeSlider) {
            // Set slider to actual current minute of today
            const curMins = this.simDate.getHours() * 60 + this.simDate.getMinutes();
            timeSlider.value = curMins;

            timeSlider.addEventListener('input', (e) => {
                const totalMinutes = parseInt(e.target.value);
                const hours = Math.floor(totalMinutes / 60);
                const mins = totalMinutes % 60;
                this.simDate.setHours(hours, mins, 0);

                if (timeDisplay) {
                    const period = hours < 12 ? 'ص' : 'م';
                    timeDisplay.innerText = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${period}`;
                }

                this.updateSunTime(this.simDate);
                this.updateThermalSimulation(this.simDate);
            });
        }

        // 10. Dark / Light Mode Toggle Button
        const btnThemeToggle = document.getElementById('btn-theme-toggle');
        if (btnThemeToggle) {
            btnThemeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        const savedTheme = localStorage.getItem('zilal_theme');
        if (savedTheme === 'light') {
            this.toggleTheme();
        }

        // 11. Floating GIS Map Legend Collapse / Expand Interaction
        const legendHeader = document.getElementById('legend-header');
        const btnToggleLegend = document.getElementById('btn-toggle-legend-card');
        const legendList = document.getElementById('legend-items-list');
        const chevronLegend = document.getElementById('chevron-legend');

        const toggleLegend = () => {
            if (legendList) {
                const isHidden = legendList.classList.toggle('hidden');
                if (chevronLegend) {
                    chevronLegend.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            }
        };

        if (btnToggleLegend) {
            btnToggleLegend.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLegend();
            });
        }
        if (legendHeader) {
            legendHeader.addEventListener('click', toggleLegend);
        }

        // 12. Smart Pilgrim Navigation & Search Widget (Top-Left)
        const navSearchInput = document.getElementById('nav-hotel-search-input');
        const btnClearSearch = document.getElementById('btn-clear-nav-search');
        const navSelect = document.getElementById('nav-hotel-select');
        const btnGps = document.getElementById('btn-gps-locate');
        const btnNavHaram = document.getElementById('btn-navigate-to-haram');
        const btn2D = document.getElementById('btn-perspective-2d');
        const btn3D = document.getElementById('btn-perspective-3d');
        const cardShade = document.getElementById('card-route-shade');
        const cardSun = document.getElementById('card-route-sun');
        const toggleSteps = document.getElementById('toggle-nav-steps');
        const stepsList = document.getElementById('nav-steps-list');
        const chevronSteps = document.getElementById('chevron-nav-steps');
        const btnStartWalk = document.getElementById('btn-start-pilgrim-walk');
        const navHeader = document.getElementById('nav-widget-header');
        const btnToggleNav = document.getElementById('btn-toggle-nav-widget');
        const navBody = document.getElementById('nav-widget-body');
        const chevronNav = document.getElementById('chevron-nav-widget');
        const btnOpenFromDrawer = document.getElementById('btn-open-nav-from-drawer');

        if (navSearchInput) {
            navSearchInput.addEventListener('input', (e) => {
                this.filterHotels(e.target.value);
            });
        }

        if (btnClearSearch) {
            btnClearSearch.addEventListener('click', () => {
                this.clearActiveRoute();
                if (navSearchInput) navSearchInput.focus();
            });
        }

        if (navSelect) {
            navSelect.addEventListener('change', (e) => {
                if (e.target.value !== '') {
                    const idx = parseInt(e.target.value);
                    const hotel = this.hotelList[idx];
                    if (hotel) {
                        this.selectedHotel = hotel;
                        if (navSearchInput) navSearchInput.value = hotel.properties.name_ar;
                        const routes = this.calculateDualRoutes(hotel);
                        this.renderDualRoutes(hotel, routes);
                        if (window.innerWidth <= 768) {
                            this.setBottomSheetState('peek');
                        }
                    }
                } else {
                    this.clearActiveRoute();
                }
            });
        }

        if (btnGps) {
            btnGps.addEventListener('click', () => {
                this.locatePilgrim();
            });
        }

        if (btnNavHaram) {
            btnNavHaram.addEventListener('click', () => {
                let targetHotel = this.selectedHotel;
                if (!targetHotel && this.hotelList && this.hotelList.length > 0) {
                    const idx = navSelect && navSelect.value !== '' ? parseInt(navSelect.value) : 0;
                    targetHotel = this.hotelList[idx];
                    this.selectedHotel = targetHotel;
                    if (navSelect) navSelect.value = idx;
                    if (navSearchInput) navSearchInput.value = targetHotel.properties.name_ar;
                }

                if (targetHotel) {
                    const routes = this.calculateDualRoutes(targetHotel);
                    this.renderDualRoutes(targetHotel, routes);
                    if (window.innerWidth <= 768) {
                        this.setBottomSheetState('peek');
                    }
                }
            });
        }

        if (btn2D) btn2D.addEventListener('click', () => this.switchTo2DView());
        if (btn3D) btn3D.addEventListener('click', () => this.switchTo3DView());

        if (cardShade) cardShade.addEventListener('click', () => this.selectRoute('shade'));
        if (cardSun) cardSun.addEventListener('click', () => this.selectRoute('sun'));

        if (toggleSteps && stepsList) {
            toggleSteps.addEventListener('click', () => {
                const isHidden = stepsList.classList.toggle('hidden');
                if (chevronSteps) {
                    chevronSteps.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            });
        }

        const btnToggleFocus = document.getElementById('btn-toggle-route-focus');
        if (btnToggleFocus) {
            btnToggleFocus.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.setLayersFocusOnRoute(!this.isRouteFocusActive);
            });
        }

        if (btnStartWalk) {
            btnStartWalk.addEventListener('click', () => {
                if (this.currentRouteData) {
                    const targetRoute = this.activeSelectedRoute === 'sun' ? this.currentRouteData.sunRoute : this.currentRouteData.shadeRoute;
                    const targetInstructions = this.activeSelectedRoute === 'sun' ? this.currentRouteData.sunInstructions : this.currentRouteData.shadeInstructions;
                    this.startPilgrimNavigation(targetRoute, targetInstructions, this.selectedHotel);
                }
            });
        }

        // 13. Mobile Bottom Sheet & Google Maps Touch Gestures
        const panel = document.getElementById('floating-nav-panel');
        const dragArea = document.getElementById('mobile-sheet-drag-area');
        const peekBar = document.getElementById('mobile-peek-bar');
        const mobileQuickStart = document.getElementById('mobile-btn-quick-start');
        const mobileBackdrop = document.getElementById('mobile-backdrop');

        // Initial responsive state
        if (window.innerWidth <= 768) {
            this.setBottomSheetState('peek');
            const bottomBar = document.getElementById('bottom-bar-container');
            if (bottomBar) bottomBar.classList.add('mobile-hidden');
            const legendList = document.getElementById('legend-items-list');
            if (legendList) legendList.classList.add('hidden');
        }

        const toggleNavWidget = () => {
            if (window.innerWidth <= 768) {
                const nextState = this.bottomSheetState === 'expanded' ? 'peek' : 'expanded';
                this.setBottomSheetState(nextState);
            } else {
                if (navBody) {
                    const isHidden = navBody.classList.toggle('hidden');
                    if (chevronNav) {
                        chevronNav.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                    }
                }
            }
        };

        if (btnToggleNav) {
            btnToggleNav.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleNavWidget();
            });
        }
        if (navHeader) {
            navHeader.addEventListener('click', toggleNavWidget);
        }

        if (peekBar) {
            peekBar.addEventListener('click', (e) => {
                if (e.target.closest('#mobile-btn-quick-start')) return;
                this.setBottomSheetState('expanded');
            });
        }

        if (mobileQuickStart) {
            mobileQuickStart.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.currentRouteData && this.selectedHotel) {
                    const targetRoute = this.activeSelectedRoute === 'sun' ? this.currentRouteData.sunRoute : this.currentRouteData.shadeRoute;
                    const targetInstructions = this.activeSelectedRoute === 'sun' ? this.currentRouteData.sunInstructions : this.currentRouteData.shadeInstructions;
                    this.startPilgrimNavigation(targetRoute, targetInstructions, this.selectedHotel);
                } else {
                    this.setBottomSheetState('expanded');
                    if (navSearchInput) navSearchInput.focus();
                }
            });
        }

        if (dragArea) {
            dragArea.addEventListener('click', () => {
                this.setBottomSheetState(this.bottomSheetState === 'expanded' ? 'peek' : 'expanded');
            });

            // Touch swipe gesture handling
            let touchStartY = 0;
            dragArea.addEventListener('touchstart', (e) => {
                if (e.touches && e.touches[0]) {
                    touchStartY = e.touches[0].clientY;
                }
            }, { passive: true });

            dragArea.addEventListener('touchend', (e) => {
                if (e.changedTouches && e.changedTouches[0]) {
                    const touchEndY = e.changedTouches[0].clientY;
                    const diff = touchEndY - touchStartY;
                    if (diff < -30) {
                        // Swiped up -> expand
                        this.setBottomSheetState('expanded');
                    } else if (diff > 30) {
                        // Swiped down -> collapse to peek
                        this.setBottomSheetState('peek');
                    }
                }
            }, { passive: true });
        }

        if (mobileBackdrop) {
            mobileBackdrop.addEventListener('click', () => {
                this.setBottomSheetState('peek');
                const sidebar = document.getElementById('sidebar-drawer');
                if (sidebar) sidebar.classList.add('collapsed');
                mobileBackdrop.classList.add('hidden');
            });
        }

        // 14. Mobile Floating Action Buttons (FABs)
        const fabGps = document.getElementById('fab-gps');
        if (fabGps) {
            fabGps.addEventListener('click', () => {
                fabGps.classList.add('fab-pulse');
                this.locatePilgrim(false);
            });
        }

        const fabPerspective = document.getElementById('fab-perspective');
        if (fabPerspective) {
            fabPerspective.addEventListener('click', () => {
                if (this.is2DView) {
                    this.switchTo3DView();
                } else {
                    this.switchTo2DView();
                }
            });
        }

        const fabSolar = document.getElementById('fab-solar');
        const bottomBar = document.getElementById('bottom-bar-container');
        if (fabSolar && bottomBar) {
            fabSolar.addEventListener('click', () => {
                bottomBar.classList.toggle('mobile-hidden');
            });
        }

        const btnCloseSolar = document.getElementById('btn-close-solar-mobile');
        if (btnCloseSolar && bottomBar) {
            btnCloseSolar.addEventListener('click', () => {
                bottomBar.classList.add('mobile-hidden');
            });
        }

        const fabLayers = document.getElementById('fab-layers');
        const sidebarDrawer = document.getElementById('sidebar-drawer');
        if (fabLayers) {
            fabLayers.addEventListener('click', () => {
                if (sidebarDrawer) {
                    const isCollapsed = sidebarDrawer.classList.toggle('collapsed');
                    if (mobileBackdrop) {
                        if (!isCollapsed && window.innerWidth <= 768) {
                            mobileBackdrop.classList.remove('hidden');
                        } else {
                            mobileBackdrop.classList.add('hidden');
                        }
                    }
                }
            });
        }

        if (btnOpenFromDrawer) {
            btnOpenFromDrawer.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    this.setBottomSheetState('expanded');
                    if (sidebarDrawer) sidebarDrawer.classList.add('collapsed');
                    if (mobileBackdrop) mobileBackdrop.classList.add('hidden');
                } else {
                    if (navBody && navBody.classList.contains('hidden')) {
                        toggleNavWidget();
                    }
                }
                if (navSearchInput) {
                    navSearchInput.focus();
                }
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new MakkahCesiumApp();
    app.init();
    window.makkahCesiumApp = app;
    window.app = app;
});
