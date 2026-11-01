// ----------------------------------
// Golf terms (v1.8.3): words that explain themselves
// ----------------------------------
// Gimmick and difficulty words in the hole info, the course cards and the daily card light up; hovering
// (or focusing) one shows a short explanation, and a click or tap pins it with an example. Replaces the
// long gimmick and difficulty paragraphs that were in How to play.

const TERMS = {
    sand: { title: "Bunker", text: "Land in sand and your next shot must be a wedge (Tints, Shades, Tones or Saturate), so no putting out. An Expert bunker allows only the wedge it names.", example: "From sand, Tints 40% plays; Triadic is greyed out." },
    water: { title: "Lake", text: "Land in water and it's +1 stroke, playing again from where you hit.", example: "A shot into a lake on stroke 2 makes it 3, from the same spot." },
    portal: { title: "Portal", text: "Land in one and the ball warps to its exit color, for no extra stroke. Swatches that go in have a dotted purple outline, labeled with how far from the pin you come out.", example: "A swatch labeled → 86 yds puts you 86 yds from the pin." },
    blackhole: { title: "Black hole", text: "Land in one and it's +1 stroke, back to the tee.", example: "Your 2nd shot into a black hole: 3 strokes, back on the tee." },
    mirror: { title: "Mirror", text: "Land on one and your color's hex flips, for no extra stroke. Swatches that land on one have a dotted silver outline, labeled with how far from the pin the flip leaves you.", example: "#234243 lands on a mirror and comes out as #342432." },
    ban: { title: "Caddie strike", text: "Your caddie won't carry these clubs on this hole: their rows are greyed out.", example: "\"No Hybrids\": Triadic, Tetradic and Double-comp. can't be played." },
    wind: { title: "Wind", text: "Drifts every full shot by the same amount; putts aren't affected. Swatches show where a calm shot lands, so aim off.", example: "Wind +6° hue: Triadic +120° lands at +126°." },
    roulette: { title: "Roulette", text: "A swatch that spins through four hue shifts set for the hole, one a second: a stroke plays whichever is showing. With the keyboard, Tab into the row for all four.", example: "The wheel shows +95° when you tap: the ball moves 95° round the hue wheel." },
    turning: { title: "Turning wind", text: "The wind changes every stroke, in the cycle shown, then starts again; putts aren't affected. Swatches show where a calm shot lands.", example: "−10° hue → +4% light: stroke 1 drifts −10° hue, stroke 2 brightens 4%, stroke 3 drifts −10° again." },
    line: { title: "Perfect line", text: "How many of the 41 first shots can still make the perfect score. Fewer means a harder hole.", example: "\"Perfect line 2 of 41\": only two swatches from the tee keep the perfect score alive." },
    pro: { title: "Pro", text: "Swatches show only the club, not the color, so you play on color theory alone. Expert always plays Pro; Pro scores are kept separately.", example: "You see \"+120°\" instead of the color it lands on." },
    beginner: { title: "Beginner", text: "Plenty of ways to make the perfect score (6 or more first shots), and the swatch closest to the pin is often right.", example: "Prism Point." },
    standard: { title: "Standard", text: "3–6 first shots make the perfect score, and the two swatches closest to the pin never do: look further.", example: "Ember Dunes, Verdant Pines." },
    expert: { title: "Expert", text: "1–3 first shots make the perfect score and the three closest swatches never do. Played Pro, with no yardage until you're on the green, and par is perfect on par 3s and 4s.", example: "Cobalt Bay, Royal Indigo." },
    expansion: { title: "Expansion", text: "Each course adds a twist and is built so it matters; the three swatches closest to the pin never make the perfect score. Unlocked one after another from Royal Indigo.", example: "Violet Vortex's portals, Silverglass Greens' mirrors." },
};

// Phrases that become terms (case matters: "Caddie Strike" the course isn't "Caddie strike" the rule)
const PHRASES = [
    [/\b[Bb]lack holes?\b/, "blackhole"], [/\b[Bb]unkers?\b/, "sand"], [/\b[Ll]akes?\b/, "water"],
    [/\b[Pp]ortals?\b/, "portal"], [/\b[Mm]irrors?\b/, "mirror"], [/\bCaddie strike\b/, "ban"], [/\bbans\b/, "ban"], [/\broulette\b/, "roulette"],
    [/\bWind \(per stroke\)/, "turning"], [/\b[Tt]urning wind\b/, "turning"], [/\bwind turns\b/, "turning"], [/\b[Ww]ind\b/, "wind"],
    [/\b[Pp]erfect line\b/, "line"], [/\bPro\b/, "pro"],
    [/\bBeginner\b/, "beginner"], [/\bStandard\b/, "standard"], [/\bExpert\b/, "expert"], [/\bExpansion\b/, "expansion"],
];
const ANY = new RegExp(PHRASES.map(([re]) => re.source).join("|"), "g");

const escape = (text) => text.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// HTML for `text` with every known phrase as a term button
export function termify(text) {
    return escape(text).replace(ANY, (match) => {
        const key = PHRASES.find(([re]) => new RegExp(`^(?:${re.source})$`).test(match))?.[1];
        return key ? `<button type="button" class="golf-term" data-term="${key}" aria-expanded="false">${match}</button>` : match;
    });
}

// One popover for every term: hover or focus shows it, a click or tap pins it (Esc or a click elsewhere closes)
export function setupTerms() {
    const pop = document.createElement("div");
    pop.id = "golf-term-pop";
    pop.setAttribute("role", "tooltip");
    pop.hidden = true;
    document.body.append(pop);
    let open = null; // the term button showing
    let pinned = false;

    const show = (term) => {
        const info = TERMS[term.dataset.term];
        if (!info) return;
        if (open && open !== term) open.setAttribute("aria-expanded", "false");
        open = term;
        term.setAttribute("aria-expanded", "true");
        term.setAttribute("aria-describedby", pop.id);
        pop.innerHTML = `<strong>${info.title}</strong> ${info.text}<em>${pinned ? `Example: ${info.example}` : "Click for an example"}</em>`;
        pop.hidden = false;
        const at = term.getBoundingClientRect();
        const below = at.bottom + 6 + pop.offsetHeight < innerHeight;
        pop.style.top = `${below ? at.bottom + 6 : at.top - 6 - pop.offsetHeight}px`;
        pop.style.left = `${Math.max(8, Math.min(at.left, innerWidth - pop.offsetWidth - 8))}px`;
    };
    const hide = () => {
        open?.setAttribute("aria-expanded", "false");
        open?.removeAttribute("aria-describedby");
        open = null;
        pinned = false;
        pop.hidden = true;
    };

    document.addEventListener("mouseover", ({ target }) => {
        const term = target.closest?.(".golf-term");
        if (term && !pinned) show(term);
    });
    document.addEventListener("mouseout", ({ target, relatedTarget }) => {
        if (!pinned && target.closest?.(".golf-term") && !relatedTarget?.closest?.(".golf-term")) hide();
    });
    document.addEventListener("focusin", ({ target }) => { if (target.matches?.(".golf-term") && !pinned) show(target); });
    document.addEventListener("focusout", ({ target }) => { if (target.matches?.(".golf-term") && !pinned) hide(); });
    document.addEventListener("click", ({ target }) => {
        const term = target.closest?.(".golf-term");
        if (!term) { if (!pop.contains(target)) hide(); return; }
        if (pinned && open === term) return hide();
        pinned = true;
        show(term);
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && open) hide(); });
    addEventListener("scroll", () => { if (open) hide(); }, { capture: true, passive: true });
}
