import { setupToggle } from './src/toggle.js';
import { setupDimensionDropdown, defaultVisualization } from './src/dimension.js';
import { setupDropdown } from './src/dropdown.js';
import { setupCollapsibleCategories } from './src/categories.js';
document.addEventListener('DOMContentLoaded', () => {
    setupCollapsibleCategories();
});
setupToggle();
setupDimensionDropdown();
setupDropdown();
defaultVisualization("sphere");