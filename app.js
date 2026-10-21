/**
 * Production Controller for Zilal Makkah 3D City & Hotel Navigation
 */

document.addEventListener('DOMContentLoaded', () => {
    const solarEngine = new SolarEngine();
    const hotelsData = window.MAKKAH_HOTELS_DATA;

    // 1. Initialize High-Fidelity 3D Makkah City Engine
    const city3D = new Makkah3DCity('makkah-3d-canvas');
    city3D.init();

    let activeHotel = hotelsData.hotels[0]; // Default: Hilton Jabal Omar
    let currentStepIdx = 0;
    let simDate = new Date(2026, 6, 15, 12, 45, 0); // Duhr Sun

    // 2. Populate Hotels Dropdown
    const hotelDropdown = document.getElementById('hotel-select-dropdown');
    if (hotelDropdown) {
        hotelDropdown.innerHTML = '';
        hotelsData.hotels.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.id;
            opt.innerText = `${h.name} (${h.category})`;
            hotelDropdown.appendChild(opt);
        });

        hotelDropdown.addEventListener('change', (e) => {
            selectHotel(e.target.value);
        });
    }

    // 3. Hotel Selection & Route Rendering
    function selectHotel(hotelId) {
        const found = hotelsData.hotels.find(h => h.id === hotelId);
        if (!found) return;

        activeHotel = found;
        currentStepIdx = 0;

        // Render Dual 3D Routes in the 3D City & position Pilgrim
        city3D.renderRoutes(activeHotel);

        // Update UI Cards
        updateHotelUI();
        syncStep(0);
    }

    function updateHotelUI() {
        const titleEl = document.getElementById('selected-hotel-name');
        const gateEl = document.getElementById('selected-hotel-gate');
        const distEl = document.getElementById('hud-dist');
        const timeEl = document.getElementById('hud-time');
        const shadeEl = document.getElementById('hud-shade');
        const coolingEl = document.getElementById('hud-cooling');

        if (titleEl) titleEl.innerText = activeHotel.name;
        if (gateEl) gateEl.innerText = activeHotel.targetGate;
        if (distEl) distEl.innerText = `${activeHotel.distMeters} م`;
        if (timeEl) timeEl.innerText = `${activeHotel.walkMins} دقائق`;
        if (shadeEl) shadeEl.innerText = activeHotel.shadeProtection;
        if (coolingEl) coolingEl.innerText = activeHotel.tempReduction;

        // Populate Step-by-Step Field Instructions in Sidebar
        const stepsList = document.getElementById('hotel-steps-list');
        if (stepsList) {
            stepsList.innerHTML = '';
            activeHotel.route3D.forEach((st, i) => {
                const stepCard = document.createElement('div');
                stepCard.className = `p-3 rounded-xl border text-xs cursor-pointer transition ${
                    i === currentStepIdx
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-950/60'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`;
                stepCard.innerHTML = `
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-amber-400">الخطوة ${i + 1}</span>
                        <span class="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-300 font-semibold">${st.shade} (${st.cooling})</span>
                    </div>
                    <p class="text-[11px] leading-relaxed text-slate-200">${st.instruction}</p>
                `;
                stepCard.addEventListener('click', () => {
                    currentStepIdx = i;
                    syncStep(i);
                });
                stepsList.appendChild(stepCard);
            });
        }
    }

    // 4. Synchronize Navigation Step
    const instructionBanner = document.getElementById('hud-instruction-text');
    const shadeBadge = document.getElementById('hud-shade-badge');

    function syncStep(idx) {
        const step = activeHotel.route3D[idx];
        if (!step) return;

        if (instructionBanner) instructionBanner.innerText = step.instruction;
        if (shadeBadge) shadeBadge.innerText = `${step.shade} | ${step.cooling}`;

        // Move pilgrim in 3D City
        city3D.currentWaypointIndex = idx;
        city3D.progress = 0;
        city3D.pilgrim.position.set(step.x, 0, step.z);
        city3D.updateCamera();

        updateHotelUI();
    }

    // Callback when pilgrim walks into next waypoint
    window.onNavStepAdvanced = (newIdx) => {
        currentStepIdx = newIdx;
        syncStep(newIdx);
    };

    window.onPilgrimArrival = () => {
        const btnPlay = document.getElementById('btn-play-nav');
        if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-rotate-right ml-1"></i> إعادة من البداية';
        if (instructionBanner) {
            instructionBanner.innerHTML = `✨ <b>الحمد لله على سلامتكم</b>.. وصلتم إلى ${activeHotel.targetGate}، تقبل الله طاعتكم.`;
        }
    };

    // 5. Navigation Controls (Play / Pause / Next / Prev)
    const btnPlayNav = document.getElementById('btn-play-nav');
    const btnNextStep = document.getElementById('btn-next-step');
    const btnPrevStep = document.getElementById('btn-prev-step');

    if (btnPlayNav) {
        btnPlayNav.addEventListener('click', () => {
            if (city3D.isNavigating) {
                city3D.pauseNavigation();
                btnPlayNav.innerHTML = '<i class="fa-solid fa-play ml-1"></i> بدء السير التفاعلي';
            } else {
                if (currentStepIdx >= activeHotel.route3D.length - 1) {
                    currentStepIdx = 0;
                    syncStep(0);
                }
                city3D.startNavigation();
                btnPlayNav.innerHTML = '<i class="fa-solid fa-pause ml-1"></i> إيقاف مؤقت';
            }
        });
    }

    if (btnNextStep) {
        btnNextStep.addEventListener('click', () => {
            if (currentStepIdx < activeHotel.route3D.length - 1) {
                currentStepIdx++;
                syncStep(currentStepIdx);
            }
        });
    }

    if (btnPrevStep) {
        btnPrevStep.addEventListener('click', () => {
            if (currentStepIdx > 0) {
                currentStepIdx--;
                syncStep(currentStepIdx);
            }
        });
    }

    // 6. Camera Mode Switcher (Street Navigation vs 3D Aerial Orbit)
    const btnCamStreet = document.getElementById('btn-cam-street');
    const btnCamAerial = document.getElementById('btn-cam-aerial');

    if (btnCamStreet && btnCamAerial) {
        btnCamStreet.addEventListener('click', () => {
            city3D.setCameraMode('street');
            btnCamStreet.classList.add('bg-emerald-600', 'text-white');
            btnCamStreet.classList.remove('text-gray-400');
            btnCamAerial.classList.remove('bg-emerald-600', 'text-white');
            btnCamAerial.classList.add('text-gray-400');
        });

        btnCamAerial.addEventListener('click', () => {
            city3D.setCameraMode('aerial');
            btnCamAerial.classList.add('bg-emerald-600', 'text-white');
            btnCamAerial.classList.remove('text-gray-400');
            btnCamStreet.classList.remove('bg-emerald-600', 'text-white');
            btnCamStreet.classList.add('text-gray-400');
        });
    }

    // 7. Auto-GPS Location Button
    const btnGps = document.getElementById('btn-gps-auto');
    if (btnGps) {
        btnGps.addEventListener('click', () => {
            // Find closest hotel (defaults to Hilton Jabal Omar)
            selectHotel('hotel_hilton_jabal_omar');
            alert('تم تحديد موقعك تلقائياً عند: فندق جبل عمر هيلتون (طريق إبراهيم الخليل). جاري رسم مسار الظلال الآمن إلى الحرم...');
        });
    }

    // 8. Time Slider & Physical 3D Shadow Movement
    const timeSlider = document.getElementById('time-slider');
    const timeDisplay = document.getElementById('time-display');
    const solarAzimuthDisplay = document.getElementById('solar-azimuth');
    const solarAltitudeDisplay = document.getElementById('solar-altitude');

    function applyTime(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        simDate.setHours(hours, mins, 0);

        if (timeDisplay) timeDisplay.innerText = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

        const solarPos = solarEngine.calculateSolarPosition(simDate);
        if (solarAzimuthDisplay) solarAzimuthDisplay.innerText = `${Math.round(solarPos.azimuth)}°`;
        if (solarAltitudeDisplay) solarAltitudeDisplay.innerText = `${Math.round(solarPos.altitude)}°`;

        // Rotate and project physical 3D shadows in real-time
        city3D.updateSunPosition(solarPos.altitude, solarPos.azimuth);
    }

    if (timeSlider) {
        timeSlider.addEventListener('input', (e) => {
            applyTime(parseInt(e.target.value));
        });
    }

    // Initial Trigger
    selectHotel(activeHotel.id);
    applyTime(765); // 12:45 PM
});
