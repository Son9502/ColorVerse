// ----------------------------------
// Help Popover (controls + tools)
// ----------------------------------
export function setupHelp() {
    const help = document.getElementById("help");
    const button = document.getElementById("help-button");
    const panel = document.getElementById("help-panel");

    const setOpen = (open) => {
        panel.hidden = !open;
        button.setAttribute("aria-expanded", String(open));
    };

    // Keep clicks/drags/zoom on the widget from reaching the canvas
    // (a canvas click that misses the object clears the selected color)
    ["click", "mousedown", "dblclick", "wheel"].forEach(type => {
        help.addEventListener(type, event => event.stopPropagation());
    });

    button.addEventListener("click", () => setOpen(panel.hidden));

    // Close on outside click or Escape
    document.addEventListener("click", (event) => {
        if (!panel.hidden && !help.contains(event.target)) setOpen(false);
    });
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) {
            setOpen(false);
            button.focus();
        }
    });
}
