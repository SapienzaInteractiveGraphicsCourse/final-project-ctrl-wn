// Spline generation and wind simulation logic

function createWindSpline() {
    if (splineHelper) {
        scene.remove(splineHelper);
        splineHelper.geometry.dispose();
        splineHelper.material.dispose();
    }

    if (windLeaves.length > 0) {
        windLeaves.forEach(leaf => {
            scene.remove(leaf.mesh);
            leaf.mesh.geometry.dispose();
        });
        windLeaves = [];
    }

    if (windTrails.length > 0) {
        windTrails.forEach(trail => {
            scene.remove(trail.mesh);
            trail.mesh.geometry.dispose();
            trail.mesh.material.dispose();
        });
        windTrails = [];
    }

    const pointsArray = [];
    const numPoints = 9;
    const startX = -130;
    const endX = 130;
    const stepX = (endX - startX) / (numPoints - 1);

    const startZ = (Math.random() - 0.5) * 160;
    const endZ = (Math.random() - 0.5) * 160;
    const splineHeightOffset = 1.2;

    for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const x = startX + i * stepX;
        const linearZ = THREE.MathUtils.lerp(startZ, endZ, t);
        const deviazZ = (i > 0 && i < numPoints - 1) ? (Math.random() - 0.5) * 110 : 0;
        const z = linearZ + deviazZ;
        const y = getTerrainHeight(x, z) + splineHeightOffset;
        pointsArray.push(new THREE.Vector3(x, y, z));
    }

    splinePath = new THREE.CatmullRomCurve3(pointsArray);

    const points = splinePath.getPoints(100);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.6,
        linewidth: 3
    });
    splineHelper = new THREE.Line(geometry, material);

    // Only show if both toggles are true
    splineHelper.visible = STATE.showSpline && STATE.windMode === 'spline';
    scene.add(splineHelper);

    const leafCount = 40;
    const leafGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const leafMat = new THREE.MeshStandardMaterial({
        map: petalTexture,
        transparent: true,
        alphaTest: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 0.6,
        metalness: 0.1
    });

    for (let i = 0; i < leafCount; i++) {
        const mesh = new THREE.Mesh(leafGeo, leafMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        windLeaves.push({
            mesh: mesh,
            t: i / leafCount,
            speedMultiplier: 0.8 + Math.random() * 0.4,
            randomScale: 0.7 + Math.random() * 0.6,
            oscOffset: Math.random() * Math.PI * 2
        });
    }

    //disattivo per ora, da capire come implementare la scia sulla spline
    // createWindTrails();

    if (STATE.showWindVectorField) {
        updateWindVectorField();
    }
}

function createWindTrails() {
    const trailCount = 12;
    const trailGeo = new THREE.PlaneGeometry(6.0, 1.0);

    windTrails = [];

    for (let i = 0; i < trailCount; i++) {
        const trailMat = new THREE.MeshBasicMaterial({
            map: windTexture,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(trailGeo, trailMat);
        scene.add(mesh);

        windTrails.push({
            mesh: mesh,
            t: i / trailCount,
            speedMultiplier: 1.1 + Math.random() * 0.4,
            offsetY: 2.0 + Math.random() * 1.5,
            textureOffsetX: Math.random()
        });
    }
}

// Use distanceToSquared instead of distanceTo to avoid heavy root nodes
// this is better because it avoids slow Math.sqrt
function findClosestSplinePoint(pos, spline, steps = 100) {
    let minDistanceSq = Infinity;
    let bestT = 0;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pt = spline.getPointAt(t);
        const distSq = pos.distanceToSquared(pt);
        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            bestT = t;
        }
    }
    return bestT;
}

// Vector field rendering and toggles
function toggleWindVectorField() {
    STATE.showWindVectorField = !STATE.showWindVectorField;
    if (typeof UI !== 'undefined') {
        UI.syncShowWindVectors(STATE.showWindVectorField);
    }

    if (STATE.showWindVectorField) {
        grassMesh.visible = false;
        createWindVectorField();
    } else {
        grassMesh.visible = true;
        destroyWindVectorField();
    }
}

function createWindVectorField() {
    if (STATE.vectorArrowGroup) {
        scene.remove(STATE.vectorArrowGroup);
        STATE.vectorArrowGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        STATE.vectorArrowGroup = null;
    }

    STATE.vectorArrowGroup = new THREE.Group();

    const gridCols = 16;
    const gridRows = 14;
    const range = 180;
    const spacingX = (range * 2) / (gridCols - 1);
    const spacingZ = (range * 2) / (gridRows - 1);
    const elevationOffset = 1.0;

    let cachedClosestT = {};
    const getCachedClosestSplinePoint = (pos) => {
        const key = Math.round(pos.x) + ',' + Math.round(pos.z);
        if (!cachedClosestT[key]) {
            cachedClosestT[key] = findClosestSplinePoint(pos, splinePath);
        }
        return cachedClosestT[key];
    };

    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
            const x = -range + col * spacingX;
            const z = -range + row * spacingZ;

            const y = getTerrainHeight(x, z);
            const posWorld = new THREE.Vector3(x, y, z);

            let windDir, windIntensity;

            if (STATE.windMode === 'global') {
                windDir = windVectorGlobal.clone().normalize();
                windIntensity = STATE.windSpeed / 100;
            } else {
                const tClosest = getCachedClosestSplinePoint(posWorld);
                windDir = splinePath.getTangentAt(tClosest).normalize();

                const pointOnSpline = splinePath.getPointAt(tClosest);
                const distFromSpline = posWorld.distanceTo(pointOnSpline);

                const sigma = STATE.windSigmaThreshold;
                windIntensity = (STATE.windSpeed / 100) *
                    Math.exp(-(distFromSpline * distFromSpline) / (2 * sigma * sigma));
            }

            const arrowLength = windIntensity * 10;
            const color = getColorForWindIntensity(windIntensity);

            const arrow = new THREE.ArrowHelper(
                windDir,
                new THREE.Vector3(x, y + elevationOffset, z),
                Math.max(arrowLength, 0.4),
                color,
                arrowLength * 0.35,
                arrowLength * 0.25
            );

            STATE.vectorArrowGroup.add(arrow);
        }
    }

    scene.add(STATE.vectorArrowGroup);
}

function updateWindVectorField() {
    if (!STATE.showWindVectorField || !STATE.vectorArrowGroup) return;
    createWindVectorField();
}

function destroyWindVectorField() {
    if (STATE.vectorArrowGroup) {
        scene.remove(STATE.vectorArrowGroup);
        STATE.vectorArrowGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        STATE.vectorArrowGroup = null;
    }
}

function getColorForWindIntensity(intensity) {
    const i = Math.max(0, Math.min(1, intensity));
    let r, g, b;

    if (i < 0.33) {
        const t = i / 0.33;
        r = Math.round(0 + (0 - 0) * t);
        g = Math.round(0 + (255 - 0) * t);
        b = Math.round(255 + (0 - 255) * t);
    } else if (i < 0.67) {
        const t = (i - 0.33) / 0.34;
        r = Math.round(0 + (255 - 0) * t);
        g = Math.round(255 + (255 - 255) * t);
        b = Math.round(0 + (0 - 0) * t);
    } else {
        const t = (i - 0.67) / 0.33;
        r = Math.round(255 + (255 - 255) * t);
        g = Math.round(255 + (0 - 255) * t);
        b = Math.round(0 + (0 - 0) * t);
    }

    return (r << 16) | (g << 8) | b;
}