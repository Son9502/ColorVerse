// ----------------------------------
// HSL-RGB Toggle
// ----------------------------------
export function setupToggle() {
    const toggle = document.getElementById("toggle");
    toggle.addEventListener("change", () => {
        const rgb = document.querySelectorAll(".RGB");
        const hsl = document.querySelectorAll(".HSL");
        rgb.forEach(el => {
            el.classList.toggle("hidden", toggle.checked);
        });
        hsl.forEach(el => {
            el.classList.toggle("hidden", !toggle.checked);
        });
    });

}
