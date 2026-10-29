import { THREE } from "../../three-setup.js";

// Shader material generators for RGB and HSL for the mini 3d objects
// (kept out of color-utils.js, which the texture worker imports and must stay free of Three.js)
export function makeRGBMat({ shininess = 30, specular = 0.5, snapStrength = 0.6 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      snapStrength: { value: snapStrength },
      shininess: { value: shininess },
      specular: { value: specular },
      lightDir: { value: new THREE.Vector3(1, 1, 1).normalize() },
      uOpacity: { value: 1.0 },
      uHighlightDir: { value: new THREE.Vector3(0, 0, 0) },
      uHighlightStrength: { value: 0.0 },
      uHighlightSharpness: { value: 8.0 }, // controls area size
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

      uniform float uOpacity;
      uniform vec3 uHighlightDir;
      uniform float uHighlightStrength;
      uniform float uHighlightSharpness;

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

        // Directional highlight
        vec3 dir = normalize(vPos);
        // No highlight yet: uHighlightDir is (0,0,0), and normalize() of it is NaN (renders black)
        float hlLen = length(uHighlightDir);
        float alignment = hlLen > 0.0 ? dot(dir, uHighlightDir / hlLen) : -1.0;

        // Soft cone highlight
        float highlight = exp(-uHighlightSharpness * (1.0 - alignment));

        // Brighten existing color (not add white)
        vec3 highlightColor = mix(color, vec3(1.0), 0.35);

        color = mix(color, highlightColor, highlight * uHighlightStrength);

        // Blinn-Phong Specular highlight
        vec3 L = normalize(lightDir);
        vec3 V = normalize(-pos);
        vec3 H = normalize(L + V);
        float NdotH = max(dot(n, H), 0.0);
        float spec = pow(NdotH, shininess) * specular;
        color += spec;

        gl_FragColor = vec4(color, uOpacity);
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
      uOpacity: { value: 1.0 },
      uHighlightDir: { value: new THREE.Vector3(0, 0, 0) },
      uHighlightStrength: { value: 0.0 },
      uHighlightSharpness: { value: 8.0 }, // controls area size
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

      uniform float uOpacity;
      uniform vec3 uHighlightDir;
      uniform float uHighlightStrength;
      uniform float uHighlightSharpness;

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

        // Directional highlight
        vec3 dir = normalize(vPos);
        // No highlight yet: uHighlightDir is (0,0,0), and normalize() of it is NaN (renders black)
        float hlLen = length(uHighlightDir);
        float alignment = hlLen > 0.0 ? dot(dir, uHighlightDir / hlLen) : -1.0;

        // Soft cone highlight
        float highlight = exp(-uHighlightSharpness * (1.0 - alignment));

        // Brighten existing color (not add white)
        vec3 highlightColor = mix(color, vec3(1.0), 0.35);    
        color = mix(color, highlightColor, highlight * uHighlightStrength);

        // Blinn-Phong Specular highlight
        vec3 L = normalize(lightDir);
        vec3 V = normalize(-pos);
        vec3 H = normalize(L + V);
        float NdotH = max(dot(n, H), 0.0);
        float spec = pow(NdotH, shininess) * specular;
        color += spec;

        gl_FragColor = vec4(color, uOpacity);
      }`
  });
}