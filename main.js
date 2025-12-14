import { switchVisualization } from './src/visual.js';
import { setupToggle } from './src/toggle.js';
import { setupDimensionDropdown } from './src/dimension.js';
import { setupDropdown } from './src/dropdown.js';
import { setupCollapsibleCategories } from './src/categories.js';
document.addEventListener('DOMContentLoaded', () => {
    setupCollapsibleCategories();
});
setupToggle();
setupDimensionDropdown();
setupDropdown();
//switchVisualization("cube");
switchVisualization("sphere");