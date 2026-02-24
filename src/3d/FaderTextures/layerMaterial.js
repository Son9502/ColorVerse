const shaderBaseUrl = new URL("./shaders/", import.meta.url);

const vert = await (await fetch(new URL("layerfade.vert", shaderBaseUrl))).text();
const frag = await (await fetch(new URL("layerfade.frag", shaderBaseUrl))).text();

export function createLayerFadeMaterial(texA, texB, mixFactor = 0, opacity = 1.0, lightNeeded = true, lightPos = new THREE.Vector3(5, 10, 5), camPos = new THREE.Vector3(0, 0, 5), shine = 0.5) {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            texA: { value: texA },
            texB: { value: texB },
            mixFactor: { value: mixFactor },
            uOpacity: { value: opacity },
            uLight: { value: lightNeeded ? 1 : 0 },
            uShine: { value: shine },
            uLightPos: { value: lightPos },
            uCamPos: { value: camPos },
            uHighlight: { value: false },
            uHighlightUV: { value: new THREE.Vector2(0, 0) },
            uHighlightRadius: { value: 0.1 },
            
        },
        vertexShader: vert,
        fragmentShader: frag,
        transparent: opacity < 1.0,

    });
    material.userData = {
        texAcanvas: texA.userData.canvas,
        texBcanvas: texB.userData.canvas
    };
    return material

}