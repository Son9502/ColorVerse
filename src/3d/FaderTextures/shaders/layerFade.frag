uniform sampler2D texA;
uniform sampler2D texB;
uniform float mixFactor;
uniform float uShine; 
uniform vec3 uLightPos;
uniform vec3 uCamPos;
uniform int uLight;
uniform float uOpacity;

uniform bool uHighlight;
uniform vec2 uHighlightUV;
uniform float uHighlightRadius;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

// sRGB → Linear
vec3 toLinear(vec3 c) {return pow(c, vec3(2.2));}
// Linear → sRGB
vec3 toSRGB(vec3 c) {return pow(c, vec3(1.0 / 2.2));}

void main() {
    vec3 colorA = toLinear(texture2D(texA, vUv).rgb);
    vec3 colorB = toLinear(texture2D(texB, vUv).rgb);
    vec3 baseColor = mix(colorA, colorB, mixFactor);
    vec3 finalColor = baseColor;
    if (uLight == 1) {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uLightPos - vWorldPos);
        vec3 V = normalize(uCamPos - vWorldPos);
        vec3 H = normalize(L + V);

        float diff = max(dot(N, L), 0.0);
        float spec = pow(max(dot(N, H), 0.0), 32.0);
        float ambient = 0.3;
    
        finalColor = baseColor * (ambient + diff) + vec3(1.0) * spec * uShine;
    }
    if (uHighlight) {
        float dist = distance(vUv, uHighlightUV);
        float factor = smoothstep(uHighlightRadius, 0.0, dist);
        vec3 highlight = baseColor * 1.5;
        finalColor = mix(finalColor, highlight, factor);
    }
    vec3 srgb = toSRGB(finalColor);
    gl_FragColor = vec4(srgb, uOpacity);
}