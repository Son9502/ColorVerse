// ----------------------------------
// Dimensionial Searcher
// ----------------------------------
import { switchVisualization } from "./visual.js";
export function setupDimensionDropdown() {
    const shapeSelect = document.getElementById("shape-select");
    const dropdown = document.getElementById("dimensions");

    dropdown.addEventListener("change", (event) => {
        const value = event.target.value;
        shapeSelect.innerHTML = "";
        const shapes = {
            "2-D": ["square", "circle"],
            "3-D": ["cube", "sphere"],
        }

        document.querySelectorAll(".dimension-info").forEach(div => {
            div.style.display = "none";
        })
        if (value === "1-D"){
            document.getElementById("info1D").style.display = "block";
            switchVisualization("line");
            shapeSelect.disabled = true;
        } 
        if (value === "2-D") {
            shapeSelect.disabled = false;
            document.getElementById("info2D").style.display = "block";
            for (const shape of shapes[value]){
                const opt = document.createElement("option");
                opt.value = shape; 
                opt.textContent = shape.charAt(0).toUpperCase() + shape.slice(1);
                shapeSelect.appendChild(opt);
            }
            // default value is a square 
            switchVisualization("square");
        }
        if (value === "3-D") {
            shapeSelect.disabled = false;
            document.getElementById("info3D").style.display = "block";
            for (const shape of shapes[value]){
                const opt = document.createElement("option");
                opt.value = shape; 
                opt.textContent = shape.charAt(0).toUpperCase() + shape.slice(1);
                shapeSelect.appendChild(opt);
            }
            // default value is a cube 
            switchVisualization("cube");
        }
    });

    shapeSelect.addEventListener("change", (event) => {
        const selected = event.target.value;
        switchVisualization(selected);
    })
}