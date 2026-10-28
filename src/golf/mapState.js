// ----------------------------------
// Color Golf map state, shared between the game screen and the 3-D view
// ----------------------------------
// { current, target, trail } as whole-number HSL (+ holed: true once the ball drops), or null when no game is on.
// After a hole, `replay` (tee + strokes so far) and `replayHoled` draw the perfect route's gold ghost ball.
// The 3-D view can be rebuilt (or still loading) when the game starts, so it reads
// getMapState() on creation as well as listening for "golfmapchange".

let state = null;

export const getMapState = () => state;

export function setMapState(next) {
    state = next;
    document.dispatchEvent(new CustomEvent("golfmapchange", { detail: next }));
}
