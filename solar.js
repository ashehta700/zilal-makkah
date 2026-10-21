/**
 * Solar Astronomical & Thermal Mathematics Engine for Makkah Al-Mukarramah
 * Coordinates: 21.4225° N, 39.8262° E
 */

const MAKKAH_COORDS = {
    lat: 21.4225,
    lng: 39.8262
};

class SolarEngine {
    constructor() {
        this.coords = MAKKAH_COORDS;
    }

    /**
     * Calculates solar position (Azimuth and Altitude) for Makkah
     * @param {Date} date - Javascript Date object
     * @returns {Object} { azimuth: degrees (0=North, 90=East), altitude: degrees above horizon }
     */
    calculateSolarPosition(date) {
        const rad = Math.PI / 180;
        const deg = 180 / Math.PI;

        const lat = this.coords.lat * rad;
        const lng = this.coords.lng;

        // Day of the year
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);

        // Fractional year (radians)
        const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (date.getHours() - 12) / 24);

        // Equation of time (minutes)
        const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
            - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));

        // Solar declination angle (radians)
        const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
            - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
            - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

        // True solar time in minutes
        // Makkah is UTC+3 (45° East standard meridian), Local Meridian is 39.8262°
        const timeOffset = eqtime + 4 * (lng - 45);
        const minutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
        const tst = minutes + timeOffset;

        // Hour angle (degrees)
        let ha = (tst / 4) - 180;
        if (ha < -180) ha += 360;
        const haRad = ha * rad;

        // Solar zenith angle (radians)
        const cosZenith = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(haRad);
        const zenithRad = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
        const altitudeRad = (Math.PI / 2) - zenithRad;
        const altitudeDeg = altitudeRad * deg;

        // Solar Azimuth angle (degrees clockwise from North)
        let azimuthRad = Math.acos((Math.sin(decl) - Math.sin(lat) * Math.sin(altitudeRad)) / (Math.cos(lat) * Math.cos(altitudeRad)));
        let azimuthDeg = azimuthRad * deg;

        if (ha > 0) {
            azimuthDeg = 360 - azimuthDeg;
        }

        return {
            azimuth: (azimuthDeg + 180) % 360, // standard clockwise from North
            altitude: Math.max(0, altitudeDeg),
            isDay: altitudeDeg > 0
        };
    }

    /**
     * Calculates shadow projection vector
     * @param {number} buildingHeight - Height in meters
     * @param {Object} solarPos - { azimuth, altitude }
     * @returns {Object} { length: meters, angleDeg: degrees (direction shadow points) }
     */
    calculateShadowVector(buildingHeight, solarPos) {
        if (solarPos.altitude <= 0.5) {
            return { length: 0, angleDeg: 0 };
        }

        const altRad = solarPos.altitude * (Math.PI / 180);
        // Shadow length = Height / tan(altitude)
        const length = buildingHeight / Math.tan(altRad);

        // Shadow points in opposite direction to sun
        const shadowAngle = (solarPos.azimuth + 180) % 360;

        return {
            length: Math.min(length, buildingHeight * 8), // cap extreme low-sun shadows
            angleDeg: shadowAngle
        };
    }

    /**
     * Estimates Perceived Heat Stress and Temperature
     * @param {number} ambientTemp - in Celsius (e.g. 46)
     * @param {number} shadeRatio - 0 (full sun) to 1 (full shade)
     * @param {number} solarAltitude - degrees
     */
    estimateThermalMetrics(ambientTemp, shadeRatio, solarAltitude) {
        // Direct solar radiation adds up to 10-15°C of perceived radiative temperature (UTCI / Mean Radiant Temp)
        const solarLoad = Math.sin(Math.max(0, solarAltitude) * Math.PI / 180) * 14;
        const perceivedTemp = ambientTemp + (1 - shadeRatio) * solarLoad - (shadeRatio * 3.5); // shade air draft cooling

        // Estimated heart rate increase due to heat dissipation strain
        const baseHR = 75;
        const hrElev = Math.max(0, (perceivedTemp - 30) * 1.8);

        return {
            perceivedTemp: Math.round(perceivedTemp * 10) / 10,
            tempDelta: Math.round(((ambientTemp + solarLoad) - perceivedTemp) * 10) / 10,
            heatRiskLevel: perceivedTemp > 45 ? 'خطر مرتفع جداً (ضربات شمس)' : perceivedTemp > 39 ? 'إجهاد حراري ملحوظ' : 'منطقة مريحة وآمنة',
            estimatedHR: Math.round(baseHR + hrElev)
        };
    }
}

// Export for browser
window.SolarEngine = SolarEngine;
