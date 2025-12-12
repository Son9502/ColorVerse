export function setupCollapsibleCategories() {
    const categories = document.querySelectorAll(".colors-row");

    categories.forEach(category => {
        const toggleBtn = category.querySelector(".row-toggle");
        const rowBody = category.querySelector(".row-body");

        if (!toggleBtn || !rowBody) return;

        rowBody.style.overflow = "hidden";
        // Save original paddings to restore after expand
        const computed = window.getComputedStyle(rowBody);
        const origPadTop = computed.paddingTop;
        const origPadBottom = computed.paddingBottom;

        // Set initial animated state
        if (!category.classList.contains("collapsed")) {
            rowBody.style.height = rowBody.scrollHeight + "px";
            requestAnimationFrame(() => {
                rowBody.style.height = "auto";
            });
            toggleBtn.setAttribute("aria-expanded", "true");
        } else {
            rowBody.style.height = "0";
            rowBody.style.paddingTop = "0";
            rowBody.style.paddingBottom = "0";
            toggleBtn.setAttribute("aria-expanded", "false");
        }

        toggleBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const collapsed = category.classList.contains("collapsed");

            if (collapsed) {
                // EXPAND
                rowBody.style.display = "block";
                const targetHeight = rowBody.scrollHeight;

                rowBody.style.height = targetHeight + "px";
                rowBody.style.paddingTop = origPadTop;
                rowBody.style.paddingBottom = origPadBottom;

                void rowBody.offsetHeight; 
                
                rowBody.style.height = targetHeight + "px";
                category.classList.remove("collapsed");
                toggleBtn.setAttribute("aria-expanded", "true");

                const onEnd = (ev) => {
                    if (ev.propertyName === "height") {
                        rowBody.style.height = "auto";
                        rowBody.removeEventListener("transitionend", onEnd);
                    }
                };
                rowBody.addEventListener("transitionend",onEnd);
            } else {
                // COLLAPSE
                const currentHeight = rowBody.getBoundingClientRect().height;
                rowBody.style.height = rowBody.scrollHeight + "px";
                
                void rowBody.offsetHeight; // reflow
                
                rowBody.style.height = "0";
                rowBody.style.paddingTop = "0";
                rowBody.style.paddingBottom = "0";

                category.classList.add("collapsed");
                toggleBtn.setAttribute("aria-expanded", "false");
            }
        });
    });
}
