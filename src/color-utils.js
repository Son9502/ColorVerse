import {clamp} from './utils.js';
// Color conversion and mapping utilities
export function hslToRgb(h, s, l) {
  h = h % 360;
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r = 0, g = 0, b = 0;

  if (0 <= hp && hp < 1) [r, g, b] = [c, x, 0];
  else if (1 <= hp && hp < 2) [r, g, b] = [x, c, 0];
  else if (2 <= hp && hp < 3) [r, g, b] = [0, c, x];
  else if (3 <= hp && hp < 4) [r, g, b] = [0, x, c];
  else if (4 <= hp && hp < 5) [r, g, b] = [x, 0, c];
  else if (5 <= hp && hp < 6) [r, g, b] = [c, 0, x];

  const m = l - c / 2;

  let rLin = r + m;
  let gLin = g + m;
  let bLin = b + m;

  return {
    r: rLin,
    g: gLin,
    b: bLin
  };
}
// Gamma correction from linear to sRGB (Expect 0-1 input -> 0-255 output)
export function linearToSRGB(c) {
  let s;
  s = c <= 0.0031308
    ? 12.92 * c
    : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(clamp(s, 0, 1) * 255);
}
// Gamma correction from sRGB to linear (Expect 0-255 input -> 0-1 output)
export function SRGBtoLinear(s) {
  let c = s / 255;
  return c <= 0.04045
    ? c / 12.92
    : Math.pow((c + 0.055) / 1.055, 2.4);
}
// Compute color for given x, y, layer, faceMap, colorSpace, and size
export function computeCubeColor(x, y, layer, faceMap, colorSpace, size) {
  const t = layer / 127;
  const u = x / (size - 1);
  const v = y / (size - 1);

  if (colorSpace === 'RGB') {
    let r, g, b;
    switch (faceMap.fixed.channel) {
      case 'r': r = faceMap.fixed.value; g = v; b = u; break;
      case 'g': g = faceMap.fixed.value; r = u; b = v; break;
      case 'b': b = faceMap.fixed.value; r = u; g = v; break;
    }
    // Adjust based on layer 
    const mini = layer;;
    const maxi = 255 - layer;

    r = mini + r * (maxi - mini) / 255;
    g = mini + g * (maxi - mini) / 255;
    b = mini + b * (maxi - mini) / 255;
    const rLin = clamp(r, 0, 1);
    const gLin = clamp(g, 0, 1);
    const bLin = clamp(b, 0, 1);
    
    // Values returned are in linear space [0,1]
    return {
      r: rLin,
      g: gLin,
      b: bLin
    };
  } else {
    let h, s, l;

    const center = (size - 1) / 2;

    // Hue evaluation
    if (faceMap.loop) {
      const dx = x - center;
      const dy = y - center;
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += 2 * Math.PI;
      h = angle / (2 * Math.PI);
    }
    else {
      const shrink = t * 45;
      const h_min = faceMap.x_start * 90 + shrink;
      const h_max = (faceMap.x_start + 1) * 90 - shrink;
      h = (h_min + u * (h_max - h_min)) / 360;
    }

    // Saturation evaluation
    const maxR = Math.sqrt(2) * center;
    const radius = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
    s = ((127 - layer) / 127) * (0.7 + 0.3 * Math.min(radius / maxR, 1));

    // Lightness evaluation
    const L_min = 0.5 * t;
    const L_max = 1 - (0.5 * t);
    // Top and Bottom faces have inverted Lightness
    l = faceMap.loop ? (faceMap.y_start === 0 ? L_max - v * (L_max - L_min): L_min + v * (L_max - L_min)) : L_min + v * (L_max - L_min);

    return hslToRgb(h * 360, s * 100, l * 100);
  }

}

export function computeSphereColor(x, y, layer, colorSpace, size) {
  // Normalize x and y to [-1, 1]
  const t = layer / 127;

  const nx = (x + 0.5) / size * 2 - 1;
  const ny = (y + 0.5) / size * 2 - 1;

  // Compute z based on sphere equation
  const r = Math.sqrt(nx * nx + ny * ny);
  if (r > 1) {
    return { r: 0, g: 0, b: 0};
  }
  const nz = Math.sqrt(1 - r * r);

  // Normalize the vector
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  const dx = nx / length;
  const dy = ny / length;
  const dz = nz / length;
  if (colorSpace === 'RGB') {
    // Map to RGB values
    const mini = layer;
    const maxi = 255 - layer;
    const center = (mini + maxi) / 2;
    const halfRange = (maxi - mini) / 2;

    // Find the scaling factor to fit within the RGB cube
    const tx = dx !== 0 ? halfRange / Math.abs(dx) : Infinity;
    const ty = dy !== 0 ? halfRange / Math.abs(dy) : Infinity;
    const tz = dz !== 0 ? halfRange / Math.abs(dz) : Infinity;

    const scale = Math.min(tx, ty, tz);

    // Linear RGB in [0,1] space
    let rLin = clamp((center + dx * scale) / 255, 0, 1);
    let gLin = clamp((center + dy * scale) / 255, 0, 1);
    let bLin = clamp((center + dz * scale) / 255, 0, 1);

    return { r: rLin, g: gLin, b: bLin };
  } else {
    // Compute HSL values

    // Angluar for Hue
    let h = Math.atan2(dz, dx) / (2 * Math.PI);
    if (h < 0) h += 1;

    // Radius for Saturation
    let s = Math.sqrt(dx * dx + dz * dz);
    s = ((127 - layer) / 127) * s;

    // Y for Lightness
    
    const mini = t * 0.5;
    const maxi = 1 - (t * 0.5);
    let l = (dy + 1) / 2;
    l = mini + l * (maxi - mini);

    // Clamp S and L

    s = clamp(s, 0, 1);
    l = clamp(l, 0, 1);

    return hslToRgb(h * 360, s * 100, l * 100);

  }
}
// Shader material generators for RGB and HSL for the mini 3d objects
export function makeRGBMat({ shininess = 30, specular = 0.5, snapStrength = 0.6 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      snapStrength: { value: snapStrength },
      shininess: { value: shininess },
      specular: { value: specular },
      lightDir: { value: new THREE.Vector3(1, 1, 1).normalize() },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      
      uniform vec3 lightDir;
      uniform float shininess;  
      uniform float specular;
      uniform float snapStrength;

      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 pos = vPos;

        // RGB based on normal
        vec3 color = clamp((pos + 1.0) * 0.5, 0.0, 1.0);

        // -----------------------------
        // Snap point glow (8 points)
        // -----------------------------
        float snap =
          exp(-35.0 * distance(n, vec3( 1, 0, 0))) +
          exp(-35.0 * distance(n, vec3(-1, 0, 0))) +
          exp(-35.0 * distance(n, vec3( 0, 0, 1))) +
          exp(-35.0 * distance(n, vec3( 0, 0,-1))) +
          exp(-35.0 * distance(n, vec3( 0, 1, 0))) +
          exp(-35.0 * distance(n, vec3( 0,-1, 0)));

        color += snap * snapStrength;

        // Blinn-Phong Specular highlight
        vec3 L = normalize(lightDir);
        vec3 V = normalize(-pos);
        vec3 H = normalize(L + V);
        float NdotH = max(dot(n, H), 0.0);
        float spec = pow(NdotH, shininess) * specular;
        color += spec;

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
}

export function makeHSLMat({ shininess = 30, specular = 0.5, snapStrength = 0.6 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      snapStrength: { value: snapStrength },
      shininess: { value: shininess },
      specular: { value: specular },
      lightDir: { value: new THREE.Vector3(1, 1, 1).normalize() },
    },
    vertexShader: `
      varying vec3 vPos;
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform float shininess;  
      uniform float specular;
      uniform float snapStrength;
      uniform vec3 lightDir;
      
      varying vec3 vNormal;
      varying vec3 vPos;

      const float PI = 3.14159265;

      float hue2rgb(float p, float q, float t) {
          if(t < 0.0) t += 1.0;
          if(t > 1.0) t -= 1.0;
          if(t < 1.0/6.0) return p + (q - p) * 6.0 * t;
          if(t < 1.0/2.0) return q;
          if(t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
          return p;
      }
      vec3 hsl2rgb(float h, float s, float l) {
        float r, g, b; 
        float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
        float p = 2.0 * l - q;
        
        r = hue2rgb(p, q, h + 1.0/3.0);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1.0/3.0);
        return vec3(r, g, b);
      }
      void main() {
        vec3 n = normalize(vNormal);
        vec3 pos = vPos;
        

        // Compute HSL (angle for H, radius for S, Y for L)
        float radius = length(pos.xz);
        float h = fract(atan(pos.z, pos.x) / (2.0 * PI));
        float s = clamp(radius, 0.0, 1.0); 
        float l = clamp(pos.y * 0.5 + 0.5, 0.05, 0.95);
         
        // Base Lightness color
        vec3 color = hsl2rgb(h, s, l);
        
        // -----------------------------
        // Snap point glow (8 points)
        // -----------------------------
        float snap =
          exp(-35.0 * distance(n, vec3( 1, 0, 0))) +
          exp(-35.0 * distance(n, vec3(-1, 0, 0))) +
          exp(-35.0 * distance(n, vec3( 0, 0, 1))) +
          exp(-35.0 * distance(n, vec3( 0, 0,-1))) +
          exp(-35.0 * distance(n, vec3( 0, 1, 0))) +
          exp(-35.0 * distance(n, vec3( 0,-1, 0)));

        color += snap * snapStrength;

        // Blinn-Phong Specular highlight
        vec3 L = normalize(lightDir);
        vec3 V = normalize(-pos);
        vec3 H = normalize(L + V);
        float NdotH = max(dot(n, H), 0.0);
        float spec = pow(NdotH, shininess) * specular;
        color += spec;

        gl_FragColor = vec4(color, 1.0);
      }`
  });
}