// wind turbine classes and initialization

//spiegare rotore e hub per la rotazione, spiegazione gerarchia

class WindTurbine { // interamente dedicato alla definizione, alla logica di simulazione fisica e alla disposizione nello spazio delle turbine eoliche presenti nell'applicazione.
    constructor(x, z, scale = 1.0) {//coordinate x e z della pala eolica le dici te, mentre y è sempre l'altezza del terreno + offset
        this.scale = scale; //yaw =  logica di orientamento (yaw)
        this.currentYaw = 0; //currentYaw e targetYaw per l'inbardata della navicella
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

        // there is the obstacle warning light (red blinking beacon) for the planes and for illumination during the night time
        // this.beaconLightMat = new THREE.MeshBasicMaterial({ color: 0x330000 });

        //beacon aka le luci di segnalazione
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

        // setup the glow size
        this.glowSprite1.scale.set(glowSize, glowSize, 1);
        this.glowSprite2.scale.set(glowSize, glowSize, 1);

        //caricamento del modello 3d della pala eolica con la funzione load, applicando anche le texture ecc +  personalizzazione grafica + estrazione dei componenti fisici e l'assemblaggio delle luci di segnalazione del modello 3D della turbina eolic
        gltfLoader.load(
            'models/modello_turbina_final_v3.glb', //primo parametro = il percorso del file.

            /////////////////////////////////////////////inizio secondo parametro

            (gltf) => {
                const model = gltf.scene;
                model.traverse((child) => {
                    if (child.isMesh) { // Verifica se il nodo analizzato contiene della geometria reale (child.isMesh).
                        let partKey = null;
                        if (child.name.includes('Foundation')) partKey = 'Foundation'; //con child name, vedi il nome del noodo a quale parte della turbina appartine.e
                        //cioe, Tramite il nome del nodo (child.name), riconosce a quale macro-area della turbina appartiene (Fondazione, Navicella, Pale o Torre).
                        else if (child.name.includes('Hub')) partKey = 'Hub';
                        else if (child.name.includes('Rotor')) partKey = 'Rotor';
                        else if (child.name.includes('Tower')) partKey = 'Tower';

                        /*
                        Sostituzione del materiale base del modello 3d con le texture corrette: Se viene identificata una parte e sono presenti le relative texture in config.js (turbineTextures), 
                        il codice sostituisce il materiale di base incorporato nel file GLTF con un nuovo THREE.MeshStandardMaterial. 
                        Questo materiale supporta l'illuminazione fisica (PBR) e mappa accuratamente i canali del colore (map), 
                        della metallicità (metalnessMap), delle micro-rilevanze geometriche (normalMap) e della dispersione della luce (roughnessMap).
                        */
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
                        //Imposta castShadow e receiveShadow a true per fare in modo che la turbina proietti ombre realistiche sul terreno (e su se stessa) e ne riceva da altri oggetti.
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                //Il codice esegue un secondo ciclo di scansione per isolare e memorizzare i tre componenti mobili principali all'interno delle variabili di riferimento di WindTurbine (tower, hub e rotor) della classe:
                model.traverse((child) => {
                    //Salvare questi riferimenti è fondamentale: senza di essi, il metodo update() chiamato ad ogni frame non potrebbe sapere quali parti specifiche del modello 3D deve ruotare (le pale sull'asse Z o la navicella sull'asse Y per l'imbardata).
                    if (child.name.includes('Tower')) this.tower = child;
                    if (child.name.includes('Hub')) this.hub = child;
                    if (child.name.includes('Rotor')) this.rotor = child;
                }); //Rispetto al classico .add(), .attach() sposta l'oggetto all'interno del nuovo genitore nella gerarchia della scena senza alterarne la posizione, rotazione e scala globali correnti. In questo modo, quando la navicella ruota per seguire il vento, il rotore e le sue pale girano solidalmente con essa nello spazio 3D senza bisogno di complessi calcoli manuali di posizionamento.

                //Il rotore (le pale) viene agganciato direttamente all'hub (la navicella superiore) tramite il metodo .attach().
                if (this.hub && this.rotor) {//se esistono
                    this.hub.attach(this.rotor); //Il rotore (le pale) viene agganciato direttamente all'hub (la navicella superiore) tramite il metodo .attach()
                } // viene usato attach perche, rispetto al classico .add(), .attach() sposta l'oggetto all'interno del nuovo genitore nella gerarchia della scena senza alterarne la posizione, rotazione e scala globali correnti. In questo modo, quando la navicella ruota per seguire il vento, il rotore e le sue pale girano solidalmente con essa nello spazio 3D senza bisogno di complessi calcoli manuali di posizionamento.

                if (this.hub) { //Se la navicella (this.hub) è presente, vengono posizionati e agganciati i fari di segnalazione rossi per il volo notturno:
                    this.beaconMesh1.position.set(5.03, 13, -13.54); //height was 12.95
                    this.beaconPointLight1.position.set(5.03, 13.5, -13.54); //height was 13.45
                    this.glowSprite1.position.set(5.03, 13.5, -13.54); //è uno sprite e non plane perche si orienta verso la telecamera

                    this.beaconMesh2.position.set(-5.03, 13, -13.54); //height was 12.95
                    this.beaconPointLight2.position.set(-5.03, 13.5, -13.54); //height was 13.45
                    this.glowSprite2.position.set(-5.03, 13.5, -13.54);

                    //Collegamento dei componenti fisici e visivi alla navicella(hub)
                    //Successivamente, vengono aggiunti direttamente come figli della navicella (this.hub.add(...)). Questo fa sì che, seguendo le leggi della gerarchia 3D, quando la navicella ruota per orientarsi verso il vento, anche le luci e i loro bagliori si spostino e ruotino allineandosi, senza rischiare di rimanere fluttuanti nel vuoto.
                    this.hub.add(this.beaconMesh1);
                    this.hub.add(this.beaconPointLight1);
                    this.hub.add(this.glowSprite1);

                    this.hub.add(this.beaconMesh2);
                    this.hub.add(this.beaconPointLight2);
                    this.hub.add(this.glowSprite2);
                }

                this.group.add(model); //Infine, l'intero modello GLTF elaborato viene inserito all'interno del gruppo tridimensionale dell'istanza (this.group).
                scene.add(this.group); //Il gruppo viene registrato e aggiunto all'interno della scena principale di Three.js (scene.add()), rendendolo ufficialmente visibile a schermo durante la fase di rendering.
            }, //prima scarichi il modello, poi con gltf usi la funzione di callback eseguita solo se il file è stato scaricato

            /////////////////////////////////////////////fine secondo parametro, aka la funzione di callback eseguita solo quando il file è stato scaricato e letto con successo
            //in pratica è una callback perché: non la chiami tu direttamente; la chiama loader.load() quando il caricamento termina
            undefined, //monitoraggio e stato di avanzamento
            (error) => { console.error("Error loading modern turbine GLTF:", error); } //gestisce errori di caricamento (es. file mancante), mostrandoli in console.
        );
    }

    //Il metodo update gestisce la simulazione fisica della turbina in tempo reale.
    //Ad ogni frame, riceve l'intervallo di tempo trascorso dall'ultimo frame(dt, delta time),
    //il vettore di direzione globale del vento(windDirectionVec) e l'intensità del vento globale (globalSpeedPercent).

    /*
    Questo metodo si concentra su due tipi di movimento rotatorio fisicamente complessi:
    La rotazione delle pale (Rotore) sul proprio asse locale Z
    L'orientamento della navicella (Imbardata o Yaw) sull'asse verticale Y per allinearsi alla direzione del vento.
    */
    update(dt, windDirectionVec, globalSpeedPercent) {
        if (!this.hub || !this.rotor) return;

        let localSpeed = globalSpeedPercent;
        let windDirRad = 0;

        //Fase 1: Calcolo della provenienza e dell'intensità del vento locale
        //Prima di calcolare le rotazioni, la turbina deve determinare la direzione angolare del vento (windDirRad, in radianti) e la sua velocità locale (localSpeed):
        if (STATE.windMode === 'global') { //proiezione suasse x e y
            windDirRad = Math.atan2(windDirectionVec.x, windDirectionVec.z); //IN MODALITA GLOBAL CIOE NO SPLINE Converte il vettore bidimensionale del vento del piano XZ (sia esso globale o la tangente della spline) in un angolo espresso in radianti.
        } else {
            const tClosest = findClosestSplinePoint(this.posWorld, splinePath);
            const tangent = splinePath.getTangentAt(tClosest).normalize();
            windDirRad = Math.atan2(tangent.x, tangent.z);

            const splinePoint = splinePath.getPointAt(tClosest);
            const distance = this.posWorld.distanceTo(splinePoint);
            const sigma = STATE.windSigmaThreshold; //siigma serve per la curva a campana di gauss cosi che se ti allontani il valore/decadimento aumenta esponenzialmente 
            const factor = Math.exp(-(distance * distance) / (2 * sigma * sigma));
            localSpeed = globalSpeedPercent * factor;
        } //IN MODALITA LOCAL CIOE CON LE SPLINE Decadimento Gaussiano (solo in modalità Spline): Calcola la distanza spaziale tra la turbina e il punto più vicino della spline del vento. Più la turbina è lontana dal tracciato del vento, più la sua velocità locale (localSpeed) viene ridotta tramite una campana di Gauss.

        //Fase 2: La rotazione delle pale (Asse locale Z)
        //La rotazione del rotore simula l'inerzia meccanica delle pale e i limiti imposti dai sistemi di sicurezza degli aerogeneratori reali.
        // standard operational limits
        let targetRotorSpeed = 0;
        if (localSpeed < 10) {
            targetRotorSpeed = 0;
        } else if (localSpeed > 90) {
            targetRotorSpeed = 0; // aerodynamic safety brake
        } else {
            targetRotorSpeed = (localSpeed / 100) * 2.8;
        }

        //Le pale reali pesano tonnellate e non possono raggiungere all'istante la velocità di rotazione del vento. Il codice simula l'inerzia con questa equazione di interpolazione lineare:
        this.currentRotorSpeed += (targetRotorSpeed - this.currentRotorSpeed) * dt * 2;
        //Ad ogni frame, la velocità attuale (currentRotorSpeed) si avvicina a quella ideale (targetRotorSpeed)
        //di una frazione proporzionale al tempo trascorso(dt) moltiplicato per un coefficiente di accelerazione(2).
        //Ciò produce una transizione fluida e realistica sia in accelerazione che in frenata.


        //Una volta ottenuta la velocità di rotazione istantanea (espressa in radianti al secondo), il codice calcola lo spostamento angolare accumulato tramite l'integrazione numerica di Eulero:
        /*Lo spostamento angolare DeltaTeta effettuato nel singolo frame è pari a DeltaTeta = omega * dt
        (velocità angolare omerga moltiplicata per il tempo dt).*/
        this.rotorAngle += this.currentRotorSpeed * dt; 
        //Questo spostamento viene aggiunto all'angolo cumulativo (rotorAngle).

        //Infine, l'angolo viene applicato alla proprietà rotation.z del modello 3D del rotore. Le pale girano fluidamente attorno all'asse di rotazione orizzontale della navicella.
        this.rotor.rotation.z = this.rotorAngle;


        //Fase 3: L'imbardata o Yaw (Rotazione sull'asse Y per seguire il vento)
        //La navicella superiore deve ruotare per fare in modo che il disco del rotore sia 
        //sempre perpendicolare alla direzione del vento.Questa rotazione avviene sull'asse verticale Y
        this.targetYaw = windDirRad;


        //Calcolo del percorso minimo (La risoluzione del salto di angolo)
        //La rotazione presenta una sfida matematica legata ai limiti degli angoli in radianti, i quali oscillano tra -pigreco (cioe -180) e +pigreco (cioe 180)
        //se il vento soffia a -179 gradi e la turbina è orientata a 179 gradi, la differenza reale è di soli 2 gradi,
        //ma la sottrazione lineare darebbe come risultato 179 - (-179) = 358 gradi

        //per correggere si fa la normalizzazione della differenza angolare
        let diff = this.targetYaw - this.currentYaw;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        //Questi cicli while costringono la differenza diff a rientrare nell'intervallo -180, 180 (cioe -pigreco e pigreco)
        //Se la differenza supera 180 (in positivo o negativo), viene aggiunto o sottratto un angolo giro cioe 2*pigreco
        //In questo modo, la turbina sceglie sempre il percorso angolare più breve per allinearsi al vento (nell'esempio precedente, girerà di soli -2 gradi)

        //Applicazione dello smorzamento angolare: Anche la navicella ruota lentamente a causa della sua mole:
        const yawSpeed = 1.0; //La differenza angolare corretta diff viene moltiplicata per il tempo dt e per una velocità di imbardata (yawSpeed = 1.0).
        this.currentYaw += diff * Math.min(dt * yawSpeed, 1.0); //Math.min(..., 1.0) impedisce che in presenza di cali improvvisi di frame rate l'angolo calcolato superi il target, causando tremolii.
        this.tower.rotation.y = this.currentYaw; //Il valore ottenuto viene sommato a currentYaw e applicato a rotation.y della torre. La navicella ruota dolcemente fino ad allinearsi perfettamente con il vento.


        //Fase 4: Lampeggiamento notturno della luce di segnalazione
        //La parte finale gestisce l'accensione e lo spegnimento ad intermittenza dei fari di segnalazione ostacoli basandosi sul tempo del ciclo giorno/notte:
        // blinking beacon at night
        const timeFactor = clock.getElapsedTime() * 2.5; //getElapsedTime prende il tempo da quando hai avviato l'app, in secondi
        const isNight = STATE.timeOfDay < 5.5 || STATE.timeOfDay > 18.5; //isNight: Definisce la fascia notturna tra le 18:30 (tramonto) e le 5:30 (alba).

        if (isNight) { //Se è notte, viene calcolato lo stato della luce tramite la funzione d'onda sinusoidale: Math.sin(timeFactor) > 0.5
            const isLit = Math.sin(timeFactor) > 0.5;
            this.beaconLightMat.color.setHex(isLit ? 0x000000 : 0x550000); //Quando il seno è positivo e superiore a 0.5, la luce si accende (intensità impostata a 2.5, colore emissivo rosso brillante 0xff0000, e sprite visibili).
            this.beaconLightMat.emissive.setHex(isLit ? 0xff0000 : 0x000000); //Quando scende sotto la soglia, la luce si spegne (intensità a 0, colore scuro, sprite invisibili).
            this.beaconPointLight1.intensity = isLit ? 2.5 : 0.0;
            this.beaconPointLight2.intensity = isLit ? 2.5 : 0.0;

            this.glowSprite1.visible = isLit;
            this.glowSprite2.visible = isLit;
        }
        else { //Se è giorno, il ramo else forza lo spegnimento permanente di tutte le sorgenti di luce e dei relativi sprite geometrici per alleggerire il carico computazionale del motore grafico.
            this.beaconLightMat.color.setHex(0x550000);
            this.beaconLightMat.emissive.setHex(0x000000);
            this.beaconPointLight1.intensity = 0;
            this.beaconPointLight2.intensity = 0;

            this.glowSprite1.visible = false;
            this.glowSprite2.visible = false;
        }
    }
}

//a differenza del WindTurbine, con OldWindmill Non ha sistemi di frenata automatica gestiti da computer. Nel codice, il mulino storico gira sempre, in modo lineare e direttamente proporzionale alla velocità del vento, anche quando l'intensità raggiunge il valore massimo
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

        // old mills spin proportional to wind speed without safety cut-off
        let targetRotorSpeed = (localSpeed / 100) * 2.8; //non cambia nulla

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

// instantiate all turbines
function createTurbines() { //posizioniamo tutte le turbine
    turbines = [];

    // modern turbines
    turbines.push(new WindTurbine(40, 25, 0.3));
    turbines.push(new WindTurbine(100, -30, 0.3));
    turbines.push(new WindTurbine(-100, -60, 0.3));
    turbines.push(new WindTurbine(0, 75, 0.3));
    turbines.push(new WindTurbine(-100, 100, 0.3));
    turbines.push(new WindTurbine(-40, -10, 0.3));
    turbines.push(new WindTurbine(100, 100, 0.3));

    // old windmills
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
