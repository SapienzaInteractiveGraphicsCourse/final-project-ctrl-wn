// spline generation and wind simulation logic


function createWindSpline() {
    /////////////////////////////////////// sto blocco elimina le vecchie spline vvv
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
    ///////////////////////////////////////// sto blocco elimina le vecchie spline ^^
    const pointsArray = [];
    const numPoints = 9;
    const startX = -130;
    const endX = 130;
    const stepX = (endX - startX) / (numPoints - 1);

    const startZ = (Math.random() - 0.5) * 160;
    const endZ = (Math.random() - 0.5) * 160;
    const splineHeightOffset = 1.2;

    /////////////////////////////////////////// qui ti crei i punti della spline VVV
    for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1); //t è valore che è sempre o 0 o 1 
        const x = startX + i * stepX; //x aumenta ogni volta di tot per indicare i passo
        const linearZ = THREE.MathUtils.lerp(startZ, endZ, t); //lerp serve per trovare un valore dopo startZ e prima di endZ. se t=0.5 allora prendi un punto in mezzo, se t sta tra 0 e 0.5 allora prendi un punto nella prima metà, se tsta tra 0.5 e 1 allora prendi un valore nella seconda meta
        const deviazZ = (i > 0 && i < numPoints - 1) ? (Math.random() - 0.5) * 110 : 0;
        const z = linearZ + deviazZ;
        const y = getTerrainHeight(x, z) + splineHeightOffset;
        pointsArray.push(new THREE.Vector3(x, y, z));//con coordinate x y e z di ogni punto, aggiungi la terna a sto array di punti, che sarà sto vector 3 di js
    } 
    /////////////////////////////////////////// qui ti crei i punti della spline ^^^
    splinePath = new THREE.CatmullRomCurve3(pointsArray); //aggiunti la lista/array di vettori vec3 al CatmullRomCurve che sarebbe la spline come si fa su Three.js
    //cosi fai la spline ^^^

    //ora vogliamo renderizzare la spline:
    const points = splinePath.getPoints(100); //ti prendi 100 punti della spline
    const geometry = new THREE.BufferGeometry().setFromPoints(points); //ti crei una primitiva aka i punti effettivi ma in forma geometrica perche in trhee js devi definire la "geometria" tipo se è un punto, una linea, una spline ecc. In sto caso definisci come geometria tutti i punti
    const material = new THREE.LineBasicMaterial({ //materiale/colore della spline
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.6,
        linewidth: 3
    });
    splineHelper = new THREE.Line(geometry, material); //tipo qui crei tante linee, ogni linea è di un materiale e va da un punto all'altro. I punti stanno dentro "geometry"

    // only show if both toggles are true //qui dici se il toggle della visibilita della spline è attivo o no
    splineHelper.visible = STATE.showSpline && STATE.windMode === 'spline';
    scene.add(splineHelper);
    //qui vediamo i petali
    const leafCount = 40; //sono sempre 40 petali renderizzabili
    const leafGeo = new THREE.PlaneGeometry(1.2, 1.2); //geometria del petalo, con three js facciamo un piano di ste dimensioni
    const leafMat = new THREE.MeshStandardMaterial({ //poi col materiale di sto plane, gli applichiamo la texture del petalo con i parametri
        map: petalTexture,
        transparent: true, //se è png, la parte trasparente è trasparente
        alphaTest: 0.15,
        side: THREE.DoubleSide, //double side aka texture sia davanti che dietro
        depthWrite: false, //renderizzi anche il "dietro non visibile" del petalo
        roughness: 0.6,
        metalness: 0.1
    });
    //qui cicli tutte le foglie
    for (let i = 0; i < leafCount; i++) {
        const mesh = new THREE.Mesh(leafGeo, leafMat); //ti crei la mesh con geometria della foglia e del materiale
        mesh.castShadow = true; //le foglie possono generare ombre
        mesh.receiveShadow = true; //le foglie possono essere oscurate
        scene.add(mesh); //aggiunti la singola foglia in scena

        windLeaves.push({ //il riferimento di ste foglie lo metti in un array, poi windLeaves lo animi con app.js 
            mesh: mesh,
            t: i / leafCount,
            speedMultiplier: 0.8 + Math.random() * 0.4,
            randomScale: 0.7 + Math.random() * 0.6,
            oscOffset: Math.random() * Math.PI * 2
        }); //dentro windleavers, salvi i parametri di ogni foglia, perche ogni petalo ha parametri diversi
    } //ogni petalo si muove a spirale, un oparametro del petalo è la mesh, un parametro del petalo è t aka parametro di interpolazione tra 0 e 1
    //speedMultiplier è valore random che divi quanto la foglia va veloce
    //random scale per grandezza della foglia singola, e oscOffset è quanto il piano/foglia è inclinata

    // disabling it for now. need to figure out how to implement the trail along the spline.
    // createWindTrails();

    if (STATE.showWindVectorField) {
        updateWindVectorField(); //controllo per vedere se il vector field è attivo, se non lo è lo attivi. Se qualcuno attiva il campo vettoriale quindi setuppa tutto quello visto prima + sta funzione
    }
}

/*
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
*/

// use distanceToSquared instead of distanceTo to avoid heavy root nodes
// this is much better because it avoids slow Math.sqrt

//qui per calcolare la distanza posizione - punto + vicino della spline, per non controllare tutti gli infinit punti, dividi la spline in 100 punti
function findClosestSplinePoint(pos, spline, steps = 100) { //funzione per trovare i punti + vicini  degli elementi
    let minDistanceSq = Infinity;
    let bestT = 0;

    for (let i = 0; i <= steps; i++) { //di tutti i 100 punti della spline
        const t = i / steps;
        const pt = spline.getPointAt(t);
        const distSq = pos.distanceToSquared(pt); //si calcola la distanza al quadrato aka pitagora ma senza la radice perche la radice è calcolo pesante, la distanza se è la piu minore, quel punto diventa quello + vicino che ci serve
        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            bestT = t;
        }
    }
    return bestT;
}

// Vector field rendering and toggles  //semplicemente quando clicchi il tasto del vector field, spegne/dsabilita l'erba
function toggleWindVectorField() {
    STATE.showWindVectorField = !STATE.showWindVectorField;
    if (typeof UI !== 'undefined') {
        UI.syncShowWindVectors(STATE.showWindVectorField);
    }

    if (STATE.showWindVectorField) {
        grassMesh.visible = false;
        createWindVectorField(); //quindi attivi la modalita "campo vettoriale"
    } else {
        grassMesh.visible = true;
        destroyWindVectorField(); //altrimenti se disattivi, elimini il campo vettoriale, non serve piu in memoria
    }
}


//qui ci sono tutti i vettori del campo vettoriale
function createWindVectorField() {
    if (STATE.vectorArrowGroup) {
        scene.remove(STATE.vectorArrowGroup); //elimini tutti i vettori
        STATE.vectorArrowGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose(); //elimini tutti i vettori
            if (obj.material) obj.material.dispose(); //elimini tutti i vettori
        });
        STATE.vectorArrowGroup = null; //con three js crei un gruppo di vettori, da mettere nello state
    }

    STATE.vectorArrowGroup = new THREE.Group();
    //per creare griglia di vettori, ci saranno 16*14 vettori
    const gridCols = 16; 
    const gridRows = 14;
    const range = 180;
    const spacingX = (range * 2) / (gridCols - 1);
    const spacingZ = (range * 2) / (gridRows - 1);
    const elevationOffset = 1.0;

    let cachedClosestT = {};
    const getCachedClosestSplinePoint = (pos) => { //per ogni vettore prendi punto + vicino della spline, ma se il punto è vicino allora arrotondi il valore trovato
        const key = Math.round(pos.x) + ',' + Math.round(pos.z);
        if (!cachedClosestT[key]) {
            cachedClosestT[key] = findClosestSplinePoint(pos, splinePath);
        }
        return cachedClosestT[key];
    };

    for (let row = 0; row < gridRows; row++) { //per ogni riga
        for (let col = 0; col < gridCols; col++) {//per ogni colonna
            const x = -range + col * spacingX;
            const z = -range + row * spacingZ;
            //definisci positizione del vettore nel mondo, con direzione del vento e intensita
            const y = getTerrainHeight(x, z);
            const posWorld = new THREE.Vector3(x, y, z);

            let windDir, windIntensity;

            if (STATE.windMode === 'global') { //se il flow è unidirezionale, allora pèrendi valore della direzione, lo nromalizzi e dividi per 100 la velocita dell'intensità
                windDir = windVectorGlobal.clone().normalize();
                windIntensity = STATE.windSpeed / 100;
            } else { //altrimenti se il flow è locale, allora per ogni vettore ti peschi il vettore tangente vicino della spline e la direzione di quel vettore tangente sarà la direzione che vogliamo
                const tClosest = getCachedClosestSplinePoint(posWorld);
                windDir = splinePath.getTangentAt(tClosest).normalize();

                const pointOnSpline = splinePath.getPointAt(tClosest); //posizione punto della spline e ti serve 
                const distFromSpline = posWorld.distanceTo(pointOnSpline); //distanza dal punto della spline al vettore

                const sigma = STATE.windSigmaThreshold; //sigma è valore della trheshold nello state, cioe quanto influenza la spline quell'elemento. se elemento è troppo lontano, è poco influenzato dalla spline
                windIntensity = (STATE.windSpeed / 100) * //è funzione gaussiana, cioe per sigma piu ti allontani, piu sei influenzato meno esplonzialmente
                    Math.exp(-(distFromSpline * distFromSpline) / (2 * sigma * sigma));
            } //sigma + piccolo = + inflienzato. - piccolo = - fluenzato

            const arrowLength = windIntensity * 10; //visivamente l'array è colorato e lungo tot, per cui per mostrare quando è lungo facciamo la sua velocità * 10 e sarà la lunghezza array
            const color = getColorForWindIntensity(windIntensity);
            //colore dell'array, in base al varlore dell'intensità, scegli colore che va dal rosso al blu
            const arrow = new THREE.ArrowHelper( //con arrowhelper di threejs hai definizione vettore
                windDir,
                new THREE.Vector3(x, y + elevationOffset, z),
                Math.max(arrowLength, 0.4),
                color,
                arrowLength * 0.35,
                arrowLength * 0.25
            );
            //creato il singolo vettore, lo aggiugi al vector arrowgroup
            STATE.vectorArrowGroup.add(arrow);
        }
    }

    scene.add(STATE.vectorArrowGroup); //quindi aggiungi vectorarrowgroup alla scena alla fine
}

function updateWindVectorField() {
    if (!STATE.showWindVectorField || !STATE.vectorArrowGroup) return;
    createWindVectorField(); //se è cambaito qualcosa,, ti ricrea il campo vettoriale
}

function destroyWindVectorField() { //cancelli il campo vettoriale
    if (STATE.vectorArrowGroup) {
        scene.remove(STATE.vectorArrowGroup);
        STATE.vectorArrowGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        STATE.vectorArrowGroup = null;
    }
}

function getColorForWindIntensity(intensity) { //cambia il colore in base all'intensità
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