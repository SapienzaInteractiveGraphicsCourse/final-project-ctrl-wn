// Global variables and configuration state
let audioListener, windSound, grassSound, turbineSound;

const gltfLoader = new THREE.GLTFLoader();
const textureLoader = new THREE.TextureLoader();

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
    currentCamera: 'orbit',
    fps: 0,
    showWindVectorField: false,
    vectorArrowGroup: null,
    lastVectorUpdateTime: 0,
    windSigmaThreshold: 35,
    isMuted: false,
    billboardFactor: 0.0
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