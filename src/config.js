// Global variables and configuration state
let audioListener, windSound, grassSound, turbineSound;
let beaconGlowTexture;

// Loading gate flags – the loading screen hides only when BOTH are true
let isAssetsLoaded = false;
let isAppInitialized = false;

function checkAndHideLoadingScreen() {
    if (!isAssetsLoaded || !isAppInitialized) return;

    clearTimeout(loadingTimeout);
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen && !loadingScreen.classList.contains('fade-out')) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 800);
    }
}

// initializing global LoadingManager
const loadingManager = new THREE.LoadingManager();

// if loading time > 90s, automatic unlock of the scene
let loadingTimeout = setTimeout(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen && !loadingScreen.classList.contains('fade-out')) {
        console.warn('too much time used: automatic unlock of the scene.');
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 800);
    }
}, 90000);

loadingManager.onStart = function (url, itemsLoaded, itemsTotal) {
    // possible strarting log
};

loadingManager.onLoad = function () {
    isAssetsLoaded = true;
    checkAndHideLoadingScreen();
};

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const percent = Math.round((itemsLoaded / itemsTotal) * 100);
    const progressBar = document.getElementById('loader-bar');
    const percentText = document.getElementById('loader-percentage');
    const statusText = document.getElementById('loader-status');

    if (progressBar) progressBar.style.width = percent + '%';
    if (percentText) percentText.innerText = percent + '%';

    if (statusText) {
        // show file names from url
        const filename = url.substring(url.lastIndexOf('/') + 1);
        statusText.innerText = `loading of ${filename}...`;
    }
};

loadingManager.onError = function (url) {
    console.warn('Error during the loading of the resource: ' + url);
};

const gltfLoader = new THREE.GLTFLoader(loadingManager);
const textureLoader = new THREE.TextureLoader(loadingManager);

// Turbine textures configuration
const turbineTextures = {
    Foundation: {
        map: textureLoader.load('textures/Foundation_COL.png'),
        metalnessMap: textureLoader.load('textures/Foundation_METALLIC.png'),
        normalMap: textureLoader.load('textures/Foundation_NORMAL.png'),
        roughnessMap: textureLoader.load('textures/Foundation_ROUGH.png')
    },
    Hub: {
        map: textureLoader.load('textures/Hub_COL.png'),
        metalnessMap: textureLoader.load('textures/Hub_METALLIC.png'),
        normalMap: textureLoader.load('textures/Hub_NORMAL.png'),
        roughnessMap: textureLoader.load('textures/Hub_ROUGH.png')
    },
    Rotor: {
        map: textureLoader.load('textures/Rotor_COL.png'),
        metalnessMap: textureLoader.load('textures/Rotor_METALLIC.png'),
        normalMap: textureLoader.load('textures/Rotor_NORMAL.png'),
        roughnessMap: textureLoader.load('textures/Rotor_ROUGH.png')
    },
    Tower: {
        map: textureLoader.load('textures/Tower_COL.png'),
        metalnessMap: textureLoader.load('textures/Tower_METALLIC.png'),
        normalMap: textureLoader.load('textures/Tower_NORMAL.png'),
        roughnessMap: textureLoader.load('textures/Tower_ROUGH.png')
    }
};

// Apply correct encoding and settings to textures
Object.values(turbineTextures).forEach(set => {
    Object.keys(set).forEach(key => {
        const texture = set[key];
        if (texture) {
            texture.flipY = false;
            if (key === 'map') {
                texture.encoding = THREE.sRGBEncoding;
            }
        }
    });
});

// Old windmill textures
const oldWindmillTextures = {
    Hub: {
        map: textureLoader.load('textures/Windmill_Dpng.png'),
        aoMap: textureLoader.load('textures/Windmill_OCCpng.png'),
        normalMap: textureLoader.load('textures/Windmill_Npng.png'),
        displacementMap: textureLoader.load('textures/Windmill_DISPpng.png')
    },
    Rotor: {
        map: textureLoader.load('textures/Windmill_Dpng.png'),
        aoMap: textureLoader.load('textures/Windmill_OCCpng.png'),
        normalMap: textureLoader.load('textures/Windmill_Npng.png'),
        displacementMap: textureLoader.load('textures/Windmill_DISPpng.png')
    },
    Tower: {
        map: textureLoader.load('textures/Windmill_Dpng.png'),
        aoMap: textureLoader.load('textures/Windmill_OCCpng.png'),
        normalMap: textureLoader.load('textures/Windmill_Npng.png'),
        displacementMap: textureLoader.load('textures/Windmill_DISPpng.png')
    }
};

Object.values(oldWindmillTextures).forEach(set => {
    Object.keys(set).forEach(key => {
        const texture = set[key];
        if (texture) {
            texture.flipY = false;
            if (key === 'map') {
                texture.encoding = THREE.sRGBEncoding;
            }
        }
    });
});

// Rock textures mapping
const rockTextures = {};
for (let i = 1; i <= 6; i++) {
    const num = i.toString().padStart(2, '0');
    rockTextures[i] = {
        [`SM_LittleRock_${num}`]: {
            map: textureLoader.load(`textures/T_LittleRock_${num}_GreenMoss_BaseColor.png`),
            normalMap: textureLoader.load(`textures/T_LittleRock_${num}_GreenMoss_Normal.png`),
            metalnessMap: textureLoader.load(`textures/T_LittleRock_${num}_GreenMoss_Metallic.png`),
            roughnessMap: textureLoader.load(`textures/T_LittleRock_${num}_GreenMoss_Roughness.png`)
        }
    };
}

// Ensure proper settings on rock textures
Object.values(rockTextures).forEach(rockType => {
    Object.values(rockType).forEach(set => {
        Object.keys(set).forEach(key => {
            const texture = set[key];
            if (texture) {
                texture.flipY = false;
                if (key === 'map') texture.encoding = THREE.sRGBEncoding;
            }
        });
    });
});

// Global state configuration
const STATE = {
    windMode: 'global',
    windSpeed: 40,
    windDirection: 0,
    timeOfDay: 12,
    autoTime: true,
    showSpline: true,
    currentCamera: 'turbine-1',
    fps: 0,
    showWindVectorField: false,
    vectorArrowGroup: null,
    lastVectorUpdateTime: 0,
    windSigmaThreshold: 35,
    isMuted: false,
    billboardFactor: 0.0,
    mixDay: 0.0,
    mixSunset: 0.0,
    mixNight: 1.0
};

const windVectorGlobal = new THREE.Vector3(0, 0, -1);

// Scene elements references
let scene, camera, renderer, controls;
let terrain, grassMesh, grassGeo, splinePath, splineHelper;
let windLeaves = [];
let windTrails = [];
let turbines = [];
let sunLight, hemiLight;
let leafTexture, petalTexture, flowerTexture, windTexture;
let clock = new THREE.Clock();
let skyboxMesh, skyboxMat;