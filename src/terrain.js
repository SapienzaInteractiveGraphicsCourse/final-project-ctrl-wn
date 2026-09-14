// terrain height calculation function
function getTerrainHeight(x, z) { //Questa funzione calcola l'altezza esatta Y del terreno in qualsiasi coordinata bidimensionale XZ della mappa. Viene utilizzata sia per generare la mesh geometrica del terreno, sia per posizionare erba, rocce e turbine alla giusta altezza.
    //L'altitudine iniziale viene determinata tramite la sovrapposizione di tre onde sinusoidali e cosinusoidali
    let y = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 12; //Onde primarie: Creano la macro-struttura delle colline con ampiezza massima di 12 metri e una frequenza molto bassa (0.02)
    y += Math.sin(x * 0.05) * 3; //Onde secondarie: Aggiungono dislivelli intermedi (ampiezza 3 metri, frequenza 0.05).
    y += Math.cos(z * 0.08) * 1.5; //Onde terziarie: Generano una micro-rugosità superficiale per evitare che il terreno appaia perfettamente liscio (ampiezza 1,5 metri, frequenza 0.08).

    const distFromCenter = Math.sqrt(x * x + z * z); //Tramite il teorema di Pitagora, viene calcolata la distanza radiale del punto dal centro della mappa (0,0)
    if (distFromCenter > 100) { //Se la distanza supera i 100 metri:
        //il codice calcola un fattore di transizione lineare (factor) che va da 0 a 1 nell'arco dei successivi 50 metri (fino a raggiungere il bordo massimo a 150 metri).
        const factor = Math.min((distFromCenter - 100) / 50, 1); 
        //L'altezza y viene ridotta progressivamente fino a un massimo di 15 metri (factor * 15). Questa operazione crea una scarpata/depressione lungo i bordi della mappa, impedendo che i confini del terreno fluttuino nel vuoto rispetto allo sfondo scuro del cielo.
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
