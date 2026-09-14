// UI manager and DOM event handlers

const UI = {
    elements: {},

    // cache elements and attach event listeners
    init() { //CONFIGURAZIONE INTERFACCIA GRAIFCA
        /*
        Nella prima parte, init() interroga la pagina HTML per trovare tutti gli elementi con cui l'utente interagirà
        o che mostreranno dati dinamici (come i badge dei valori o il contatore FPS).
        Memorizza questi riferimenti all'interno dell'oggetto vuoto this.elements:
        */
        this.elements.speedSlider = document.getElementById('wind-speed');
        this.elements.speedVal = document.getElementById('wind-speed-val');
        this.elements.modeSelect = document.getElementById('wind-mode');
        this.elements.compassGroup = document.getElementById('compass-group');
        this.elements.compass = document.getElementById('compass');
        this.elements.pointer = this.elements.compass ? this.elements.compass.querySelector('.compass-arrow') : null;
        this.elements.timeSlider = document.getElementById('time-of-day');
        this.elements.timeVal = document.getElementById('time-of-day-val');
        this.elements.autoTimeCheck = document.getElementById('auto-time');
        this.elements.splineCheck = document.getElementById('show-spline');
        this.elements.windVectorsCheck = document.getElementById('show-wind-vectors');
        this.elements.thresholdSlider = document.getElementById('wind-threshold');
        this.elements.thresholdVal = document.getElementById('wind-threshold-val');
        this.elements.fpsCounter = document.getElementById('fps-counter');
        this.elements.windLegend = document.getElementById('wind-legend');
        this.elements.cameraInfo = document.getElementById('camera-info');
        this.elements.muteButton = document.getElementById('mute-button');
        this.elements.regenSplineBtn = document.getElementById('regen-spline');
        /*
        Questa è una tecnica standard di ottimizzazione nello sviluppo web.
        Eseguire ricerche nel DOM tramite funzioni come document.getElementById() è un'operazione computazionalmente onerosa per il browser. 
        Cercando tutti gli elementi una sola volta all'avvio e salvandone il riferimento in memoria (this.elements),
        l'applicazione può aggiornare testi e grafiche durante il ciclo di rendering (che gira a 60 FPS) in modo immediato, senza alcun rallentamento.
        */
       /*
       Una volta memorizzati i riferimenti agli elementi HTML, init() richiama in sequenza una serie di funzioni interne 
       (configurate più in basso nello stesso file) per rendere interattivi i controlli:
       */
        this.setupMuteButtonListener();
        this.setupWindSpeedListener();
        this.setupWindModeListener();
        this.setupCompassListener();
        this.setupTimeOfDayListener();
        this.setupCameraButtonsListener();
        this.setupSplineVisibilityListener();
        this.setupWindVectorsListener();
        this.setupThresholdListener();
        this.setupKeyboardShortcuts();
        this.setupRegenSplineListener();
        this.setupAccordions();
        this.setupGlobalToggle();

        /*
        In sintesi, senza la chiamata a UI.init(), l'interfaccia grafica rimarrebbe un semplice foglio statico sopra la simulazione 3D: 
        i pulsanti non farebbero nulla, gli slider non cambierebbero i valori del vento o dell'ora e i testi informativi non verrebbero
        aggiornati durante l'esecuzione del programma.
        */
    },

    // collapsible accordion panels
    setupAccordions() {
        const headers = document.querySelectorAll('.window-header');
        headers.forEach(header => {
            if (header.id === 'main-panel-header') return;

            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                const icon = header.querySelector('.toggle-icon');

                if (content.classList.contains('hidden')) {
                    content.classList.remove('hidden');
                    header.classList.remove('closed');
                    icon.textContent = '▼';
                } else {
                    content.classList.add('hidden');
                    header.classList.add('closed');
                    icon.textContent = '▶';
                }
            });
        });
    },

    // toggle entire control panel overlay
    setupGlobalToggle() {
        const globalHeader = document.getElementById('main-panel-header');
        const globalContent = document.getElementById('main-panel-content');
        const globalIcon = document.getElementById('main-toggle-icon');

        if (!globalHeader || !globalContent) return;

        globalHeader.addEventListener('click', () => {
            if (globalContent.classList.contains('hidden')) {
                globalContent.classList.remove('hidden');
                globalIcon.textContent = '▼';
            } else {
                globalContent.classList.add('hidden');
                globalIcon.textContent = '▶';
            }
        });
    },

    // audio toggle  BOTTONE DELL'AUDIO
    setupMuteButtonListener() {
        if (!this.elements.muteButton) return;
        this.elements.muteButton.addEventListener('click', () => {
            STATE.isMuted = !STATE.isMuted;
            const btn = this.elements.muteButton;

            if (STATE.isMuted) {
                btn.innerHTML = 'Audio Disabled';
                btn.style.backgroundColor = 'rgba(255, 50, 50, 0.2)';
                btn.style.color = '#cc0000';
                btn.style.borderColor = '#cc0000';
            } else {
                btn.innerHTML = 'Audio Enabled';
                btn.style.backgroundColor = ''; // go to the CSS
                btn.style.color = '';
                btn.style.borderColor = '';
            }

            if (typeof updateWindAudio === 'function') {
                updateWindAudio();
            }
        });
    },

    // slider for wind speed
    setupWindSpeedListener() {
        if (!this.elements.speedSlider) return;

        this.elements.speedSlider.addEventListener('input', (e) => {
            STATE.windSpeed = parseInt(e.target.value);

            if (windSound && !windSound.isPlaying) {
                windSound.play();
            }
            updateWindAudio();

            if (this.elements.speedVal) {
                this.elements.speedVal.innerText = `${STATE.windSpeed}%`;
            }
            if (typeof grassMesh !== 'undefined' && grassMesh && grassMesh.material) {
                grassMesh.material.userData.uWindSpeed.value = STATE.windSpeed / 100;
            }
        });
    },

    // wind mode selection (global/spline)
    setupWindModeListener() {
        if (!this.elements.modeSelect) return;

        this.elements.modeSelect.addEventListener('change', (e) => {
            STATE.windMode = e.target.value;
            const isSpline = (STATE.windMode === 'spline');

            if (typeof grassMesh !== 'undefined' && grassMesh && grassMesh.material) {
                grassMesh.material.userData.uWindMode.value = isSpline ? 1.0 : 0.0;
            }

            if (this.elements.compassGroup) {
                this.elements.compassGroup.style.display = isSpline ? 'none' : 'flex';
            }

            if (typeof splineHelper !== 'undefined' && splineHelper) {
                splineHelper.visible = STATE.showSpline && isSpline;
            }
        });
    },

    /*
    a funzione setupCompassListener() ha il compito di mettere in comunicazione l'interfaccia utente bidimensionale (la bussola bidimensionale dell'HUD) con lo spazio tridimensionale della simulazione di Three.js.
    Permette all'utente di cliccare e trascinare la freccia della bussola per orientare il vettore globale del vento. Di seguito viene proposta un'analisi dettagliata del suo funzionamento, suddivisa per aree tematiche: logica di trascinamento, calcoli trigonometrici e sincronizzazione con la scheda video (GPU).
    */

    // Interactive compas widget for direction STUDIARE QUI TUTTA LA ROBA LEGATA A ALGEBRA LINEARE, RADIANTI ECC... CIOE STUDIA TUTTA LA FUNZIOEN
    setupCompassListener() {
        if (!this.elements.compass || !this.elements.pointer) return;

        let isDraggingCompass = false;

        /*
        l primo blocco della funzione interna updateCompassDirection(e) serve a determinare dove si trovi il cursore 
        (o il dito, su dispositivi touch) rispetto al centro esatto della bussola:
        */
        const updateCompassDirection = (e) => {
            const rect = this.elements.compass.getBoundingClientRect(); //getBoundingClientRect() restituisce le dimensioni e la posizione assoluta dell'elemento HTML della bussola rispetto alla finestra del browser (viewport).
            //centerX e centerY individuano il punto centrale esatto (il fulcro della freccia) in coordinate pixel dello schermo.
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            //Successivamente, il codice normalizza l'evento di input per supportare sia i dispositivi desktop (mouse) che quelli mobili (touch screen):
            /*
            Se l'evento contiene un array touches, significa che l'utente sta usando un touch screen,
            quindi viene estratta la coordinata del primo punto di contatto (e.touches[0]). 
            Altrimenti, viene usata la coordinata del mouse e.clientX/e.clientY.
            */
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);

            //Infine, si calcola la distanza relativa del cursore rispetto al centro della bussola sulle due direzioni cartesiane:
            //cioe si calcola deltax e deltay
            const dx = clientX - centerX;
            const dy = clientY - centerY;

            //Una volta ottenuti i segmenti ovvero deltax e deltay, il codice determina l'angolo di rotazione:

            //Math.atan2(dy, dx): Questa funzione trigonometrica calcola l'arcotangente delle due coordinate,
            //restituendo l'angolo in radianti nell'intervallo [−π,π][−π,π]. 
            //Rispetto a Math.atan(), atan2 gestisce automaticamente il segno di entrambi gli argomenti, 
            //evitando problemi di divisione per zero quando l'utente si trova esattamente sull'asse verticale.
            let angleRad = Math.atan2(dy, dx);

            //Conversione in gradi: I radianti vengono convertiti in gradi moltiplicando per 180/π
            //In trigonometria standard, l'angolo di 0  radianti(o gradi) si sviluppa lungo l'asse X positivo (quindi verso destra, corrispondente all'Est).
            //Nelle bussole visive, tuttavia, il Nord è posizionato in alto.Nello spazio dello schermo del browser, 
            //inoltre, l'asse Y è invertito (valori crescenti verso il basso). Aggiungendo + 90 gradi, si ruota l'asse di riferimento in modo 
            //che il puntatore sia orientato verso l'alto(Nord) quando l'angolo calcolato è pari a zero.
            let angleDeg = angleRad * (180 / Math.PI) + 90; // the north aligns up

            //Una volta ricavato l'angolo corretto, il codice aggiorna l'interfaccia utente e lo stato dell'applicazione:
            STATE.windDirection = angleDeg; //Memorizza il valore in gradi nell'oggetto di stato globale STATE.windDirection.
            this.elements.pointer.style.transform = `rotate(${angleDeg}deg)`; //Applica una rotazione CSS all'elemento della freccia (pointer) per riflettere istantaneamente l'interazione dell'utente sulla bussola dell'interfaccia.


            //Il vento nel motore 3D non è definito da un angolo, ma da un vettore tridimensionale unitario di direzione (windVectorGlobal)
            //che giace sul piano orizzontale XZ (dove Y rappresenta l'altezza, che per il vento standard è 0  ).

            //Prima di riconvertire in radianti, si rimuove l'offset visivo di 90 gradi precedentemente aggiunto per la bussola HTML,
            //riportando l'angolo nel sistema trigonometrico standard di Three.js.
            //Costruzione del Vettore: Viene configurato il vettore con coordinate:
            //X=cos(rad)
            //Y=0 (il vento soffia parallelamente al terreno)
            //Z=sin(rad)
            const rad = (angleDeg - 90) * (Math.PI / 180);
            if (typeof windVectorGlobal !== 'undefined') {
                //Riduce la lunghezza del vettore a 1(vettore unitario).Questo garantisce che il vettore indichi unicamente la direzione, evitando che la distanza del cursore dal centro della bussola influenzi l'intensità del vento.
                windVectorGlobal.set(Math.cos(rad), 0, Math.sin(rad)).normalize();
            }

            //Per evitare di ricalcolare le geometrie o ricreare i materiali ad ogni movimento del mouse (operazione che causerebbe vistosi cali di frame rate), il codice invia il nuovo vettore direttamente alla GPU tramite le uniforms dello shader dell'erba:
            if (typeof grassMesh !== 'undefined' && grassMesh && grassMesh.material && windVectorGlobal) {
                //La proprietà userData.uWindDirection.value è referenziata all'interno del vertex shader customizzato dell'erba.
                //Copiando il vettore in questa posizione della memoria, la scheda video aggiorna la direzione di piegamento dei 25.000 fili d'erba nel frame successivo in modo diretto e performante.
                grassMesh.material.userData.uWindDirection.value.copy(windVectorGlobal);
            }
        };

        //Il resto del metodo si occupa di registrare i listener per mouse e touch. Un dettaglio importante riguarda la scelta dei target per i vari eventi:

        //mousedown / touchstart sulla bussola: Il trascinamento inizia solo se l'utente clicca direttamente sull'elemento della bussola.
        //mousemove / touchmove sulla finestra (window): Questa è una scelta di progettazione mirata a migliorare l'esperienza d'uso (User Experience). Registrando il movimento sull'intero documento (window) anziché sul piccolo cerchio della bussola, l'interazione non si interrompe se l'utente sposta velocemente il mouse fuori dai confini fisici della bussola mentre tiene premuto il tasto.
        //mouseup / touchendsulla finestra(window): Garantisce che lo stato di trascinamento si disattivi(isDraggingCompass = false) ovunque l'utente rilasci il click o sollevi il dito dallo schermo.
        this.elements.compass.addEventListener('mousedown', (e) => {
            isDraggingCompass = true;
            updateCompassDirection(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (isDraggingCompass) updateCompassDirection(e);
        });

        window.addEventListener('mouseup', () => {
            isDraggingCompass = false;
        });

        // support for mobile touch events
        this.elements.compass.addEventListener('touchstart', (e) => {
            isDraggingCompass = true;
            updateCompassDirection(e);
        });

        window.addEventListener('touchmove', (e) => {
            if (isDraggingCompass) updateCompassDirection(e);
        });

        window.addEventListener('touchend', () => {
            isDraggingCompass = false;
        });
    },

    // time of day slider SLIDER DELLO SCORRERE DEL TEMPO
    setupTimeOfDayListener() {
        if (!this.elements.timeSlider) return;

        this.elements.timeSlider.addEventListener('input', (e) => {
            STATE.timeOfDay = parseFloat(e.target.value);
            this.updateTimeValueText(STATE.timeOfDay);
        });

        if (this.elements.autoTimeCheck) {
            this.elements.autoTimeCheck.addEventListener('change', (e) => {
                STATE.autoTime = e.target.checked;
            });
        }
    },

    // camera view controls BOTTONI DELLE CAMERE
    setupCameraButtonsListener() {
        const camButtons = {
            'cam-orbit': 'orbit',
            'cam-turbine-1': 'turbine-1',
            'cam-turbine-2': 'turbine-2',
            'cam-turbine-3': 'turbine-3'
        };

        Object.keys(camButtons).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            btn.addEventListener('click', () => {
                Object.keys(camButtons).forEach(id => {
                    const b = document.getElementById(id);
                    if (b) b.classList.remove('active');
                });
                btn.classList.add('active');

                STATE.currentCamera = camButtons[btnId];
                if (typeof setupCameraView === 'function') {
                    setupCameraView();
                }
            });
        });
    },

    // toggle visibility of spline helper path  //bottone per dire se è isibile la spline
    setupSplineVisibilityListener() {
        if (!this.elements.splineCheck) return;

        this.elements.splineCheck.addEventListener('change', (e) => {
            STATE.showSpline = e.target.checked;

            if (typeof splineHelper !== 'undefined' && splineHelper) {
                splineHelper.visible = STATE.showSpline && STATE.windMode === 'spline';
            }
        });
    },

    // wind vector checkbox //bottone per dire se è isibile il campo vettoriale
    setupWindVectorsListener() {
        if (!this.elements.windVectorsCheck) return;

        this.elements.windVectorsCheck.addEventListener('change', (e) => {
            if (typeof toggleWindVectorField === 'function') {
                toggleWindVectorField();
            }
        });
    },

    // wind influence radius threshold slider  //SLIDER PER INDICARE LO SLIDER DELLA THRESHOLD
    setupThresholdListener() {
        if (!this.elements.thresholdSlider) return;

        this.elements.thresholdSlider.addEventListener('input', (e) => {
            STATE.windSigmaThreshold = parseInt(e.target.value);
            if (this.elements.thresholdVal) {
                this.elements.thresholdVal.innerText = `${STATE.windSigmaThreshold} m`;
            }
            if (STATE.showWindVectorField && typeof updateWindVectorField === 'function') {
                updateWindVectorField();
            }
        });
    },

    // keyboard shortcut F key to toggle vectors
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'f' || e.key === 'F') && document.activeElement.tagName !== 'INPUT') {
                if (typeof toggleWindVectorField === 'function') {
                    toggleWindVectorField();
                }
            }
        });
    },

    // regenerate spline path
    setupRegenSplineListener() {
        if (!this.elements.regenSplineBtn) return;
        this.elements.regenSplineBtn.addEventListener('click', () => {
            if (typeof createWindSpline === 'function') {
                createWindSpline();

                const originalText = this.elements.regenSplineBtn.innerHTML;
                this.elements.regenSplineBtn.innerHTML = "Path Generated";
                setTimeout(() => {
                    this.elements.regenSplineBtn.innerHTML = originalText;
                }, 1500);
            }
        });
    },

    updateFPS(fps) {
        if (this.elements.fpsCounter) {
            this.elements.fpsCounter.innerText = `FPS: ${fps}`;
        }
    },

    updateCameraInfo(position, direction) {
        if (!this.elements.cameraInfo) return;

        const px = position.x.toFixed(2);
        const py = position.y.toFixed(2);
        const pz = position.z.toFixed(2);

        const dx = direction.x.toFixed(2);
        const dy = direction.y.toFixed(2);
        const dz = direction.z.toFixed(2);

        this.elements.cameraInfo.innerHTML = `Pos: X:${px} &nbsp;Y:${py} &nbsp;Z:${pz}<br>Dir: X:${dx} &nbsp;Y:${dy} &nbsp;Z:${dz}`;
    },

    updateTimeValueText(timeOfDay) {
        const hours = Math.floor(timeOfDay);
        const minutes = Math.floor((timeOfDay % 1) * 60);
        if (this.elements.timeVal) {
            this.elements.timeVal.innerText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
    },

    syncTimeSlider(timeOfDay) {
        if (this.elements.timeSlider) {
            this.elements.timeSlider.value = timeOfDay;
        }
    },

    syncShowWindVectors(checked) {
        if (this.elements.windVectorsCheck) {
            this.elements.windVectorsCheck.checked = checked;
        }
    },

    toggleWindLegend(visible) {
        if (this.elements.windLegend) {
            //if we want to NOT show vector field values:
            this.elements.windLegend.style.display = 'none';
            //if we want to show vector field values:
            //this.elements.windLegend.style.display = visible ? 'block' : 'none';
        }
    }
};