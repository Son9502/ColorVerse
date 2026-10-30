// ----------------------------------
// Three.js, configured once for the whole app
// ----------------------------------
// Every module imports THREE from here (not from "three" directly), so this runs before any of them.
//
// Color handling matches r128, which the app was built on: the shaders convert sRGB ↔ linear
// themselves, layer textures are raw sRGB bytes, and canvas sprites must show their exact CSS
// colors (golf flags and balls match the swatches). Since r152 Three.js converts colors on its own
// by default, which would make every color drift, so automatic conversion is switched off here and
// the renderer writes pixels as they are (3d-mode.js sets outputColorSpace to linear).

import * as THREE from "three";

THREE.ColorManagement.enabled = false;

export { THREE };
