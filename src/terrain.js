// terrain height calculation function
function getTerrainHeight(x, z) {
    let y = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 12;
    y += Math.sin(x * 0.05) * 3;
    y += Math.cos(z * 0.08) * 1.5;

    const distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter > 100) {
        const factor = Math.min((distFromCenter - 100) / 50, 1);
        y -= factor * 15;
    }
    return y;
}

// rock class for loading and positioning rock models
class Rock {
    constructor(type, x, y, z, scale = 1.0, rotY = 0.0) {
        this.type = type;
        this.scale = scale;
        this.posWorld = new THREE.Vector3(x, y, z);

        this.group = new THREE.Group();
        this.group.position.copy(this.posWorld);
        this.group.scale.set(scale, scale, scale);
        this.group.rotation.y = rotY;

        const typeStr = this.type.toString().padStart(2, '0');
        const modelPath = `models/rock${typeStr}.glb`;
        const textureKey = `SM_LittleRock_${typeStr}`;
        const currentTextureSet = rockTextures[this.type][textureKey];

        gltfLoader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
                model.traverse((child) => {
                    if (child.isMesh) {
                        if (currentTextureSet) {
                            child.material = new THREE.MeshStandardMaterial({
                                map: currentTextureSet.map,
                                normalMap: currentTextureSet.normalMap,
                                metalnessMap: currentTextureSet.metalnessMap,
                                roughnessMap: currentTextureSet.roughnessMap,
                                metalness: 0.0,
                                roughness: 0.8,
                                envMapIntensity: 1.2
                            });
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                this.group.add(model);
                scene.add(this.group);
            },
            undefined,
            (error) => { console.error(`Error loading rock type ${this.type}:`, error); }
        );
    }
}

// populate the landscape with rocks
function createRocks() {
    new Rock(2, -28, 6.5, 36, 5.5, 0.0);
    new Rock(2, 4, 4.1, -22, 3.5, 1.2);
    new Rock(3, -11, -10.0, 27, 3.5, 3.14);
    new Rock(4, 50, 6.5, -31, 3.5, 2.5);
    new Rock(5, -46, -10.2, 22, 3.5, 0.8);
    new Rock(6, -35, -11.0, -7, 3.5, 4.2);

    new Rock(2, -35, 6.0, -7, 5.5, 0.0);
    new Rock(2, -46, -10.2, 22, 3.5, 1.2);
    new Rock(3, 50, 6.5, -31, 3.5, 3.14);
    new Rock(4, -11, -10.0, 27, 3.5, 2.5);
    new Rock(5, 4, -1, -22, 3.5, 0.8);
    new Rock(6, -28, -2, 36, 3.5, 4.2);
}
