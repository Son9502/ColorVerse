# MVP — ColorVerse

## Goal (v1)

Someone can open ColorVerse, explore RGB and HSL as an interactive **3-D** color solid, pick any color, and get its values and harmonies.

---

## In Scope (v1)

### 1. 3-D Mode ✅ (done)
- Cube and sphere, in both RGB and HSL
- 128 nested layers with smooth cross-fade
- Animated RGB ↔ HSL switching
- Color picking, harmony panel, named-color search

### 2. v1 Polish
- [x] Mark the 1-D and 2-D options in the dimension selector as "Coming soon" (or hide them) so they don't open blank views.
- 1-D/2-D development happens on the `feature/1d-2d` branch.

### 3. Must-Fix Bugs
- [x] Shader file name case: shaders are now bundled with `?raw` imports using the correct `layerFade.*` names.
- [ ] Listener cleanup: `dispose()` should remove the window and container listeners added by `3d-mode.js` and `MainBase`.
- [ ] Shared renderer: `dimension.js` shouldn't dispose the shared WebGL renderer when switching views.
- [x] Entry point: `main.html` renamed to `index.html`.

### 4. Deployment
- [x] Production build fixed (worker, shaders, CSV path) and GitHub Actions workflow added.
- [ ] Enable Pages (Settings → Pages → Source: GitHub Actions) and merge to `main`.
- Link it from the README.

---

## Future Updates (Post-v1)

### 1-D Mode
- **Line:** a gradient bar for the selected channel, with sliders to hold the other two channels.
- Works in both RGB and HSL, and clicking picks a color.

### 2-D Mode
- **Square:** plot the selected X-axis channel against the Y-axis channel, with a slider to hold the third channel.
- **Circle:** hue wheel (angle = hue, radius = saturation), with a slider to hold lightness.
- Works in both RGB and HSL, and clicking picks a color.

### Shared State Across Dimensions
- A color picked in one dimension stays highlighted when you switch to another.

### Other
- Export of the selected color and its harmonies
- Mobile / touch input
- `ShaderCache` integration
- Additional color spaces (LAB, OKLCH)
- Moving Three.js from the CDN global to the npm package

---

## Definition of Done (v1)

- [ ] Cube and sphere render correctly in both RGB and HSL
- [ ] Color picking works on both shapes and updates the harmony panel
- [ ] 1-D/2-D options are marked as coming soon or hidden
- [ ] No console errors after 10 consecutive cube ↔ sphere switches
- [ ] The deployed URL loads to an interactive state in under 3 s
