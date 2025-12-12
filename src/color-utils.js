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
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}
/**
 * Cube face mapping for RGB/HSL
 */
export function colorMap(colorSpace) {
  if (colorSpace === 'RGB') {
    return [
      { x: { channel: "r", start: 0 }, y: { channel: "g", start: 1 }, fixed: { channel: "b", value: 0 } },
      { x: { channel: "b", start: 0 }, y: { channel: "g", start: 1 }, fixed: { channel: "r", value: 1 } },
      { x: { channel: "r", start: 1 }, y: { channel: "g", start: 1 }, fixed: { channel: "b", value: 1 } },
      { x: { channel: "b", start: 1 }, y: { channel: "g", start: 1 }, fixed: { channel: "r", value: 0 } },
      { x: { channel: "r", start: 0 }, y: { channel: "b", start: 1 }, fixed: { channel: "g", value: 1 } },
      { x: { channel: "r", start: 0 }, y: { channel: "b", start: 0 }, fixed: { channel: "g", value: 0 } },
    ];
  } else {
    return [
      { x: { channel: "h", start: 0 }, y: { channel: "s", start: 1 }, fixed: { channel: "l", value: 0 } },
      { x: { channel: "l", start: 0 }, y: { channel: "s", start: 1 }, fixed: { channel: "h", value: 1 } },
      { x: { channel: "h", start: 1 }, y: { channel: "s", start: 1 }, fixed: { channel: "l", value: 1 } },
      { x: { channel: "l", start: 1 }, y: { channel: "s", start: 1 }, fixed: { channel: "h", value: 0 } },
      { x: { channel: "h", start: 0 }, y: { channel: "l", start: 1 }, fixed: { channel: "s", value: 1 } },
      { x: { channel: "h", start: 0 }, y: { channel: "l", start: 0 }, fixed: { channel: "s", value: 0 } },
    ];
  }
}
// Compute color for given x, y, layer, faceMap, colorSpace, and size
export function computeColor(x, y, layer, faceMap, colorSpace, size) {
  const cx = x / (size - 1);
  const cy = y / (size - 1);

  if (colorSpace === 'RGB') {
    let r, g, b;
    switch (faceMap.fixed.channel) {
      case 'r': r = faceMap.fixed.value; g = cy; b = cx; break;
      case 'g': g = faceMap.fixed.value; r = cx; b = cy; break;
      case 'b': b = faceMap.fixed.value; r = cx; g = cy; break;
    }
    r = layer + Math.round(r * (size - 1));
    g = layer + Math.round(g * (size - 1));
    b = layer + Math.round(b * (size - 1));
    return { r, g, b };
  } else {
    let h, s, l;
    switch (faceMap.fixed.channel) {
      case 'h': h = faceMap.fixed.value; s = cy; l = cx; break;
      case 's': s = faceMap.fixed.value; h = cx; l = cy; break;
      case 'l': l = faceMap.fixed.value; h = cx; s = cy; break;
    }
    h = Math.min(360, Math.max(0, (layer / 255) * 360 + (h * (size - 1) / 255) * 360));
    s = Math.min(100, Math.max(0, (layer / 255) * 100 + (s * (size - 1) / 255) * 100));
    l = Math.min(100, Math.max(0, (layer / 255) * 100 + (l * (size - 1) / 255) * 100));
    return { h, s, l };
  }
}
// Shader material generators for RGB and HSL for the mini sphere
export function makeRGBMat({ poleBlend = 0.15, tintStrength = 1.0, lineStrength = 0.2 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      poleBlend: { value: poleBlend },
      tintStrength: { value: tintStrength },
      lineStrength: { value: lineStrength }
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float poleBlend;
      uniform float tintStrength;
      uniform float lineStrength;
      varying vec3 vPos;
      void main() {
        vec3 vNormal = normalize(vPos);

        // Tints based on normal direction
        vec3 color = mix(vec3(0.2,0,0), vec3(1,0.2,0.2),max(0.0, vNormal.x)) +
                     mix(vec3(0,0.2,0), vec3(0.2,1,0.2),max(0.0, vNormal.y)) +
                     mix(vec3(0,0,0.2), vec3(0.2,0.2,1),max(0.0, vNormal.z));
        
        color *= tintStrength;
        
        // Axis lines
        float line = (1.0 - smoothstep(0.0, poleBlend, abs(vNormal.x))) +
                      (1.0 - smoothstep(0.0, poleBlend, abs(vNormal.y))) +
                      (1.0 - smoothstep(0.0, poleBlend, abs(vNormal.z)));
        color = mix(color, vec3(1.0), line * lineStrength);

        // Pole blending
        float north = smoothstep(0.7, 1.0, vNormal.y);
        float south = smoothstep(-1.0, -0.7, vNormal.y);
        color = mix(color, vec3(1.0), north * poleBlend);
        color = mix(color, vec3(0.0), south * poleBlend);

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
}
export function makeHSLMat({ poleBlend = 1.0, hueRing = 0.2 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      poleBlend: { value: poleBlend },
      hueRing: { value: hueRing }
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float poleBlend;
      uniform float hueRing;
      varying vec3 vPos;

      vec3 hsl2rgb(float h, float s, float l) {
        float r, g, b; 
        float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
        float p = 2.0 * l - q;
        float hue2rgb(float p, float q, float t) {
          if(t < 0.0) t += 1.0;
          if(t > 1.0) t -= 1.0;
          if(t < 1.0/6.0) return p + (q - p) * 6.0 * t;
          if(t < 1.0/2.0) return q;
          if(t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
          return p;
      }
      r = hue2rgb(p, q, h + 1.0/3.0);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1.0/3.0);
      return vec3(r, g, b);
    }
    void main() {
      vec3 vNormal = normalize(vPos);

      // Compute HSL based on normal
      float h = fract(atan(vNormal.y, vNormal.x) / (2.0 * 3.14159265));
      float s = length(vNormal.xy);
      float l = (vNormal.z + 1.0) / 2.0;

      // Apply hue ring effect
      vec3 color = hsl2rgb(h, 1, 0.5);
      color = mix(vec3(l), color, s);

      // Achromatic component
      float core = 1.0 - s;
      color = mix(color, vec3(l), core);

      // Pole blending
      float north = smoothstep(0.7, 1.0, vNormal.z);
      float south = smoothstep(-1.0, -0.7, vNormal.z);
      color = mix(color, vec3(1.0), north * poleBlend);
      color = mix(color, vec3(0.0), south * poleBlend);

      gl_FragColor = vec4(color, 1.0);
    }
    `
  });
}