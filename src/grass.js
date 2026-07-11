// instanced grass rendering with vertex displacement shaders

function createDynamicGrass() {
    const w = 2.5;
    const h = 2.5;

    grassGeo = new THREE.PlaneGeometry(w, h, 1, 3);
    grassGeo.translate(0, h / 2, 0);

    const count = 25000;
    const flowerCount = Math.floor(count / 5);
    const normalCount = count - flowerCount;

    const normalWindDir = [];
    const normalWindDist = [];
    const flowerWindDir = [];
    const flowerWindDist = [];

    const sharedUserData = {
        uTime: { value: 0 },
        uWindSpeed: { value: STATE.windSpeed / 100 },
        uWindDirection: { value: windVectorGlobal },
        uWindMode: { value: 0 },
        uBillboard: { value: STATE.billboardFactor },
        uSigma: { value: STATE.windSigmaThreshold }
    };

    const grassMat = new THREE.MeshPhongMaterial({
        map: leafTexture,
        side: THREE.DoubleSide,
        transparent: false,
        alphaTest: 0.5,
        shininess: 0
    });
    grassMat.userData = sharedUserData;

    const flowerMat = new THREE.MeshPhongMaterial({
        map: flowerTexture,
        side: THREE.DoubleSide,
        transparent: false,
        alphaTest: 0.5,
        shininess: 0
    });
    flowerMat.userData = sharedUserData;

    const compileShader = (shader) => {
        shader.uniforms.uTime = sharedUserData.uTime;
        shader.uniforms.uWindSpeed = sharedUserData.uWindSpeed;
        shader.uniforms.uWindDirection = sharedUserData.uWindDirection;
        shader.uniforms.uWindMode = sharedUserData.uWindMode;
        shader.uniforms.uBillboard = sharedUserData.uBillboard;
        shader.uniforms.uSigma = sharedUserData.uSigma;

        shader.vertexShader = `
            uniform float uTime;
            uniform float uWindSpeed;
            uniform vec3 uWindDirection;
            uniform float uWindMode;
            uniform float uBillboard; 
            uniform float uSigma; 

            attribute vec3 instanceWindDir;
            attribute float instanceWindDist; 
            varying float vHeightFactor; 
        ` + shader.vertexShader;

        const beginVertexReplace = `
            vec3 transformed = vec3( position );
            vHeightFactor = position.y / 2.5; 

            vec3 instanceWorldPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

            // Billboard calculations
            vec3 toCamera = cameraPosition - instanceWorldPos;
            toCamera.y = 0.0;
            toCamera = normalize(toCamera);
            
            float targetAngle = atan(toCamera.x, toCamera.z);
            float currentAngle = mix(0.0, targetAngle, uBillboard);
            
            float c = cos(currentAngle);
            float s = sin(currentAngle);
            mat2 rotY = mat2(c, -s, s, c);
            
            transformed.xz = rotY * transformed.xz;

            vec4 worldPos = instanceMatrix * vec4(transformed, 1.0);

            // Compute wind influence using spline distance
            float localFactor = exp(-(instanceWindDist * instanceWindDist) / (2.0 * uSigma * uSigma));
            vec3 windDir = (uWindMode < 0.5) ? normalize(uWindDirection) : -normalize(instanceWindDir);
            float windForce = (uWindMode < 0.5) ? uWindSpeed : uWindSpeed * localFactor;

            float bendStrength = vHeightFactor * vHeightFactor;

            float baseline = windForce * 2.5;

            float waveSpeed = 5.0 + windForce * 12.0; 
            float waveAmp = 0.95 * (1.0 - windForce * 0.3); 
            
            float wave = sin(uTime * waveSpeed + (worldPos.x * 0.15) + (worldPos.z * 0.15)) * waveAmp;
            wave += cos(uTime * (waveSpeed * 0.5) + (worldPos.x * 0.05)) * (waveAmp * 0.4);

            vec3 displacement = windDir * (baseline + wave) * bendStrength;
            transformed += displacement;
        `;

        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', beginVertexReplace);

        shader.fragmentShader = `
            varying float vHeightFactor; 
        ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
            #include <map_fragment>
            diffuseColor.rgb *= mix(vec3(0.08, 0.11, 0.05), vec3(1.0), vHeightFactor);
            `
        );
    };

    grassMat.onBeforeCompile = compileShader;
    flowerMat.onBeforeCompile = compileShader;

    const normalGeo = grassGeo.clone();
    const flowerGeo = grassGeo.clone();

    const normalMesh = new THREE.InstancedMesh(normalGeo, grassMat, normalCount);
    const flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);

    const dummy = new THREE.Object3D();
    const range = 240;

    let normalIdx = 0;
    let flowerIdx = 0;

    // precompute Spline Points
    const splineSteps = 100;
    const precomputedPoints = [];
    const precomputedTangents = [];
    for (let i = 0; i <= splineSteps; i++) {
        const t = i / splineSteps;
        precomputedPoints.push(splinePath.getPointAt(t));
        precomputedTangents.push(splinePath.getTangentAt(t).normalize());
    }

    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * range;
        const z = (Math.random() - 0.5) * range;
        const y = getTerrainHeight(x, z);

        dummy.position.set(x, y - 0.3, z);
        dummy.rotation.set(0, 0, 0);

        const scale = 0.8 + Math.random() * 0.9;
        dummy.scale.set(scale * 1.2, scale * (1.0 + Math.random() * 0.4), scale);
        dummy.updateMatrix();

        const posWorld = new THREE.Vector3(x, y, z);

        // search on precomputed set via distanceToSquared (this is better because avoids slow Math.sqrt)
        let minDistSq = Infinity;
        let bestIndex = 0;
        for (let j = 0; j <= splineSteps; j++) {
            const distSq = posWorld.distanceToSquared(precomputedPoints[j]);
            if (distSq < minDistSq) {
                minDistSq = distSq;
                bestIndex = j;
            }
        }

        const tangent = precomputedTangents[bestIndex];
        const distance = Math.sqrt(minDistSq); // calculate the square root only for the final minimum distance.

        if (i < normalCount) {
            normalMesh.setMatrixAt(normalIdx, dummy.matrix);
            normalWindDir.push(tangent.x, tangent.y, tangent.z);
            normalWindDist.push(distance);
            normalIdx++;
        } else {
            flowerMesh.setMatrixAt(flowerIdx, dummy.matrix);
            flowerWindDir.push(tangent.x, tangent.y, tangent.z);
            flowerWindDist.push(distance);
            flowerIdx++;
        }
    }

    normalGeo.setAttribute('instanceWindDir', new THREE.InstancedBufferAttribute(new Float32Array(normalWindDir), 3));
    normalGeo.setAttribute('instanceWindDist', new THREE.InstancedBufferAttribute(new Float32Array(normalWindDist), 1));
    flowerGeo.setAttribute('instanceWindDir', new THREE.InstancedBufferAttribute(new Float32Array(flowerWindDir), 3));
    flowerGeo.setAttribute('instanceWindDist', new THREE.InstancedBufferAttribute(new Float32Array(flowerWindDist), 1));

    normalMesh.instanceMatrix.needsUpdate = true;
    normalMesh.castShadow = false;
    normalMesh.receiveShadow = false;
    flowerMesh.instanceMatrix.needsUpdate = true;
    flowerMesh.castShadow = false;
    flowerMesh.receiveShadow = false;

    const grassGroup = new THREE.Group();
    grassGroup.add(normalMesh);
    grassGroup.add(flowerMesh);

    scene.add(grassGroup);
    grassMesh = grassGroup;
    grassMesh.material = grassMat;
}