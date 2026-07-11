// Core 3D engine initialization and rendering loop

window.addEventListener('DOMContentLoaded', () => {
    initGraphics();
    generateTextures();
    createEnvironment();
    createWindSpline();
    createTurbines();
    createRocks();
    createDynamicGrass();
    if (typeof UI !== 'undefined') {
        UI.init();
    }
    animate();
});

// Load billboard sprites and trails
function generateTextures() {
    leafTexture = textureLoader.load('textures/billboar_grass_v2.png');
    leafTexture.wrapS = THREE.ClampToEdgeWrapping;
    leafTexture.wrapT = THREE.ClampToEdgeWrapping;
    leafTexture.encoding = THREE.sRGBEncoding;
    leafTexture.generateMipmaps = false;
    leafTexture.minFilter = THREE.LinearFilter;
    leafTexture.magFilter = THREE.LinearFilter;

    flowerTexture = textureLoader.load('textures/billboar_flowers.png');
    flowerTexture.wrapS = THREE.ClampToEdgeWrapping;
    flowerTexture.wrapT = THREE.ClampToEdgeWrapping;
    flowerTexture.encoding = THREE.sRGBEncoding;
    flowerTexture.generateMipmaps = false;
    flowerTexture.minFilter = THREE.LinearFilter;
    flowerTexture.magFilter = THREE.LinearFilter;

    petalTexture = textureLoader.load('textures/petals.png');
    petalTexture.wrapS = THREE.ClampToEdgeWrapping;
    petalTexture.wrapT = THREE.ClampToEdgeWrapping;
    petalTexture.encoding = THREE.sRGBEncoding;

    windTexture = textureLoader.load('textures/wind.png');
    windTexture.wrapS = THREE.RepeatWrapping;
    windTexture.wrapT = THREE.ClampToEdgeWrapping;
    windTexture.encoding = THREE.sRGBEncoding;
    beaconGlowTexture = textureLoader.load('textures/glow.png');

}

// Setup Three.js WebGL renderer, OrbitControls and Audio
function initGraphics() {
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a141e);
    scene.fog = new THREE.FogExp2(0x0a141e, 0.007);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
    if (STATE.currentCamera === 'turbine-1') {
        camera.position.set(3.84, 10.26, 117.86);
    } else {
        camera.position.set(0, 40, 100);
    }

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.80;
    container.appendChild(renderer.domElement);

    renderer.outputEncoding = THREE.sRGBEncoding;

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 1.0;

    if (STATE.currentCamera === 'turbine-1') {
        const lookDist = 100;
        const dir = { x: -0.25, y: 0.16, z: -0.95 };
        controls.target.set(
            3.84 + (dir.x * lookDist),
            10.26 + (dir.y * lookDist),
            117.86 + (dir.z * lookDist)
        );
        controls.enabled = false;
    } else {
        controls.target.set(0, 39.971, 99.904);
    }
    STATE.billboardFactor = (STATE.currentCamera === 'orbit') ? 0.0 : 1.0;

    window.addEventListener('resize', onWindowResize);

    // Zooming moves camera target forward
    window.addEventListener('wheel', (event) => {
        if (STATE.currentCamera === 'orbit') {
            const moveSpeed = 3.5;
            const direction = event.deltaY < 0 ? 1 : -1;
            const lookDirection = new THREE.Vector3();
            camera.getWorldDirection(lookDirection);
            const moveVector = lookDirection.multiplyScalar(direction * moveSpeed);
            camera.position.add(moveVector);
            controls.target.add(moveVector);

            const terrainY = getTerrainHeight(camera.position.x, camera.position.z);
            const minHeight = terrainY + 2.0;

            if (camera.position.y < minHeight) {
                const diff = minHeight - camera.position.y;
                camera.position.y += diff;
                controls.target.y += diff;
            }
        }
    });

    audioListener = new THREE.AudioListener();
    camera.add(audioListener);

    windSound = new THREE.Audio(audioListener);
    grassSound = new THREE.Audio(audioListener);
    turbineSound = new THREE.Audio(audioListener);

    const audioLoader = new THREE.AudioLoader(loadingManager);

    // Loading file audio
    audioLoader.load('sounds/wind.mp3', (buffer) => {
        windSound.setBuffer(buffer);
        windSound.setLoop(true);
        updateWindAudio();
    });

    audioLoader.load('sounds/grass.mp3', (buffer) => {
        grassSound.setBuffer(buffer);
        grassSound.setLoop(true);
        updateWindAudio();
    });

    audioLoader.load('sounds/turbine.mp3', (buffer) => {
        turbineSound.setBuffer(buffer);
        turbineSound.setLoop(true);
        updateWindAudio();
    });

    // It is used to unlock the audio context on the user's first click (this made to bypass browser restrictions)
    window.addEventListener('click', () => {
        if (audioListener && audioListener.context && audioListener.context.state === 'suspended') {
            audioListener.context.resume().then(() => {
                updateWindAudio();
            });
        }
    }, { once: true });
}

// update audio, increase volume, pitch, speed 
function updateWindAudio() {
    const speedFactor = STATE.windSpeed / 100;

    // If the application has changed, reset all volumes
    if (STATE.isMuted) {
        if (windSound && windSound.buffer) windSound.setVolume(0);
        if (grassSound && grassSound.buffer) grassSound.setVolume(0);
        if (turbineSound && turbineSound.buffer) turbineSound.setVolume(0);
        return;
    }

    // WIND SOUND (always active by default) TO translate
    if (windSound && windSound.buffer) {
        if (!windSound.isPlaying) {
            windSound.play();
        }
        const windVolume = STATE.windSpeed === 0 ? 0.05 : 0.1 + (speedFactor * 0.9);
        windSound.setVolume(windVolume);

        const windPitch = 0.7 + (speedFactor * 0.8);
        windSound.setPlaybackRate(windPitch);
    }

    // GRASS SOUND --
    if (grassSound && grassSound.buffer) {
        if (!grassSound.isPlaying) {
            grassSound.play();
        }
        if (STATE.currentCamera === 'turbine-1') {
            const grassVolume = STATE.windSpeed === 0 ? 0.05 : 0.8 + (speedFactor * 0.2);
            grassSound.setVolume(grassVolume);

            const grassPitch = 1.0 + ((speedFactor * 0.3) / 10);
            grassSound.setPlaybackRate(grassPitch);
        } else {
            grassSound.setVolume(0);
        }
    }

    // TURBINE SOUND
    if (turbineSound && turbineSound.buffer) {
        if (!turbineSound.isPlaying) {
            turbineSound.play();
        }
        if (STATE.currentCamera === 'turbine-2') {
            // Check for blades if they are blocked
            let turbineActiveFactor = speedFactor;
            if (STATE.windSpeed < 10 || STATE.windSpeed > 90) {
                turbineActiveFactor = 0.05;
            }
            const turbineVolume = STATE.windSpeed === 0 ? 0 : 0.05 + (turbineActiveFactor * 0.85);
            turbineSound.setVolume(turbineVolume);

            const turbinePitch = 0.6 + (turbineActiveFactor * 0.7);
            turbineSound.setPlaybackRate(turbinePitch);
        } else {
            turbineSound.setVolume(0);
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Lights, Terrain geometry and Skybox blending shaders
function createEnvironment() {
    hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(100, 80, 50);
    sunLight.castShadow = true;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;
    sunLight.shadow.camera.left = -150;
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const placeholderCube = new THREE.CubeTexture();
    skyboxMat = new THREE.ShaderMaterial({
        uniforms: {
            tDay: { value: placeholderCube },
            tSunset: { value: placeholderCube },
            tNight: { value: placeholderCube },
            mixDay: { value: 0.0 },
            mixSunset: { value: 0.0 },
            mixNight: { value: 1.0 }
        },
        vertexShader: `
            varying vec3 vWorldDirection;
            void main() {
                vWorldDirection = position;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform samplerCube tDay;
            uniform samplerCube tSunset;
            uniform samplerCube tNight;
            uniform float mixDay;
            uniform float mixSunset;
            uniform float mixNight;
            varying vec3 vWorldDirection;

            mat3 rotationY( float angle ) {
                return mat3(
                    cos(angle), 0.0, sin(angle),
                    0.0, 1.0, 0.0,
                    -sin(angle), 0.0, cos(angle)
                );
            }

            mat3 rotationX( float angle ) {
                return mat3(
                    1.0, 0.0, 0.0,
                    0.0, cos(angle), -sin(angle),
                    0.0, sin(angle), cos(angle)
                );
            }

            void main() {
                vec3 dir = normalize(vWorldDirection);
                
                // Il giorno e il tramonto rimangono normali
                vec4 colDay = textureCube(tDay, dir);
                vec4 colSunset = textureCube(tSunset, dir);
                
                // add extra rotation skybox night for better View/Result
                
                float rotY = 3.14159 * 0.85;
                float rotX = 3.14159 * 0.15;
                
                vec3 nightDir = rotationY(rotY) * rotationX(rotX) * dir;
                vec4 colNight = textureCube(tNight, nightDir);
                
                float total = mixDay + mixSunset + mixNight;
                vec4 finalColor = vec4(0.0);
                if (total > 0.0) {
                    finalColor = (colDay * mixDay + colSunset * mixSunset + colNight * mixNight) / total;
                } else {
                    finalColor = colNight;
                }
                gl_FragColor = finalColor;
            }
        `,
        side: THREE.BackSide,
        depthWrite: false
    });

    const skyboxGeo = new THREE.BoxGeometry(1500, 1500, 1500);
    skyboxMesh = new THREE.Mesh(skyboxGeo, skyboxMat);
    skyboxMesh.renderOrder = -1;
    scene.add(skyboxMesh);

    loadCubeTextureFromCross('textures/skybox_day.png', (tex) => { skyboxMat.uniforms.tDay.value = tex; });
    loadCubeTextureFromCross('textures/skybox_sunset.png', (tex) => { skyboxMat.uniforms.tSunset.value = tex; });
    loadCubeTextureFromCross('textures/skybox_night.png', (tex) => { skyboxMat.uniforms.tNight.value = tex; });

    const terrainSize = 240;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, 120, 120);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        let y = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 12;
        y += Math.sin(x * 0.05) * 3;
        y += Math.cos(z * 0.08) * 1.5;
        const distFromCenter = Math.sqrt(x * x + z * z);
        if (distFromCenter > 100) {
            const factor = Math.min((distFromCenter - 100) / 50, 1);
            y -= factor * 15;
        }
        pos.setY(i, y);
    }
    terrainGeo.computeVertexNormals();

    const terrainTexture1 = textureLoader.load('textures/terrain_dense.jpg');
    terrainTexture1.wrapS = THREE.RepeatWrapping;
    terrainTexture1.wrapT = THREE.RepeatWrapping;
    terrainTexture1.encoding = THREE.sRGBEncoding;

    const terrainTexture2 = textureLoader.load('textures/terrain_patchy.jpg');
    terrainTexture2.wrapS = THREE.RepeatWrapping;
    terrainTexture2.wrapT = THREE.RepeatWrapping;
    terrainTexture2.encoding = THREE.sRGBEncoding;

    const terrainMat = new THREE.MeshStandardMaterial({
        color: 0x3b3d30,
        roughness: 1.0,
        metalness: 0.0,
        flatShading: false
    });

    terrainMat.onBeforeCompile = (shader) => {
        shader.uniforms.tTerrainDense = { value: terrainTexture1 };
        shader.uniforms.tTerrainPatchy = { value: terrainTexture2 };

        shader.vertexShader = `
            varying vec3 vWorldPosition;
            varying vec3 vTerrainNormal;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vTerrainNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
            `
        );

        shader.fragmentShader = `
            varying vec3 vWorldPosition;
            varying vec3 vTerrainNormal;
            uniform sampler2D tTerrainDense;
            uniform sampler2D tTerrainPatchy;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                vec2 shift = vec2(100.0);
                mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                for (int i = 0; i < 4; ++i) {
                    v += a * noise(p);
                    p = rot * p * 2.0 + shift;
                    a *= 0.5;
                }
                return v;
            }
        ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
            vec2 uvDense1 = vWorldPosition.xz * 0.15;
            vec3 colDense1 = texture2D(tTerrainDense, uvDense1).rgb;
            vec2 uvDense2 = vWorldPosition.xz * 0.052;
            vec3 colDense2 = texture2D(tTerrainDense, uvDense2).rgb;
            vec2 uvPatchy1 = vWorldPosition.xz * 0.15;
            vec3 colPatchy1 = texture2D(tTerrainPatchy, uvPatchy1).rgb;
            vec2 uvPatchy2 = vWorldPosition.xz * 0.052;
            vec3 colPatchy2 = texture2D(tTerrainPatchy, uvPatchy2).rgb;

            float noiseVal = fbm(vWorldPosition.xz * 0.015);

            vec3 colDense = mix(colDense1, colDense2, noiseVal);
            vec3 colPatchy = mix(colPatchy1, colPatchy2, 1.0 - noiseVal);

            float slope = 1.0 - clamp(vTerrainNormal.y, 0.0, 1.0); 
            float heightFactor = clamp((vWorldPosition.y + 12.0) / 24.0, 0.0, 1.0);

            float blendWeight = clamp(noiseVal * 1.5 - slope * 1.5 - heightFactor * 0.4, 0.0, 1.0);
            vec3 finalAlbedo = mix(colPatchy, colDense, blendWeight) * 0.65;

            diffuseColor.rgb *= finalAlbedo;
            `
        );
    };

    terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);
}

// Camera transition tweens
function setupCameraView() {
    controls.enabled = (STATE.currentCamera === 'orbit');

    const targetBillboard = (STATE.currentCamera === 'orbit') ? 0.0 : 1.0;
    new TWEEN.Tween(STATE)
        .to({ billboardFactor: targetBillboard }, 1500)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

    let targetPos = { x: 0, y: 0, z: 0 };
    let targetLook = { x: 0, y: 0, z: 0 };
    const tweenDuration = 1500;
    const lookDist = 100;

    if (STATE.currentCamera === 'turbine-1') {
        targetPos = { x: 3.84, y: 10.26, z: 117.86 };
        const dir = { x: -0.25, y: 0.16, z: -0.95 };
        targetLook = {
            x: targetPos.x + (dir.x * lookDist),
            y: targetPos.y + (dir.y * lookDist),
            z: targetPos.z + (dir.z * lookDist)
        };
    } else if (STATE.currentCamera === 'turbine-2') {
        targetPos = { x: -6.11, y: 57.59, z: 79.65 };
        const dir = { x: 0.45, y: -0.30, z: -0.84 };
        targetLook = {
            x: targetPos.x + (dir.x * lookDist),
            y: targetPos.y + (dir.y * lookDist),
            z: targetPos.z + (dir.z * lookDist)
        };
    } else if (STATE.currentCamera === 'turbine-3') {
        targetPos = { x: 2.60, y: 102.48, z: 82.92 };
        const dir = { x: -0.05, y: -0.81, z: -0.58 };
        targetLook = {
            x: targetPos.x + (dir.x * lookDist),
            y: targetPos.y + (dir.y * lookDist),
            z: targetPos.z + (dir.z * lookDist)
        };

        //Setup configuration fixed view 3, disable auto time cycle and set to 12:00, enable wind vector field and spline, set wind mode to spline

        STATE.autoTime = false;
        if (UI.elements.autoTimeCheck) {
            UI.elements.autoTimeCheck.checked = false;
        }

        STATE.timeOfDay = 12.0;
        UI.syncTimeSlider(12.0);
        UI.updateTimeValueText(12.0);

        if (!STATE.showWindVectorField) {
            toggleWindVectorField();
        }

        STATE.showSpline = true;
        if (UI.elements.splineCheck) {
            UI.elements.splineCheck.checked = true;
        }
        if (typeof splineHelper !== 'undefined' && splineHelper) {
            splineHelper.visible = STATE.showSpline && STATE.windMode === 'spline';
        }
    }
    else if (STATE.currentCamera === 'orbit') {
        targetPos = { x: 0, y: 40, z: 100 };
        targetLook = { x: 0, y: 39.971, z: 99.904 };
    }

    new TWEEN.Tween(camera.position)
        .to(targetPos, tweenDuration)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

    new TWEEN.Tween(controls.target)
        .to(targetLook, tweenDuration)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();


    updateWindAudio();
}

// Global day/night interpolation
function updateDayNightCycle(dt) {
    if (STATE.autoTime) {
        STATE.timeOfDay += dt * 0.15;
        if (STATE.timeOfDay >= 24) STATE.timeOfDay = 0;
        if (typeof UI !== 'undefined') {
            UI.updateTimeValueText(STATE.timeOfDay);
            UI.syncTimeSlider(STATE.timeOfDay);
        }
    }

    const angle = (STATE.timeOfDay / 24) * Math.PI * 2 - Math.PI / 2;
    const radius = 150;
    sunLight.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        30
    );

    let mixDay = 0, mixSunset = 0, mixNight = 0;
    const time = STATE.timeOfDay;

    // night -> sunset 4-6, sunset -> day 6-8
    // day -> sunset 16-18, sunset -> night 18-20
    if (time >= 4.0 && time < 6.0) {
        const f = (time - 4.0) / 2.0;
        mixNight = 1.0 - f;
        mixSunset = f;
    } else if (time >= 6.0 && time < 8.0) {
        const f = (time - 6.0) / 2.0;
        mixSunset = 1.0 - f;
        mixDay = f;
    } else if (time >= 8.0 && time < 16.0) {
        mixDay = 1.0;
    } else if (time >= 16.0 && time < 18.0) {
        const f = (time - 16.0) / 2.0;
        mixDay = 1.0 - f;
        mixSunset = f;
    } else if (time >= 18.0 && time < 20.0) {
        const f = (time - 18.0) / 2.0;
        mixSunset = 1.0 - f;
        mixNight = f;
    } else {
        mixNight = 1.0;
    }

    // Publish to STATE so other modules can read the mix values
    STATE.mixDay = mixDay;
    STATE.mixSunset = mixSunset;
    STATE.mixNight = mixNight;

    if (skyboxMat) {
        skyboxMat.uniforms.mixDay.value = mixDay;
        skyboxMat.uniforms.mixSunset.value = mixSunset;
        skyboxMat.uniforms.mixNight.value = mixNight;
    }

    // Smooth lighting interpolation (using mix weightss)
    const total = mixDay + mixSunset + mixNight;
    const wD = mixDay / total;
    const wS = mixSunset / total;
    const wN = mixNight / total;

    // Canonical values for each phase
    const daySkCol = new THREE.Color(0x93c5fd);
    const sunsetSkCol = new THREE.Color(0x2d1a3c);
    const nightSkCol = new THREE.Color(0x040814);

    const dayGndCol = new THREE.Color(0x1a331a);
    const sunsetGndCol = new THREE.Color(0x1a1a10);
    const nightGndCol = new THREE.Color(0x050e18);

    const daySunCol = new THREE.Color(0xfef3c7);
    const sunsetSunCol = new THREE.Color(0xfb923c);
    const nightSunCol = new THREE.Color(0x3b82f6);

    const skyColor = new THREE.Color(
        daySkCol.r * wD + sunsetSkCol.r * wS + nightSkCol.r * wN,
        daySkCol.g * wD + sunsetSkCol.g * wS + nightSkCol.g * wN,
        daySkCol.b * wD + sunsetSkCol.b * wS + nightSkCol.b * wN
    );

    const groundColor = new THREE.Color(
        dayGndCol.r * wD + sunsetGndCol.r * wS + nightGndCol.r * wN,
        dayGndCol.g * wD + sunsetGndCol.g * wS + nightGndCol.g * wN,
        dayGndCol.b * wD + sunsetGndCol.b * wS + nightGndCol.b * wN
    );

    const sunColor = new THREE.Color(
        daySunCol.r * wD + sunsetSunCol.r * wS + nightSunCol.r * wN,
        daySunCol.g * wD + sunsetSunCol.g * wS + nightSunCol.g * wN,
        daySunCol.b * wD + sunsetSunCol.b * wS + nightSunCol.b * wN
    );

    const sunIntensity = 1.2 * wD + 0.5 * wS + 0.45 * wN;
    hemiLight.intensity = 0.8 * wD + 0.15 * wS + 0.35 * wN;

    sunLight.color.copy(sunColor);
    sunLight.intensity = sunIntensity;

    // Shadow casting: toggle off only when fully night (intensity already near 0)
    sunLight.castShadow = (mixNight < 0.95);

    scene.background.copy(skyColor);
    scene.fog.color.copy(skyColor);

    hemiLight.color.copy(skyColor);
    hemiLight.groundColor.copy(groundColor);
}

// Animation loop
let lastTime = 0;
let frameCount = 0;
let fpsTimer = 0;

function animate(now) {
    requestAnimationFrame(animate);

    if (!now) now = 0;
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    frameCount++;
    fpsTimer += dt;
    if (fpsTimer >= 1.0) {
        STATE.fps = frameCount;
        if (typeof UI !== 'undefined') {
            UI.updateFPS(STATE.fps);
        }
        frameCount = 0;
        fpsTimer = 0;
    }

    TWEEN.update();
    updateDayNightCycle(dt);

    if (grassMesh) {
        grassMesh.material.userData.uTime.value = clock.getElapsedTime();
        grassMesh.material.userData.uBillboard.value = STATE.billboardFactor;
        grassMesh.material.userData.uSigma.value = STATE.windSigmaThreshold;
    }

    if (STATE.showWindVectorField) {
        const currentTime = clock.getElapsedTime();
        if (currentTime - STATE.lastVectorUpdateTime > 0.25) {
            updateWindVectorField();
            STATE.lastVectorUpdateTime = currentTime;
        }
    }

    turbines.forEach(t => {
        t.update(dt, windVectorGlobal, STATE.windSpeed);
    });

    const windSpeedFactor = STATE.windSpeed / 100;

    // Spiral animations of leaf/petal objects along spline
    windLeaves.forEach(leaf => {
        leaf.t += dt * 0.05 * leaf.speedMultiplier * (0.1 + windSpeedFactor * 2.0);
        if (leaf.t > 1) {
            leaf.t = 0;
        }

        const position = splinePath.getPointAt(leaf.t);
        const tangent = splinePath.getTangentAt(leaf.t).normalize();
        const upTemp = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, upTemp).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

        const angle = leaf.t * Math.PI * 10 + clock.getElapsedTime() * 3.5 + leaf.oscOffset;
        const radius = 4.0 + Math.sin(clock.getElapsedTime() * 1.5 + leaf.oscOffset) * 1.5;

        const spiralX = Math.cos(angle) * radius;
        const spiralY = Math.sin(angle) * radius;

        position.y += 5.0;
        position.addScaledVector(normal, spiralX);
        position.addScaledVector(binormal, spiralY);
        position.y += Math.sin(clock.getElapsedTime() * 5.0 + leaf.oscOffset) * 0.15;

        leaf.mesh.position.copy(position);

        const targetLook = new THREE.Vector3().copy(position).add(tangent);
        leaf.mesh.lookAt(targetLook);
        leaf.mesh.rotateX(Math.PI / 2);
        leaf.mesh.rotateY(clock.getElapsedTime() * 2.0 + leaf.oscOffset);
        leaf.mesh.rotateZ(clock.getElapsedTime() * 1.5);

        leaf.mesh.scale.setScalar(leaf.randomScale);
    });

    // Wind trail animations
    windTrails.forEach(trail => {
        trail.t += dt * 0.08 * trail.speedMultiplier * (0.1 + windSpeedFactor * 2.0);
        if (trail.t > 1) {
            trail.t = 0;
        }

        const position = splinePath.getPointAt(trail.t);
        const tangent = splinePath.getTangentAt(trail.t).normalize();
        const upTemp = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, upTemp).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

        const angle = trail.t * Math.PI * 6 + trail.textureOffsetX * Math.PI * 2;
        const radius = 3.5;

        position.y += 3.5;
        position.addScaledVector(normal, Math.cos(angle) * radius);
        position.addScaledVector(binormal, Math.sin(angle) * radius);

        trail.mesh.position.copy(position);

        const targetLook = new THREE.Vector3().copy(position).add(tangent);
        trail.mesh.lookAt(targetLook);
        trail.mesh.rotateY(Math.PI / 2);

        if (trail.mesh.material.map) {
            trail.mesh.material.map.offset.x -= dt * 0.5 * (0.2 + windSpeedFactor);
        }

        let progress = trail.t;
        let opacityMult = 1.0;
        if (progress < 0.1) opacityMult = progress / 0.1;
        else if (progress > 0.9) opacityMult = (1.0 - progress) / 0.1;

        trail.mesh.material.opacity = 0.15 * opacityMult;
    });

    if (skyboxMesh) {
        skyboxMesh.position.copy(camera.position);
    }

    if (typeof UI !== 'undefined') {
        UI.toggleWindLegend(STATE.showWindVectorField);
    }

    if (STATE.currentCamera === 'orbit') {
        controls.update();
    } else {
        camera.lookAt(controls.target);
    }

    if (typeof UI !== 'undefined' && typeof UI.updateCameraInfo === 'function') {
        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        UI.updateCameraInfo(camera.position, lookDir);
    }

    renderer.render(scene, camera);
}

// Slice cross skybox textures into faces
function loadCubeTextureFromCross(url, callback) {
    loadingManager.itemStart(url); // this to say to the manager to start download

    const img = new Image();
    img.src = url;
    img.onload = () => {
        const w = img.width;
        const faceSize = w / 4;
        const canvases = [];

        const faceCoords = [
            { x: 2, y: 1 },
            { x: 0, y: 1 },
            { x: 1, y: 0 },
            { x: 1, y: 2 },
            { x: 1, y: 1 },
            { x: 3, y: 1 }
        ];

        for (let i = 0; i < 6; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = faceSize;
            canvas.height = faceSize;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(
                img,
                faceCoords[i].x * faceSize, faceCoords[i].y * faceSize, faceSize, faceSize,
                0, 0, faceSize, faceSize
            );
            canvases.push(canvas);
        }

        const cubeTex = new THREE.CubeTexture(canvases);
        cubeTex.needsUpdate = true;

        if (callback) {
            callback(cubeTex);
        }

        loadingManager.itemEnd(url);
    };

    img.onerror = () => {
        loadingManager.itemError(url);
        loadingManager.itemEnd(url);
    };
}