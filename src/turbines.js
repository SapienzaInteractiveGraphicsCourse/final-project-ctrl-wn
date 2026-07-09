// Wind turbine classes and initialization

class WindTurbine {
    constructor(x, z, scale = 1.0) {
        this.scale = scale;
        this.currentYaw = 0;
        this.targetYaw = 0;
        this.rotorAngle = Math.random() * Math.PI * 2;
        this.currentRotorSpeed = 0;
        const heightOffset = 10;
        this.posWorld = new THREE.Vector3(x, getTerrainHeight(x, z) + heightOffset, z);

        this.group = new THREE.Group();
        this.group.position.copy(this.posWorld);
        this.group.scale.set(scale, scale, scale);

        this.tower = null;
        this.hub = null;
        this.rotor = null;

        // Obstacle warning light (red blinking beacon)
        //this.beaconLightMat = new THREE.MeshBasicMaterial({ color: 0x330000 });
        this.beaconLightMat = new THREE.MeshStandardMaterial({
            color: 0x550000,
            emissive: 0x000000,
            roughness: 0.3,
            metalness: 0.1
        });
        const beaconGeo = new THREE.SphereGeometry(0.25, 8, 8);
        this.beaconMesh1 = new THREE.Mesh(beaconGeo, this.beaconLightMat);
        this.beaconPointLight1 = new THREE.PointLight(0xff0000, 0, 15);

        this.beaconMesh2 = new THREE.Mesh(beaconGeo, this.beaconLightMat);
        this.beaconPointLight2 = new THREE.PointLight(0xff0000, 0, 15);

        this.beaconPointLight2 = new THREE.PointLight(0xff0000, 0, 15);

        // Glow Effect
        const glowSize = 3.0;
        const glowMaterial = new THREE.SpriteMaterial
            (
                {
                    map: beaconGlowTexture,
                    color: 0xff0000,
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });

        this.glowSprite1 = new THREE.Sprite(glowMaterial);
        this.glowSprite2 = new THREE.Sprite(glowMaterial);

        // Setup the glow size
        this.glowSprite1.scale.set(glowSize, glowSize, 1);
        this.glowSprite2.scale.set(glowSize, glowSize, 1);


        gltfLoader.load(
            'models/modello_turbina_final_v3.glb',
            (gltf) => {
                const model = gltf.scene;
                model.traverse((child) => {
                    if (child.isMesh) {
                        let partKey = null;
                        if (child.name.includes('Foundation')) partKey = 'Foundation';
                        else if (child.name.includes('Hub')) partKey = 'Hub';
                        else if (child.name.includes('Rotor')) partKey = 'Rotor';
                        else if (child.name.includes('Tower')) partKey = 'Tower';

                        if (partKey && turbineTextures[partKey].map) {
                            const tex = turbineTextures[partKey];
                            child.material = new THREE.MeshStandardMaterial({
                                map: tex.map,
                                metalnessMap: tex.metalnessMap,
                                normalMap: tex.normalMap,
                                roughnessMap: tex.roughnessMap,
                                metalness: 1.0,
                                roughness: 1.0
                            });
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                model.traverse((child) => {
                    if (child.name.includes('Tower')) this.tower = child;
                    if (child.name.includes('Hub')) this.hub = child;
                    if (child.name.includes('Rotor')) this.rotor = child;
                });

                if (this.hub && this.rotor) {
                    this.hub.attach(this.rotor);
                }

                if (this.hub) {
                    this.beaconMesh1.position.set(5.03, 13, -13.54); //height was 12.95
                    this.beaconPointLight1.position.set(5.03, 13.5, -13.54); //height was 13.45
                    this.glowSprite1.position.set(5.03, 13.5, -13.54);

                    this.beaconMesh2.position.set(-5.03, 13, -13.54); //height was 12.95
                    this.beaconPointLight2.position.set(-5.03, 13.5, -13.54); //height was 13.45
                    this.glowSprite2.position.set(-5.03, 13.5, -13.54);


                    this.hub.add(this.beaconMesh1);
                    this.hub.add(this.beaconPointLight1);
                    this.hub.add(this.glowSprite1);

                    this.hub.add(this.beaconMesh2);
                    this.hub.add(this.beaconPointLight2);
                    this.hub.add(this.glowSprite2);
                }

                this.group.add(model);
                scene.add(this.group);
            },
            undefined,
            (error) => { console.error("Error loading modern turbine GLTF:", error); }
        );
    }

    update(dt, windDirectionVec, globalSpeedPercent) {
        if (!this.hub || !this.rotor) return;

        let localSpeed = globalSpeedPercent;
        let windDirRad = 0;

        if (STATE.windMode === 'global') {
            windDirRad = Math.atan2(windDirectionVec.x, windDirectionVec.z);
        } else {
            const tClosest = findClosestSplinePoint(this.posWorld, splinePath);
            const tangent = splinePath.getTangentAt(tClosest).normalize();
            windDirRad = Math.atan2(tangent.x, tangent.z);

            const splinePoint = splinePath.getPointAt(tClosest);
            const distance = this.posWorld.distanceTo(splinePoint);
            const sigma = STATE.windSigmaThreshold;
            const factor = Math.exp(-(distance * distance) / (2 * sigma * sigma));
            localSpeed = globalSpeedPercent * factor;
        }

        // Standard operational limits
        let targetRotorSpeed = 0;
        if (localSpeed < 10) {
            targetRotorSpeed = 0;
        } else if (localSpeed > 90) {
            targetRotorSpeed = 0; // Aerodynamic safety brake
        } else {
            targetRotorSpeed = (localSpeed / 100) * 2.8;
        }

        this.currentRotorSpeed += (targetRotorSpeed - this.currentRotorSpeed) * dt * 2;
        this.rotorAngle += this.currentRotorSpeed * dt;
        this.rotor.rotation.z = this.rotorAngle;

        this.targetYaw = windDirRad;

        let diff = this.targetYaw - this.currentYaw;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const yawSpeed = 1.0;
        this.currentYaw += diff * Math.min(dt * yawSpeed, 1.0);
        this.tower.rotation.y = this.currentYaw;

        // Blinking beacon at night
        const timeFactor = clock.getElapsedTime() * 2.5;
        const isNight = STATE.timeOfDay < 5.5 || STATE.timeOfDay > 18.5;

        if (isNight) {
            const isLit = Math.sin(timeFactor) > 0.5;
            this.beaconLightMat.color.setHex(isLit ? 0x000000 : 0x550000);
            this.beaconLightMat.emissive.setHex(isLit ? 0xff0000 : 0x000000);
            this.beaconPointLight1.intensity = isLit ? 2.5 : 0.0;
            this.beaconPointLight2.intensity = isLit ? 2.5 : 0.0;

            this.glowSprite1.visible = isLit;
            this.glowSprite2.visible = isLit;
        }
        else {
            this.beaconLightMat.color.setHex(0x550000);
            this.beaconLightMat.emissive.setHex(0x000000);
            this.beaconPointLight1.intensity = 0;
            this.beaconPointLight2.intensity = 0;

            this.glowSprite1.visible = false;
            this.glowSprite2.visible = false;
        }
    }
}

class OldWindmill {
    constructor(x, z, scale = 1.0) {
        this.scale = scale;
        this.currentYaw = 0;
        this.targetYaw = 0;
        this.rotorAngle = Math.random() * Math.PI * 2;
        this.currentRotorSpeed = 0;
        const heightOffset = 5;
        this.posWorld = new THREE.Vector3(x, getTerrainHeight(x, z) + heightOffset, z);

        this.group = new THREE.Group();
        this.group.position.copy(this.posWorld);
        this.group.scale.set(scale, scale, scale);

        this.tower = null;
        this.hub = null;
        this.rotor = null;

        gltfLoader.load(
            'models/old_windmillv6final.glb',
            (gltf) => {
                const model = gltf.scene;
                model.traverse((child) => {
                    if (child.isMesh) {
                        if (child.geometry && child.geometry.attributes.uv) {
                            child.geometry.setAttribute('uv2', new THREE.BufferAttribute(child.geometry.attributes.uv.array, 2));
                        }

                        let partKey = null;
                        if (child.name.includes('Hub')) partKey = 'Hub';
                        else if (child.name.includes('Rotor')) partKey = 'Rotor';
                        else if (child.name.includes('Tower')) partKey = 'Tower';

                        if (partKey && oldWindmillTextures[partKey].map) {
                            const tex = oldWindmillTextures[partKey];
                            child.material = new THREE.MeshStandardMaterial({
                                map: tex.map,
                                aoMap: tex.aoMap,
                                aoMapIntensity: 0.8,
                                normalMap: tex.normalMap,
                                metalness: 0.0,
                                roughness: 0.8,
                                envMapIntensity: 1.2
                            });
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                model.traverse((child) => {
                    if (child.name.includes('Tower')) this.tower = child;
                    if (child.name.includes('Hub')) this.hub = child;
                    if (child.name.includes('Rotor')) this.rotor = child;
                });

                if (this.hub && this.rotor) {
                    this.hub.attach(this.rotor);
                }

                this.group.add(model);
                scene.add(this.group);
            },
            undefined,
            (error) => { console.error("Error loading old windmill GLTF:", error); }
        );
    }

    update(dt, windDirectionVec, globalSpeedPercent) {
        if (!this.hub || !this.rotor) return;

        let localSpeed = globalSpeedPercent;
        let windDirRad = 0;

        if (STATE.windMode === 'global') {
            windDirRad = Math.atan2(windDirectionVec.x, windDirectionVec.z);
        } else {
            const tClosest = findClosestSplinePoint(this.posWorld, splinePath);
            const tangent = splinePath.getTangentAt(tClosest).normalize();
            windDirRad = Math.atan2(tangent.x, tangent.z);

            const splinePoint = splinePath.getPointAt(tClosest);
            const distance = this.posWorld.distanceTo(splinePoint);
            const sigma = STATE.windSigmaThreshold;
            const factor = Math.exp(-(distance * distance) / (2 * sigma * sigma));
            localSpeed = globalSpeedPercent * factor;
        }

        // Old mills spin proportional to wind speed without safety cut-off
        let targetRotorSpeed = (localSpeed / 100) * 2.8;

        this.currentRotorSpeed += (targetRotorSpeed - this.currentRotorSpeed) * dt * 2;
        this.rotorAngle += this.currentRotorSpeed * dt;
        this.rotor.rotation.z = this.rotorAngle;

        this.targetYaw = windDirRad;

        let diff = this.targetYaw - this.currentYaw;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const yawSpeed = 1.0;
        this.currentYaw += diff * Math.min(dt * yawSpeed, 1.0);
        this.tower.rotation.y = this.currentYaw;
    }
}

// Instantiate all turbines
function createTurbines() {
    turbines = [];

    // Modern turbines
    turbines.push(new WindTurbine(40, 25, 0.3));
    turbines.push(new WindTurbine(100, -30, 0.3));
    turbines.push(new WindTurbine(-100, -60, 0.3));
    turbines.push(new WindTurbine(0, 75, 0.3));
    turbines.push(new WindTurbine(-100, 100, 0.3));
    turbines.push(new WindTurbine(-40, -10, 0.3));
    turbines.push(new WindTurbine(100, 100, 0.3));

    // Old windmills
    turbines.push(new OldWindmill(-100, -110, 0.1));
    turbines.push(new OldWindmill(-80, 30, 0.1));
    turbines.push(new OldWindmill(-30, -50, 0.1));
    turbines.push(new OldWindmill(60, 0, 0.1));
    turbines.push(new OldWindmill(30, -80, 0.1));
    turbines.push(new OldWindmill(10, 30, 0.1));
    turbines.push(new OldWindmill(45, 80, 0.1));
    turbines.push(new OldWindmill(80, 40, 0.1));
    turbines.push(new OldWindmill(-20, 110, 0.1));
}
