// UI manager and DOM event handlers

const UI = {
    elements: {},

    // Cache elements and attach event listeners
    init() {
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
    },

    // Collapsible accordion panels
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

    // Toggle entire control panel overlay
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

    // Audio toggle
    setupMuteButtonListener() {
        if (!this.elements.muteButton) return;
        this.elements.muteButton.addEventListener('click', () => {
            STATE.isMuted = !STATE.isMuted;
            if (STATE.isMuted) {
                this.elements.muteButton.innerHTML = '🔇 Audio Disabled';
                this.elements.muteButton.style.backgroundColor = 'rgba(255, 50, 50, 0.15)';
                this.elements.muteButton.style.color = '#cc0000';
                this.elements.muteButton.style.borderColor = 'rgba(255, 50, 50, 0.4)';
                this.elements.muteButton.onmouseout = () => this.elements.muteButton.style.backgroundColor = 'rgba(255, 50, 50, 0.15)';
            } else {
                this.elements.muteButton.innerHTML = '🔊 Audio Enabled';
                this.elements.muteButton.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                this.elements.muteButton.style.color = 'var(--text-primary)';
                this.elements.muteButton.style.borderColor = 'rgba(0, 0, 0, 0.15)';
                this.elements.muteButton.onmouseout = () => this.elements.muteButton.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';

                if (typeof windSound !== 'undefined' && windSound && !windSound.isPlaying) {
                    windSound.play();
                }
            }
            if (typeof updateWindAudio === 'function') {
                updateWindAudio();
            }
        });
    },

    // Slider for wind speed
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

    // Wind mode selection (global/spline)
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

    // Interactive compass widget direction mapping
    setupCompassListener() {
        if (!this.elements.compass || !this.elements.pointer) return;

        let isDraggingCompass = false;

        const updateCompassDirection = (e) => {
            const rect = this.elements.compass.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);

            const dx = clientX - centerX;
            const dy = clientY - centerY;

            let angleRad = Math.atan2(dy, dx);
            let angleDeg = angleRad * (180 / Math.PI) + 90; // North aligns up

            STATE.windDirection = angleDeg;
            this.elements.pointer.style.transform = `rotate(${angleDeg}deg)`;

            const rad = (angleDeg - 90) * (Math.PI / 180);
            if (typeof windVectorGlobal !== 'undefined') {
                windVectorGlobal.set(Math.cos(rad), 0, Math.sin(rad)).normalize();
            }

            if (typeof grassMesh !== 'undefined' && grassMesh && grassMesh.material && windVectorGlobal) {
                grassMesh.material.userData.uWindDirection.value.copy(windVectorGlobal);
            }
        };

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

        // Mobile touch events support
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

    // Time of day slider
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

    // Camera view controls
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

    // Toggle visibility of spline helper path
    setupSplineVisibilityListener() {
        if (!this.elements.splineCheck) return;

        this.elements.splineCheck.addEventListener('change', (e) => {
            STATE.showSpline = e.target.checked;

            if (typeof splineHelper !== 'undefined' && splineHelper) {
                splineHelper.visible = STATE.showSpline && STATE.windMode === 'spline';
            }
        });
    },

    // Wind vector checkbox
    setupWindVectorsListener() {
        if (!this.elements.windVectorsCheck) return;

        this.elements.windVectorsCheck.addEventListener('change', (e) => {
            if (typeof toggleWindVectorField === 'function') {
                toggleWindVectorField();
            }
        });
    },

    // Wind influence radius threshold slider
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

    // Keyboard shortcut F key to toggle vectors
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'f' || e.key === 'F') && document.activeElement.tagName !== 'INPUT') {
                if (typeof toggleWindVectorField === 'function') {
                    toggleWindVectorField();
                }
            }
        });
    },

    // Re-generate spline path
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
            this.elements.windLegend.style.display = 'none';
        }
    }
};