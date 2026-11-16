// Hale, drawn and played: the renderer, the ground and sky shaders, the scenery, the small game (light the four
// beacons, climb the Ascent), the HUD and the frame. The world itself is world.js; the skier is skier.js.
(function(){
'use strict';
const W = window.Hale, R = W.R, V3 = THREE.Vector3, $ = id => document.getElementById(id);
const v3 = a => new V3(a[0], a[1], a[2]);
const Q = new URLSearchParams(location.search);
const QUALITY = Q.get('q') || (matchMedia('(pointer:coarse)').matches ? 'low' : 'high');
const NFACE = QUALITY === 'low' ? 128 : QUALITY === 'mid' ? 176 : 224, SHADOWS = QUALITY !== 'low';
const smooth01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a)/(b - a))); return t*t*(3 - 2*t); };

// ================================================================ renderer and the post chain (HDR scene > bloom > tone map)
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, QUALITY === 'low' ? 1.5 : 2));
renderer.shadowMap.enabled = SHADOWS; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const gl = renderer.getContext(), GL2 = renderer.capabilities.isWebGL2;
const HDR = GL2 ? !!gl.getExtension('EXT_color_buffer_float') : !!(gl.getExtension('OES_texture_half_float') && gl.getExtension('EXT_color_buffer_half_float'));
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, 0.8, R*12);
let rtScene, rtA, rtB, rtC;
const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: HDR ? THREE.HalfFloatType : THREE.UnsignedByteType };
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const tri = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); postScene.add(tri);
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const brightMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, thr: { value: HDR ? 1.15 : 0.86 } }, vertexShader: VS, depthTest: false,
  fragmentShader: 'uniform sampler2D t; uniform float thr; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c*smoothstep(thr, thr + 0.6, l), 1.); }' });
const blurMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, d: { value: new THREE.Vector2() } }, vertexShader: VS, depthTest: false,
  fragmentShader: 'uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb*0.227; c += (texture2D(t, vUv + d*1.385).rgb + texture2D(t, vUv - d*1.385).rgb)*0.316; c += (texture2D(t, vUv + d*3.231).rgb + texture2D(t, vUv - d*3.231).rgb)*0.070; gl_FragColor = vec4(c, 1.); }' });
const finalMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, b: { value: null }, b2: { value: null }, expo: { value: 1.18 }, tint: { value: new THREE.Color(1, 1, 1) } }, vertexShader: VS, depthTest: false,
  fragmentShader: `uniform sampler2D t, b, b2; uniform float expo; uniform vec3 tint; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0., 1.); }
    void main(){ vec3 c = texture2D(t, vUv).rgb + texture2D(b, vUv).rgb*0.55 + texture2D(b2, vUv).rgb*0.55;
      vec2 q = vUv - 0.5; c *= 1. - 0.28*dot(q, q)*2.;                       // a little vignette
      c = aces(c*expo*tint); gl_FragColor = vec4(pow(c, vec3(1./2.2)), 1.); }` });
function resize(){
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix();
  const pr = renderer.getPixelRatio(), W2 = Math.round(w*pr), H2 = Math.round(h*pr);
  for (const r of [rtScene, rtA, rtB, rtC]) if (r) r.dispose();
  rtScene = GL2 && QUALITY !== 'low' ? new THREE.WebGLMultisampleRenderTarget(W2, H2, rtOpts) : new THREE.WebGLRenderTarget(W2, H2, rtOpts);
  if (rtScene.samples !== undefined) rtScene.samples = 4;
  rtA = new THREE.WebGLRenderTarget(W2 >> 2, H2 >> 2, rtOpts); rtB = new THREE.WebGLRenderTarget(W2 >> 2, H2 >> 2, rtOpts); rtC = new THREE.WebGLRenderTarget(W2 >> 3, H2 >> 3, rtOpts);
}
addEventListener('resize', resize); resize();
function pass(mat, target){ tri.material = mat; renderer.setRenderTarget(target); renderer.render(postScene, postCam); }
function renderFrame(){
  renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
  brightMat.uniforms.t.value = rtScene.texture; pass(brightMat, rtA);
  blurMat.uniforms.t.value = rtA.texture; blurMat.uniforms.d.value.set(1/rtA.width, 0); pass(blurMat, rtB);
  blurMat.uniforms.t.value = rtB.texture; blurMat.uniforms.d.value.set(0, 1/rtA.height); pass(blurMat, rtA);
  blurMat.uniforms.t.value = rtA.texture; blurMat.uniforms.d.value.set(2.2/rtC.width, 0); pass(blurMat, rtC);
  blurMat.uniforms.t.value = rtC.texture; blurMat.uniforms.d.value.set(0, 2.2/rtA.height); pass(blurMat, rtB);
  finalMat.uniforms.t.value = rtScene.texture; finalMat.uniforms.b.value = rtA.texture; finalMat.uniforms.b2.value = rtB.texture; pass(finalMat, null);
}

// ================================================================ light: a sun the planet turns under, sky light, and the purple of Mother
const sunDir = new V3(), MOTHER = v3(W.ll(-125, 15)).normalize();        // the ringed giant hangs over the court, in the west from the outpost
const sun = new THREE.DirectionalLight(0xffffff, 1); scene.add(sun, sun.target);
if (SHADOWS){ sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const c = sun.shadow.camera; c.left = c.bottom = -55; c.right = c.top = 55; c.near = 10; c.far = 600; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06; }
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.3); scene.add(hemi);
const shine = new THREE.DirectionalLight(new THREE.Color(0.55, 0.32, 1.0), 0.22); scene.add(shine, shine.target);
scene.fog = new THREE.Fog(0x000000, 140, 1500);
const DAY_MIN = 24; let dayPhase = 0.07;
const GLSL_NOISE = `
  float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
  float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3. - 2.*f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }`;

// ---- the sky: one big sphere round the camera. day blue, a warm band at dawn and dusk, violet night with stars
const skyU = { uSun: { value: sunDir }, uUp: { value: new V3(0, 1, 0) }, uDay: { value: 1 }, uTw: { value: 0 }, uFog: { value: new THREE.Color() }, uT: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(R*10, 32, 20), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }',
  fragmentShader: `uniform vec3 uSun, uUp, uFog; uniform float uDay, uTw, uT; varying vec3 vD; ${GLSL_NOISE}
    void main(){ vec3 d = normalize(vD); float e = dot(d, uUp), s = max(dot(d, uSun), 0.);
      vec3 dayC = mix(vec3(0.50, 0.70, 0.95), vec3(0.10, 0.28, 0.72), pow(clamp(e, 0., 1.), 0.55));
      vec3 nightC = mix(vec3(0.030, 0.016, 0.070), vec3(0.004, 0.003, 0.016), pow(clamp(e, 0., 1.), 0.45));
      vec3 c = mix(nightC, dayC, uDay);
      c += vec3(1.0, 0.42, 0.16)*uTw*pow(1. - clamp(e, 0., 1.), 3.)*(0.25 + 0.75*pow(s, 3.));
      // stars: one per cell of a fine grid on the sphere, a few of them bright, twinkling slowly
      vec3 g = d*190.; vec3 ci = floor(g); float h = hash3(ci); vec3 off = vec3(hash3(ci + 7.), hash3(ci + 13.), hash3(ci + 29.)) - 0.5;
      float sd = length(fract(g) - 0.5 - off*0.6), star = smoothstep(0.11, 0.0, sd)*step(0.72, h)*(0.6 + 5.0*pow(hash3(ci + 3.), 5.));
      star *= 0.75 + 0.25*sin(uT*1.7 + h*40.);
      c += vec3(0.9, 0.92, 1.0)*star*(1. - uDay)*smoothstep(-0.02, 0.15, e)*2.6;
      // the band of the galaxy, faint
      c += vec3(0.20, 0.12, 0.36)*(1. - uDay)*pow(1. - abs(dot(d, normalize(vec3(0.3, 0.8, 0.52)))), 6.)*(0.4 + 0.6*vnoise(d*9.))*0.5;
      c += vec3(1.0, 0.92, 0.75)*(smoothstep(0.99955, 0.9998, s)*14. + pow(s, 420.)*2.5 + pow(s, 24.)*0.18*uDay);
      c = mix(uFog, c, smoothstep(-0.10, 0.03, e));
      gl_FragColor = vec4(c, 1.); }` }));
sky.renderOrder = -20; sky.frustumCulled = false; scene.add(sky);
// ---- Mother: the purple ringed giant, far off; a small moon; and the Orbital Gateway going round overhead
const motherU = { uSun: { value: sunDir }, uDay: { value: 0 }, uSky: { value: new THREE.Color() } };
const mother = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({ uniforms: motherU, fog: false,
  vertexShader: 'varying vec3 vN; varying vec3 vP; varying vec3 vWm; void main(){ vN = normalize(mat3(modelMatrix)*normal); vP = position; vWm = (modelMatrix*vec4(position, 1.)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }',
  fragmentShader: `uniform vec3 uSun, uSky; uniform float uDay; varying vec3 vN, vP, vWm; ${GLSL_NOISE}
    void main(){ float lat = vP.y + 0.05*vnoise(vP*5.) + 0.02*vnoise(vP*17.);
      float band = 0.5 + 0.5*sin(lat*21.) * (0.6 + 0.4*sin(lat*57.));
      vec3 c = mix(vec3(0.20, 0.07, 0.42), vec3(0.62, 0.38, 0.92), band); c = mix(c, vec3(0.86, 0.66, 0.98), smoothstep(0.75, 1., vnoise(vec3(vP.x*3., lat*30., vP.z*3.))));
      float l = smoothstep(-0.18, 0.5, dot(normalize(vN), uSun)); c *= 0.05 + 1.05*l;
      float rim = pow(1. - abs(dot(normalize(vN), normalize(cameraPosition - vWm))), 2.5); c += vec3(0.5, 0.3, 0.9)*rim*0.35*l;
      gl_FragColor = vec4(mix(c, uSky, 0.72*uDay), 1.); }` }));
const MOTHER_D = R*7.4, MOTHER_R = R*3.5; mother.scale.setScalar(MOTHER_R); mother.frustumCulled = false; scene.add(mother);
const ringM = new THREE.Mesh(new THREE.RingGeometry(1.32, 2.25, 128, 1), new THREE.ShaderMaterial({ uniforms: motherU, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }',
  fragmentShader: `uniform vec3 uSky; uniform float uDay; varying vec3 vP; void main(){ float r = length(vP.xy), t = (r - 1.32)/0.93; float a = (0.55 + 0.45*sin(t*38.))*(0.6 + 0.4*sin(t*9. + 1.))*smoothstep(0., 0.06, t)*smoothstep(1., 0.9, t)*step(0.04, abs(t - 0.52));
      vec3 c = mix(vec3(0.75, 0.6, 0.98), vec3(0.95, 0.85, 1.0), t); gl_FragColor = vec4(mix(c, uSky, 0.7*uDay), a*0.8*(1. - 0.55*uDay)); }` }));
ringM.scale.setScalar(MOTHER_R); ringM.frustumCulled = false; ringM.rotation.set(1.28, 0.3, 0); scene.add(ringM);
const moon = new THREE.Mesh(new THREE.SphereGeometry(R*0.42, 20, 14), new THREE.MeshStandardMaterial({ color: 0x9a94b8, roughness: 1, fog: false, flatShading: true })); moon.frustumCulled = false; scene.add(moon);
const MOON = v3(W.ll(150, -20)).normalize();
const PROPS = createProps(THREE);
const station = (() => { const g = new THREE.Group(), M = PROPS.MAT, lit = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 2.4), fog: false }), hull = new THREE.MeshStandardMaterial({ color: 0xb9c2cf, roughness: 0.5, metalness: 0.4, fog: false, flatShading: true });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(26, 2.2, 8, 40), hull); ring.rotation.x = Math.PI/2; g.add(ring, new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 9, 16), hull), new THREE.Mesh(new THREE.CylinderGeometry(2, 4, 26, 8), hull));
  const tor = new THREE.Mesh(new THREE.TorusGeometry(26.1, 0.5, 6, 40), lit); tor.rotation.x = Math.PI/2; tor.position.y = 2.4; g.add(tor);
  for (let k = 0; k < 8; k++){ const a = k*Math.PI/4, arm = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 44), hull); arm.rotation.y = a; arm.position.set(Math.sin(a)*22, 0, Math.cos(a)*22); g.add(arm);
    const ship = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 16, 8), hull); ship.rotation.z = Math.PI/2; ship.rotation.y = a + Math.PI/2; ship.position.set(Math.sin(a)*50, 0, Math.cos(a)*50); if (k % 3 !== 2) g.add(ship); }
  const portal = new THREE.Mesh(new THREE.TorusGeometry(14, 1.6, 8, 32), hull), disc = new THREE.Mesh(new THREE.CircleGeometry(13, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.2, 3.0), side: THREE.DoubleSide, fog: false }));
  portal.position.set(66, 0, 0); portal.rotation.y = Math.PI/2; disc.position.copy(portal.position); disc.rotation.y = Math.PI/2; g.add(portal, disc);
  g.traverse(o => { o.frustumCulled = false; }); g.scale.setScalar(1.6); scene.add(g); return g; })();

// ================================================================ the ground: a cube-sphere in chunks, one material that knows snow, rock, ice and ore
const groundU = { uSun: { value: sunDir }, uT: { value: 0 } };
const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
groundMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, groundU);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aSurf; varying vec3 vSurf; varying vec3 vWP; varying vec3 vWN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n vSurf = aSurf; vWP = position; vWN = normal;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vSurf; varying vec3 vWP; varying vec3 vWN; uniform vec3 uSun; uniform float uT; ${GLSL_NOISE}
      float gRock, gIce, gVein, gSpark;`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 up = normalize(vWP), wn = normalize(vWN); float hgt = length(vWP) - ${R.toFixed(1)}, dist = length(cameraPosition - vWP);
        float slope = 1. - dot(wn, up), n1 = vnoise(vWP*0.07), n2 = vnoise(vWP*0.6), n3 = vnoise(vWP*2.3);
        gRock = smoothstep(0.085, 0.17, slope + (n2 - 0.5)*0.05); gIce = smoothstep(0.35, 0.75, vSurf.x);
        // snow: a touch of blue in the hollows, wind ripples close up
        vec3 snow = mix(vec3(0.80, 0.86, 0.96), vec3(0.95, 0.96, 0.98), 0.45 + 0.55*n1); snow *= 0.96 + 0.04*n3*(1. - smoothstep(20., 70., dist));
        // rock: banded strata, snow caught on the ledges
        float strata = 0.5 + 0.5*sin(hgt*0.75 + n1*5.); vec3 rock = mix(vec3(0.10, 0.12, 0.17), vec3(0.23, 0.26, 0.33), strata); rock = mix(rock, snow, smoothstep(0.55, 0.8, n2)*0.55);
        // ice: dark and deep, with pale cracks
        float crack = 1. - smoothstep(0.0, 0.03, abs(vnoise(vWP*0.35) - 0.5)); vec3 ice = mix(vec3(0.035, 0.11, 0.18), vec3(0.45, 0.72, 0.85), crack*0.7);
        vec3 c = mix(snow, rock, gRock); c = mix(c, ice, gIce);
        // ore: where the planet has been cut open, the veins still glow
        gVein = (1. - smoothstep(0.0, 0.045, abs(vnoise(vWP*0.16 + 3.) - 0.5)))*gRock*smoothstep(0.25, 0.7, vSurf.y)*(1. - gIce);
        // sparkle: single grains catching the sun, changing as you move
        vec3 cell = floor(vWP*11.); float h = hash3(cell); vec3 vd = normalize(cameraPosition - vWP);
        gSpark = step(0.985, h)*smoothstep(0.55, 1., fract(h*91.7 + dot(vd, vec3(3.1, 4.7, 2.3))*2.))*(1. - smoothstep(25., 80., dist))*max(dot(up, uSun), 0.)*(1. - gRock)*(1. - gIce);
        diffuseColor.rgb = c; }`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(mix(0.93, 0.85, gRock), 0.07, gIce);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(0.08, 0.75, 1.6)*gVein*(1.5 + 0.5*sin(uT*1.3 + vWP.x*0.2)) + vec3(1.6, 1.7, 1.9)*gSpark;');
};
const chunks = [];
function buildGround(){
  const N = NFACE, CH = 8, per = N/CH, FACES = [[[1,0,0],[0,1,0],[0,0,1]], [[-1,0,0],[0,1,0],[0,0,-1]], [[0,1,0],[0,0,1],[1,0,0]], [[0,-1,0],[0,0,1],[-1,0,0]], [[0,0,1],[1,0,0],[0,1,0]], [[0,0,-1],[1,0,0],[0,-1,0]]];
  for (const [ax, au, av] of FACES){
    // the face's grid, one cell wider all round (for normals at the edges). equal-angle spacing keeps the cells even
    const G = N + 3, P = new Float32Array(G*G*3), S = new Float32Array(G*G*3);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++){
      const u = Math.tan(((i - 1)/N*2 - 1)*Math.PI/4), v = Math.tan(((j - 1)/N*2 - 1)*Math.PI/4);
      let x = ax[0] + au[0]*u + av[0]*v, y = ax[1] + au[1]*u + av[1]*v, z = ax[2] + au[2]*u + av[2]*v; const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      const s = W.sample(x, y, z), r = R + s.h, k = (j*G + i)*3; P[k] = x*r; P[k + 1] = y*r; P[k + 2] = z*r; S[k] = s.ice; S[k + 1] = s.cut; S[k + 2] = Math.min(1, s.dT/100);
    }
    const flip = new V3(...au).cross(new V3(...av)).dot(new V3(...ax)) < 0;
    for (let cj = 0; cj < CH; cj++) for (let ci = 0; ci < CH; ci++){
      const n = per + 1, pos = new Float32Array(n*n*3), nor = new Float32Array(n*n*3), srf = new Float32Array(n*n*3), idx = new Uint16Array(per*per*6);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){
        const gi = ci*per + i + 1, gj = cj*per + j + 1, k = (gj*G + gi)*3, o = (j*n + i)*3;
        pos[o] = P[k]; pos[o + 1] = P[k + 1]; pos[o + 2] = P[k + 2]; srf[o] = S[k]; srf[o + 1] = S[k + 1]; srf[o + 2] = S[k + 2];
        const a = k - 3, b = k + 3, c = k - G*3, d = k + G*3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[d] - P[c], vy = P[d + 1] - P[c + 1], vz = P[d + 2] - P[c + 2];
        let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx; if (nx*P[k] + ny*P[k + 1] + nz*P[k + 2] < 0){ nx = -nx; ny = -ny; nz = -nz; } const l = Math.hypot(nx, ny, nz) || 1; nor[o] = nx/l; nor[o + 1] = ny/l; nor[o + 2] = nz/l;
      }
      let q = 0; for (let j = 0; j < per; j++) for (let i = 0; i < per; i++){ const a = j*n + i, b = a + 1, c = a + n, d = c + 1; if (flip){ idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; } else { idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = c; } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('aSurf', new THREE.BufferAttribute(srf, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, groundMat); m.receiveShadow = true; m.userData.dir = g.boundingSphere.center.clone().normalize(); scene.add(m); chunks.push(m);
    }
  }
}

// ---- groomed trail: a ribbon just above the snow, corduroy across it, soft at the edges
const trailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
trailMat.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aT; varying vec3 vT; varying vec3 vWP2;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vT = aT; vWP2 = position;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vT; varying vec3 vWP2;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      { float dist = length(cameraPosition - vWP2), cord = 0.5 + 0.5*sin(vT.x*52.), near = 1. - smoothstep(18., 60., dist);
        diffuseColor.rgb = vec3(0.90, 0.93, 0.975)*(1. - 0.085*cord*near) ; diffuseColor.a = vT.z; }`);
};
function buildTrails(){
  for (const t of W.TRAILS){
    const M = t.pts.length, n = t.closed ? M + 1 : M, across = [-3.1, -2.5, 0, 2.5, 3.1], al = [0, 1, 1, 1, 0], K = across.length;
    const pos = new Float32Array(n*K*3), nor = new Float32Array(n*K*3), aT = new Float32Array(n*K*3), idx = []; let s = 0;
    for (let i = 0; i < n; i++){
      const p = t.pts[i % M], a = t.pts[(i - 1 + M) % M], b = t.pts[(i + 1) % M], tan = W.norm(t.closed || (i > 0 && i < M - 1) ? [b[0] - a[0], b[1] - a[1], b[2] - a[2]] : i === 0 ? [b[0] - p[0], b[1] - p[1], b[2] - p[2]] : [p[0] - a[0], p[1] - a[1], p[2] - a[2]]), side = W.cross(p, tan);
      if (i > 0) s += W.dist(t.pts[(i - 1) % M], p);
      for (let k = 0; k < K; k++){ const d = W.norm([p[0] + side[0]*across[k]/R, p[1] + side[1]*across[k]/R, p[2] + side[2]*across[k]/R]), r = R + W.height(d[0], d[1], d[2]) + 0.07, o = (i*K + k)*3;
        pos[o] = d[0]*r; pos[o + 1] = d[1]*r; pos[o + 2] = d[2]*r; nor[o] = d[0]; nor[o + 1] = d[1]; nor[o + 2] = d[2]; aT[o] = across[k]; aT[o + 1] = s; aT[o + 2] = al[k]; }
      if (i < n - 1) for (let k = 0; k < K - 1; k++){ const q = i*K + k; idx.push(q, q + K, q + 1, q + 1, q + K, q + K + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('aT', new THREE.BufferAttribute(aT, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, trailMat); m.receiveShadow = true; m.renderOrder = 1; scene.add(m);
  }
}

// ================================================================ scenery
const frameAt = (d, rotDeg, out = new THREE.Matrix4()) => { const [e, n] = W.basis(d), b = (rotDeg || 0)*Math.PI/180, f = [n[0]*Math.cos(b) + e[0]*Math.sin(b), n[1]*Math.cos(b) + e[1]*Math.sin(b), n[2]*Math.cos(b) + e[2]*Math.sin(b)];
  const z = new V3(-f[0], -f[1], -f[2]), y = v3(d), x = new V3().crossVectors(y, z).normalize(); z.crossVectors(x, y); return out.makeBasis(x, y, z); };
const groups = {}, termObj = {}, gateObj = {}, postObj = {}, buckets = [];        // groups: what lights up together (a loop's lamps, a road's pylons)
const addToGroup = (g, fn) => { (groups[g] = groups[g] || []).push(fn); };
let heart = null, portalObj = null;
function bucketOf(d){ const ax = Math.abs(d[0]), ay = Math.abs(d[1]), az = Math.abs(d[2]); let f, u, v; if (ax >= ay && ax >= az){ f = d[0] > 0 ? 0 : 1; u = d[1]/ax; v = d[2]/ax; } else if (ay >= az){ f = d[1] > 0 ? 2 : 3; u = d[0]/ay; v = d[2]/ay; } else { f = d[2] > 0 ? 4 : 5; u = d[0]/az; v = d[1]/az; } return f*9 + Math.min(2, Math.floor((u + 1)*1.5))*3 + Math.min(2, Math.floor((v + 1)*1.5)); }
function instanced(geo, mat, items, cast){   // items: [{ d, rot, scale, h }], split into buckets of the sphere so far ones can be skipped
  const by = new Map(); for (const it of items){ const b = bucketOf(it.d); if (!by.has(b)) by.set(b, []); by.get(b).push(it); }
  const m4 = new THREE.Matrix4(), sc = new V3(), out = [];
  for (const list of by.values()){
    const g = geo.clone(), im = new THREE.InstancedMesh(g, mat, list.length), c = new V3();
    list.forEach((it, i) => { const r = R + (it.h !== undefined ? it.h : W.height(it.d[0], it.d[1], it.d[2])); frameAt(it.d, it.rot, m4); sc.setScalar(it.scale || 1); m4.scale(sc); m4.setPosition(it.d[0]*r, it.d[1]*r, it.d[2]*r); im.setMatrixAt(i, m4); c.add(v3(it.d)); });
    c.normalize(); let far = 0; for (const it of list) far = Math.max(far, v3(it.d).angleTo(c)); g.boundingSphere = new THREE.Sphere(c.clone().multiplyScalar(R), far*R + 30);
    im.castShadow = !!cast; im.receiveShadow = false; im.userData.dir = c; scene.add(im); buckets.push(im); out.push(im);
  }
  return out;
}
function buildScenery(){
  const big = { ribs: 1, arch: 1, watcher: 1, heart: 1 };
  const poles = [], lamps = {};
  for (const s of W.SITES){
    if (s.kind === 'pole'){ poles.push(s); (lamps[s.group] = lamps[s.group] || []).push(s); continue; }
    const build = PROPS.build[s.kind]; if (!build) continue;
    const g = build(s), h = W.height(s.d[0], s.d[1], s.d[2]), r = R + h - (big[s.kind] ? 1.2 : 0.05);
    g.applyMatrix4(frameAt(s.d, s.rot)); g.scale.setScalar(s.scale || 1); g.position.set(s.d[0]*r, s.d[1]*r, s.d[2]*r);
    g.traverse(o => { if (o.isMesh && !(o.material && o.material.isMeshBasicMaterial)){ o.castShadow = SHADOWS && !big[s.kind]; } });
    g.userData.site = s; g.userData.dir = v3(s.d); scene.add(g);
    if (s.kind === 'terminal') termObj[s.name] = g; else if (s.kind === 'gate' || s.kind === 'crystalgate') gateObj[s.name] = g; else if (s.kind === 'post') postObj[s.name.slice(0, -5)] = g;
    else if (s.kind === 'pylon') addToGroup(s.group, on => g.userData.lit(on));
    else if (s.kind === 'heart') heart = g; else if (s.kind === 'portal') portalObj = g;
  }
  instanced(PROPS.poleGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), poles, false);
  for (const k of Object.keys(lamps)){ const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.28, 0.32) }); instanced(PROPS.lampGeo(), mat, lamps[k], false);
    addToGroup(k, on => mat.color.setRGB(on ? 0.7 : 0.25, on ? 2.4 : 0.28, on ? 3.0 : 0.32)); }
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  instanced(PROPS.treeGeo(0x1f4a3d, 0xeef3f8), treeMat, W.TREES.filter(t => t.kind === 0).map(t => ({ d: t.d, rot: t.rot, scale: t.s })), SHADOWS);
  instanced(PROPS.treeGeo(0x6f93a6, 0xf6f9fc), treeMat, W.TREES.filter(t => t.kind === 1).map(t => ({ d: t.d, rot: t.rot, scale: t.s })), SHADOWS);
}
// ---- the Ascent: dark rails until the beacons are lit, then a deck of light
const bridgeMats = { deck: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.4, 1.5), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false }), rail: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.2, 0.26), fog: false }) };
function buildBridge(){
  const B = W.BRIDGE, n = B.pts.length, hw = B.halfW, deck = new Float32Array(n*2*3), di = [], railP = [], railI = [];
  for (let i = 0; i < n; i++){ const p = B.pts[i], a = B.pts[Math.max(0, i - 1)], b = B.pts[Math.min(n - 1, i + 1)], tan = W.norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), side = W.cross(p, tan), r = R + B.h[i];
    for (const [k, sd] of [[0, -1], [1, 1]]){ const o = (i*2 + k)*3; deck[o] = (p[0] + side[0]*sd*hw/R)*r; deck[o + 1] = (p[1] + side[1]*sd*hw/R)*r; deck[o + 2] = (p[2] + side[2]*sd*hw/R)*r;
      for (const dy of [0.02, 0.55]) railP.push(deck[o]*(1 + dy/r), deck[o + 1]*(1 + dy/r), deck[o + 2]*(1 + dy/r)); }
    if (i < n - 1){ const q = i*2; di.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); for (const k of [0, 2]){ const e = i*4 + k; railI.push(e, e + 4, e + 1, e + 1, e + 4, e + 5); } }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(deck, 3)); g.setIndex(di); const m = new THREE.Mesh(g, bridgeMats.deck); m.frustumCulled = false; m.renderOrder = 2; scene.add(m);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(railP, 3)); rg.setIndex(railI); const rm = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: bridgeMats.rail.color, side: THREE.DoubleSide, fog: false })); bridgeMats.rail = rm.material; rm.frustumCulled = false; scene.add(rm);
}

// ---- the herd that comes to watch: four moose of light, each taller than the mound, standing round the Heartcrystal
// once every beacon is lit (after the ritual painting)
const cosmic = [];
function buildCosmic(){
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.3, 1.25), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  for (let k = 0; k < 4; k++){ const d = W.offset(W.SPIRE, 215, 45 + k*90), g = PROPS.build.moose({}), r = R + W.height(d[0], d[1], d[2]) - 2;
    g.traverse(o => { if (o.isMesh){ o.material = mat; o.castShadow = false; } }); g.applyMatrix4(frameAt(d, W.bearing(d, W.SPIRE))); g.scale.setScalar(34); g.position.set(d[0]*r, d[1]*r, d[2]*r); g.visible = false; scene.add(g); cosmic.push(g); }
  cosmic.mat = mat;
}

// ---- the drawbridges: two leaves, up until the post lowers them
const draws = [];
function buildDraws(){
  const M = PROPS.MAT;
  for (const D of W.DRAWS){
    const n = D.pts.length, L = D.s[n - 1], half = L/2 + 0.2, leaves = [], lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.3, 0.3), fog: false });
    for (const end of [0, 1]){
      const p = D.pts[end ? n - 1 : 0], q = D.pts[end ? n - 4 : 3], brg = W.bearing(p, q), r = R + D.h[end ? n - 1 : 0], g = new THREE.Group(), leaf = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.BoxGeometry(D.halfW*2, 0.5, half), M.dark); deck.position.set(0, -0.27, -half/2); leaf.add(deck);
      const top = new THREE.Mesh(new THREE.BoxGeometry(D.halfW*2 - 1, 0.06, half), M.panel); top.position.set(0, 0.0, -half/2); leaf.add(top);
      for (const sd of [-1, 1]){ const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, half), M.orange); rail.position.set(sd*(D.halfW - 0.1), 0.45, -half/2); leaf.add(rail);
        const tower = new THREE.Mesh(new THREE.BoxGeometry(1.3, 9, 1.6), M.steel); tower.position.set(sd*(D.halfW + 1.2), 3.5, 0.6); g.add(tower);
        const lit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), lamp); lit.position.set(sd*(D.halfW + 1.2), 8.6, 0.6); g.add(lit); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(D.halfW*2 + 4, 0.8, 1.2), M.orange); beam.position.set(0, 7.6, 0.6); g.add(beam);
      g.add(leaf); g.applyMatrix4(frameAt(p, brg)); g.position.set(p[0]*r, p[1]*r, p[2]*r); g.traverse(o => { if (o.isMesh) o.castShadow = SHADOWS; }); scene.add(g); leaves.push(leaf);
    }
    draws.push({ name: D.name, leaves, lamp, up: 1, want: 1 });
  }
}

// ================================================================ the game: the rules are game-core.js (the same module v2 uses), reading W.GAME
const SAVE = 'hale-v3-story', G = SkiGame.create(W.GAME, R);
try { const s = localStorage.getItem(SAVE); if (s) G.restore(s); } catch (e) {}
for (const c of (Q.get('cheat') || '').split(',')) if (c) G.cheat(c);        // ?cheat=zone1,zone2,bridges ... for testing
let ended = false, lastRev = -1, solidObjs = [];
const orbGeo = new THREE.SphereGeometry(0.38, 12, 8), orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.9, 0.5), fog: false }), orbPool = [];
function syncOrbs(){
  const list = G.orbs(); while (orbPool.length < list.length){ const o = new THREE.Mesh(orbGeo, orbMat); scene.add(o); orbPool.push(o); }
  orbPool.forEach((o, i) => { const it = list[i]; o.visible = !!it && !it.got; if (o.visible){ const d = it.d, r = R + W.height(d[0], d[1], d[2]) + 1.25; o.position.set(d[0]*r, d[1]*r, d[2]*r); } });
}
const toastQ = []; let toastUntil = 0; const toast = t => toastQ.push(t);
function syncGame(){
  if (G.rev === lastRev) return; lastRev = G.rev; const st = G.state();
  for (const t of W.TERMINALS) termObj[t.name].userData.set(G.modelVariant(t.name, 'kiosk'));
  for (const g of W.GATES){ const on = G.gateOpen(g.name); gateObj[g.name].userData.open(on); for (const s of solidObjs) if (s.gate === g.name) s.off = on; }
  W.BRIDGES.forEach((b, i) => { sk.bridges[i].locked = !G.bridgeOpen(b.name); });
  for (const D of draws){ const open = G.bridgeOpen(D.name), w = W.DRAWS.find(q => q.name === D.name).when; D.want = open ? 0 : 1; D.lamp.color.setRGB(open ? 0.4 : 2.4, open ? 2.4 : 0.3, open ? 1.2 : 0.3); postObj[D.name].userData.set(open ? 2 : G.zoneDone(w.zone) ? 1 : 0); }
  const asc = G.bridgeOpen('The Ascent'); portalObj.userData.lit(asc); bridgeMats.deck.opacity = asc ? 0.55 : 0; bridgeMats.rail.color.setRGB(asc ? 1.6 : 0.2, asc ? 0.9 : 0.2, asc ? 3.2 : 0.26);
  for (const z of [1, 2, 3, 4]) (groups[z] || []).forEach(f => f(z === 4 ? !!st.offered : G.zoneDone(z)));
  syncOrbs();
  try { localStorage.setItem(SAVE, G.serialize()); } catch (e) {}
}
const checkpoint = () => { const c = G.checkpoint(); return c ? v3(c) : null; };
function gameStep(dt){
  const n = sk.n; G.update({ n: [n.x, n.y, n.z], ug: -1 }); syncGame();
  while (G.toasts.length) toast(G.toasts.shift());
  for (const D of draws){ D.up += (D.want - D.up)*Math.min(1, dt*1.4); for (const l of D.leaves) l.rotation.x = D.up*1.08; }
  const B = sk.onBridge; if (B && B.b.src.src === W.BRIDGE && B.i >= B.b.V.length - 6){ sk.S.vx = sk.S.vy = 0; if (!ended){ ended = true; showEnd(); } }
}
function showEnd(){ $('endTxt').textContent = 'You stand on the Heartcrystal, 215 metres over the snow, and the herd has come to watch.'; $('end').style.display = 'flex'; }
$('keepBtn').onclick = () => { $('end').style.display = 'none'; };
$('newBtn').onclick = () => { G.reset(); try { localStorage.removeItem(SAVE); } catch (e) {} location.href = location.pathname; };
$('offer').onclick = () => { G.confirm(); };

// ================================================================ build, then go
let sk = null;
function boot(){
  buildGround(); buildTrails(); buildScenery(); buildBridge(); buildDraws(); buildCosmic();
  solidObjs = W.SOLIDS.map(s => ({ d: v3(s.d), r: s.r, gate: s.gate }));
  sk = createSkier({ THREE, scene, camera, R, stop: W.STOP, height: W.height,
    trails: W.TRAILS.map(t => ({ name: t.name, closed: t.closed, pts: t.pts.map(v3) })), junctions: W.JUNCTIONS.map(v3),
    bridges: W.BRIDGES.map(B => ({ pts: B.pts.map(v3), s: B.s, h: B.h, halfW: B.halfW, src: B })), solids: solidObjs, confirm: () => G.confirm(),
    start: v3(W.START.d), buildSkier: () => buildSkierV3(THREE), checkpoint, camdInput: { min: 6, max: 40, step: 0.5, get value(){ return sk ? sk.P.camd : 15; }, set value(v){ if (sk) sk.P.camd = +v; }, dispatchEvent(){} } });
  sk.fig.traverse(o => { if (o.isMesh && o.geometry.type !== 'CircleGeometry') o.castShadow = SHADOWS; });
  syncGame();
  for (const z of W.ZONES.slice(0, 3)){ const p = document.createElement('span'); p.className = 'pip'; p.innerHTML = '<i></i><span></span>'; p.id = 'pip' + z.id; $('pips').appendChild(p); }
  $('viewBtn').onclick = e => { sk.toggleView(); e.currentTarget.blur(); }; $('resetBtn').onclick = e => { sk.reset(); e.currentTarget.blur(); };
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'h' && !e.repeat) document.body.classList.toggle('clean'); });
  $('load').style.display = 'none';
  window.__hale = { W, sk, G, scene, camera, renderer, get ended(){ return ended; }, set dayPhase(v){ dayPhase = v; }, get dayPhase(){ return dayPhase; }, place(lon, lat, brg){ const d = v3(W.ll(lon, lat)); sk.TEST.place(d); if (brg !== undefined){ const b = W.basis(W.ll(lon, lat)), r = brg*Math.PI/180, f = new V3(b[1][0]*Math.cos(r) + b[0][0]*Math.sin(r), b[1][1]*Math.cos(r) + b[0][1]*Math.sin(r), b[1][2]*Math.cos(r) + b[0][2]*Math.sin(r)); sk.S.th = sk.S.tgt = Math.atan2(f.dot(sk.ex), -f.dot(sk.ey)); } } };
  requestAnimationFrame(frame);
}
// ---- the frame
let last = performance.now(), hudT = 0, t0 = last, awake = 0; const _c = new V3(), _m = new THREE.Color(), _n = new THREE.Color();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last)/1000); last = now; const t = (now - t0)/1000;
  sk.pollPad();
  const nsub = Math.max(1, Math.ceil(dt*60 - 1e-6)); for (let i = 0; i < nsub; i++){ sk.bridgeAssist(dt/nsub); sk.step(dt/nsub); }
  gameStep(dt); sk.poseFigure(dt); const viewK = sk.placeCamera(dt); sk.updateMarks();
  const n = sk.n;
  // the sun goes round the planet's axis once a "day"; where you stand decides day or night
  dayPhase = (dayPhase + dt/(DAY_MIN*60)) % 1; const a = dayPhase*Math.PI*2; sunDir.set(Math.cos(a), 0.33, Math.sin(a)).normalize();
  const se = n.dot(sunDir), dayK = smooth01(-0.14, 0.16, se), tw = smooth01(-0.3, -0.02, se)*(1 - smooth01(0.08, 0.4, se)), low = 1 - smooth01(0.0, 0.35, se);
  const here = _c.copy(n).multiplyScalar(sk.surfaceR());
  sun.color.setRGB(1.0, 0.96 - 0.38*low, 0.88 - 0.62*low); sun.intensity = 0.95*smooth01(-0.06, 0.06, se) + 0.0001;
  sun.position.copy(here).addScaledVector(sunDir, 300); sun.target.position.copy(here); sun.target.updateMatrixWorld();
  shine.position.copy(here).addScaledVector(MOTHER, 300); shine.target.position.copy(here); shine.target.updateMatrixWorld(); shine.intensity = 0.04 + 0.19*(1 - dayK);
  hemi.position.copy(n); hemi.color.setRGB(0.045 + 0.55*dayK, 0.04 + 0.71*dayK, 0.12 + 0.86*dayK); hemi.groundColor.setRGB(0.025 + 0.45*dayK, 0.02 + 0.49*dayK, 0.06 + 0.56*dayK); hemi.intensity = 0.42;
  _m.setRGB(0.50, 0.70, 0.95); _n.setRGB(0.030, 0.016, 0.070); scene.fog.color.copy(_n).lerp(_m, dayK); scene.fog.color.r += 0.5*tw; scene.fog.color.g += 0.16*tw;
  scene.fog.near = 140 + 2000*viewK; scene.fog.far = 1500 + 20000*viewK;
  skyU.uUp.value.copy(n); skyU.uDay.value = dayK; skyU.uTw.value = tw; skyU.uFog.value.copy(scene.fog.color); skyU.uT.value = t; groundU.uT.value = t;
  sky.position.copy(camera.position);
  mother.position.copy(camera.position).addScaledVector(MOTHER, MOTHER_D); ringM.position.copy(mother.position); motherU.uDay.value = dayK; motherU.uSky.value.setRGB(0.30, 0.50, 0.86);
  moon.position.copy(camera.position).addScaledVector(MOON, R*9);
  { const o = t*2*Math.PI/200; station.position.set(Math.cos(o)*R*2.1, Math.sin(o)*R*1.2, Math.sin(o)*R*1.7); station.rotation.y = t*0.05; station.rotation.x = 0.5; }
  finalMat.uniforms.expo.value = 1.1 + 0.3*(1 - dayK);
  // skip what is round the back of the planet
  const lim = viewK > 0.02 ? -2 : 0.42; for (const c of chunks) c.visible = c.userData.dir.dot(n) > lim - 0.12; for (const b of buckets) b.visible = b.userData.dir.dot(n) > lim;
  const st = G.state(), powered = Object.keys(st.powered).length;
  if (heart){ awake += ((st.ceremony ? 1 : powered*0.05) - awake)*Math.min(1, dt); heart.userData.wake(awake*(0.85 + 0.15*Math.sin(t*1.1))); }
  { const k = 0.75 + 0.25*Math.sin(t*3); orbMat.color.setRGB(3.0*k, 1.9*k, 0.5*k); }
  { const want = st.ceremony ? (0.10 + 0.16*(1 - dayK))*(1 + 0.15*Math.sin(t*0.7)) : 0; cosmic.mat.opacity += (want - cosmic.mat.opacity)*Math.min(1, dt*0.5); for (const g of cosmic) g.visible = cosmic.mat.opacity > 0.004; }
  renderFrame();
  hudT -= dt; if (hudT <= 0){ hudT = 0.12; hud(now); }
}
function hud(now){
  const n = sk.n, kmh = sk.speed()*3.6, st = G.state(); $('kmh').firstChild.nodeValue = Math.round(kmh);
  const where = sk.steep > 0 ? 'Too steep' : sk.onBridge ? sk.onBridge.b.src.src.name : sk.trailName || 'Ungroomed'; if (sk.steep > 0) sk.steep = Math.max(0, sk.steep - 0.12);
  $('where').textContent = where + (sk.mode ? ' · ' + sk.mode : '');
  const goal = G.goal(); $('goal').textContent = goal.title; $('detail').textContent = goal.detail || '';
  for (const z of W.ZONES.slice(0, 3)){ const [a, b] = G.zoneCount(z.id), p = $('pip' + z.id); p.lastChild.textContent = z.name + ' ' + a + '/' + b; p.classList.toggle('on', a === b); p.classList.toggle('here', a < b && (z.id === 1 || G.zoneDone(z.id - 1))); }
  // what the arrow points at: the next orb of the terminal that is running, or that terminal once they are all in;
  // otherwise the nearest terminal still dark in the zone you are working on, or the post that lowers the bridge to it
  let target = null, label = '';
  const nearest = list => { let best = null, bd = 1e9; for (const it of list){ const d = v3(it.d).angleTo(n); if (d < bd){ bd = d; best = it; } } return best; };
  if (st.active){ const left = G.orbs().filter(o => !o.got); if (left.length){ target = nearest(left).d; label = 'Orb'; } else { target = W.TERMINALS.find(t => t.name === st.active).d; label = st.active; } }
  else { const z = [1, 2, 3].find(q => !G.zoneDone(q));
    if (z === 3 && !G.bridgeOpen('East drawbridge')){ target = W.GAME.bridges.find(b => b.name === 'East drawbridge').post; label = 'Bridge post'; }
    else if (z){ const t = nearest(W.TERMINALS.filter(q => q.zone === z && !st.powered[q.name])); target = t.d; label = t.name; } }
  $('way').style.visibility = target ? 'visible' : 'hidden';
  if (target){ const tv = v3(target), d = tv.angleTo(n)*R, rel = tv.addScaledVector(n, -tv.dot(n)), brg = Math.atan2(rel.dot(sk.ex), -rel.dot(sk.ey)) - sk.heading();
    $('arrow').style.transform = 'rotate(' + (brg*180/Math.PI).toFixed(0) + 'deg)'; $('wayTxt').textContent = label + ' · ' + (d >= 1000 ? (d/1000).toFixed(1) + ' km' : Math.round(d) + ' m'); }
  // an offer to agree to (Enter, E, the A button, or a tap), or the reason something will not open
  const pr = G.prompt, off = $('offer');
  if (pr){ off.style.display = 'block'; $('offerT').textContent = pr.text; $('offerD').textContent = pr.detail || ''; } else off.style.display = 'none';
  $('hint').textContent = !pr && G.hint ? G.hint : ''; $('hint').style.display = !pr && G.hint ? 'block' : 'none';
  if (toastQ.length && now > toastUntil - 400){ $('toast').textContent = toastQ.shift(); $('toast').classList.add('on'); toastUntil = now + 3200; }
  else if (now > toastUntil) $('toast').classList.remove('on');
}
setTimeout(boot, 30);
})();
