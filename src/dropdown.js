import { setBaseColors, resetColors } from "./harmony.js";

// Load color data from CSV file
async function loadColorData() {
    let colordata = [];

    const response = await fetch("./public/named_colors.csv");
    const text = await response.text();

    // Split the CSV text into lines and skip the header
    const lines = text.split("\n").slice(1);

    // Parse CSV data into colordata array
    for (const line of lines) {
        const values = line.split(",");
        colordata.push({
            name: values[0],
            hex: values[1],
            r: parseInt(values[2]),
            g: parseInt(values[3]),
            b: parseInt(values[4])
        });
    }
    return colordata;
}

// This function ranks how well a text matches a query for sorting purposes
function rankScore(query, text, threshold = 0.4) {
    if (!text) return Infinity;

    if (query === text) return 0; // Exact match

    if (text.startsWith(query)) return 1; // Starts with query

    if (text.split(/\s+/).some(word => word.startsWith(query))) return 1.5; // Any word starts with query

    const qTokens = query.split(/\s+/);

    if (qTokens.every(token => text.includes(token))) return 1.8; // All tokens present

    if (text.includes(query)) return 2; // Contains query

    const fuzz = fuzzyMatch(query, text);
    return (fuzz < threshold) ? 3 + fuzz : Infinity; // Fuzzy match with penalty
}

// This function performs a fuzzy match (checks for typos and partial matches) using Levenshtein distance
function fuzzyMatch(query, text) {
    // Get lengths of both strings
    const n = query.length;
    const m = text.length;

    // Initialize a 2D array to store distances (Dynamic Programming table)
    const map = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
    for (let i = 0; i <= n; i++) map[i][0] = i; // Deletion cost
    for (let j = 0; j <= m; j++) map[0][j] = j; // Insertion cost

    // Compute distances
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            // If characters are the same, no cost
            if (query[i - 1] === text[j - 1]) {
                map[i][j] = map[i - 1][j - 1]; // No cost if characters match
                continue;
            }
            // Characters are different, consider all possibilities
            map[i][j] = 1 + Math.min(
                map[i - 1][j],    // Deletion
                map[i][j - 1],    // Insertion
                map[i - 1][j - 1] // Substitution
            );
        }
    }
    // Normalize the Levenshtein distance (in the bottom-right cell) to [0,1]
    return map[n][m] / Math.max(n, m);

}

// This function highlights the matching part of the text   
function highlightMatch(text, query) {
    const firstIndex = text.toLowerCase().indexOf(query.toLowerCase());
    if (firstIndex === -1) return text; // No match found
    const beforeMatch = text.slice(0, firstIndex);
    const match = text.slice(firstIndex, firstIndex + query.length);
    const afterMatch = text.slice(firstIndex + query.length);
    return `${beforeMatch}<strong>${match}</strong>${afterMatch}`;
}

// This function performs the search and updates the dropdown
function searchColors(query, threshold = 0.4, maxResults = 20, colordata) {
    const dropdown = document.getElementById("autocomplete");
    const ghostInput = document.getElementById("ghost-text");

    dropdown.innerHTML = "";
    ghostInput.value = "";

    if (query.length === 0) {
        dropdown.classList.remove("open");
        return;
    }
    dropdown.classList.add("open");
    // Determine if the query is a hex code or a name
    const key = (query[0] === "#") ? "hex" : "name";
    query = (key === "hex") ? query.toUpperCase() : query.toLowerCase();

    // Get matches (exact, partial, and fuzzy) 
    const matches = colordata.map(color => {
        const value = color[key] ?? "";
        const score = rankScore(query, value, threshold);
        return { color, score };
    })
        .filter(entry => entry.score !== Infinity)
        .sort((a, b) => a.score - b.score)
        .slice(0, maxResults)
        .map(entry => entry.color);
    // Handle no matches
    if (matches.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item no-match">No matches found</div>';
        dropdown.style.display = "block";
        return;
    }
    // Create dropdown items
    matches.forEach(match => {
        const item = document.createElement("div");
        // Swatch to show color
        const swatch = '<div class="swatch" style="background-color: ' + match.hex + ';"></div>';

        // Create highlighted text for name or hex
        const nameText = (key === "name") ? highlightMatch(match.name, query) : match.name;
        const hexText = (key === "hex") ? highlightMatch(match.hex, query) : match.hex;

        const rgbText = `rgb(${match.r}, ${match.g}, ${match.b})`;

        item.innerHTML = `${swatch}
                            <div class="auto-name">${nameText}</div>
                            <div class="auto-hex">(${hexText})</div>
                            <div class="auto-rgb">${rgbText}</div>`;
        item.classList.add("dropdown-item");
        dropdown.appendChild(item);
    });
    dropdown.style.display = "block";

    // Update ghost text input
    if (matches.length > 0) {
        let bestMatch = matches[0][key] ?? "";
        if (bestMatch.startsWith(query)) {
            ghostInput.value = query + bestMatch.slice(query.length);
        } else {
            ghostInput.value = "";
        }
    }
    else {
        ghostInput.value = "";
    }
}

// Setup function to initialize dropdown search functionality
export async function setupDropdown() {
    // Load color data once
    const colordata = await loadColorData();

    const ghostInput = document.getElementById("ghost-text");
    const colorInput = document.getElementById("color-text");

    // Get references to UI elements
    const infoBox = document.querySelectorAll(".color-info");
    const infoSearch = document.getElementById("color-search");

    const colorName = document.getElementById("color-name");
    const baseCircle = document.getElementById("base-circle");
    const dropdown = document.getElementById("autocomplete");


    // To hold the debounce timeout ID
    let debounceTimeout;

    // Adjust this threshold for sensitivity
    const threshold = 0.4;

    // Maximum number of results to show
    const maxResults = 20;

    colorInput.addEventListener("input", (e) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            searchColors(e.target.value, threshold, maxResults, colordata);
        }, 150);
    });

    // Handle keyboard navigation
    let index = -1;

    // Event listener for dropdown item clicks
    dropdown.addEventListener("click", (event) => {
        const selectedItem = event.target.closest(".dropdown-item");
        if (!selectedItem) return

        const dropitems = document.querySelectorAll("#autocomplete .dropdown-item");
        const click_index = Array.from(dropitems).indexOf(selectedItem);

        if (!selectedItem.classList.contains("highlighted")) {
            dropitems.forEach((item, j) => item.classList.toggle("highlighted", j === click_index));
            index = click_index;
            return;
        }
        const selectedColor = dropitems[click_index].querySelector(".swatch").style.backgroundColor;
        infoBox.forEach(box => { box.classList.add("show"); });
        if (infoSearch) infoSearch.style.display = "none";
        if (baseCircle) baseCircle.style.backgroundColor = `${selectedColor}`;
        if (colorName) colorName.textContent = dropitems[click_index].querySelector(".auto-name").textContent.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        setBaseColors(selectedColor);

    });
    colorInput.addEventListener("keydown", (e) => {
        const dropitems = document.querySelectorAll("#autocomplete .dropdown-item");
        if (dropitems.length === 0) return;

        // Navigate with arrow keys
        if (e.key === "ArrowDown") {
            e.preventDefault();
            index = Math.min(index + 1, dropitems.length - 1);
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();
            index = Math.max(index - 1, 0);
        }
        // Select item with Enter key
        else if (e.key === "Enter" && index >= 0) {
            e.preventDefault();
            const selectedColor = dropitems[index].querySelector(".swatch").style.backgroundColor;
            infoBox.forEach(box => { box.classList.add("show"); });
            if (infoSearch) infoSearch.style.display = "none";
            if (colorName) colorName.textContent = dropitems[index].querySelector(".auto-name").textContent.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            if (baseCircle) baseCircle.style.backgroundColor = `${selectedColor}`;
            setBaseColors(selectedColor);
        }
        // Close dropdown with Escape key
        else if (e.key === "Escape") {
            const dropdown = document.getElementById("autocomplete");
            dropdown.style.display = "none";
        }
        // PageUp and PageDown for faster navigation
        else if (e.key === "PageDown") {
            e.preventDefault();
            index = Math.min(index + 5, items.length - 1);
        }
        else if (e.key === "PageUp") {
            e.preventDefault();
            index = Math.max(index - 5, 0);
        }
        // Tab key selects the autofill suggestion
        else if (e.key === "Tab") {
            const ghostInput = document.getElementById("ghost-text");
            if (ghostInput.value.length > 0) {
                e.preventDefault();
                colorInput.value = ghostInput.value;
                searchColors(colorInput.value, threshold, maxResults, colordata);
            }
        }
        // Scroll the highlighted item into view
        if (index >= 0) {
            dropitems[index].scrollIntoView({ block: "nearest" });
        }
        else {
            index = -1; // Reset index for other keys
        }
        dropitems.forEach((item, i) => {
            item.classList.toggle("highlighted", i === index);
        });
    });
    // Escape closes Info
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            infoBox.forEach(box => { box.classList.remove("show"); });
            if (infoSearch) infoSearch.style.display = "flex";
            if (baseCircle) baseCircle.style.backgroundColor = `hsl(0,0%,0%,0)`;
            if (colorName) colorName.textContent = "";
            resetColors();
        }
    });
}