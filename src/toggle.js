// ----------------------------------
// HSL-RGB Toggle
// ----------------------------------
export function setupToggle() {
    const toggle = document.getElementById("toggle");
    const baseInfo = document.getElementById("base-info");

    const apply = () => {
        const rgb = document.querySelectorAll(".RGB");
        const hsl = document.querySelectorAll(".HSL");
        rgb.forEach(el => {
            el.classList.toggle("hidden", toggle.checked);
        });
        hsl.forEach(el => {
            el.classList.toggle("hidden", !toggle.checked);
        });
        // Bold + list first the active color space in the color details card
        baseInfo?.classList.toggle("hsl-active", toggle.checked);
    };

    toggle.addEventListener("change", apply);
    // Browsers can restore the checkbox state on reload
    apply();
}
