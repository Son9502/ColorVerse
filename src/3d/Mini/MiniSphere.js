import { MiniBase } from "./MiniBase.js";
import { THREE } from "../../three-setup.js";

export class MiniSphere extends MiniBase {
    constructor(renderer, colorSpace = "RGB") {
        super(renderer, colorSpace);

        // Mini scene and camera
        
        this.axisLength = this.size * 1.5;
        this.createObject();
    }
    createObject() {
        const geometry = new THREE.SphereGeometry(this.size, 64, 64);

        // Create mini sphere
        this.object = new THREE.Mesh(geometry, this.materials[this.colorSpace]);

        this.root.add(this.object);
    }
}
