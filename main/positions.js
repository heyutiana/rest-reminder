const fs = require('fs');
const { screen } = require('electron');

function loadPosition(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function isPositionOnScreen(x, y) {
  return screen.getAllDisplays().some((display) => {
    const bounds = display.bounds;
    return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
  });
}

function clampWindowPosition(x, y, width, height) {
  const display = screen.getDisplayNearestPoint({ x, y });
  const area = display.workArea;
  const minVisible = 24;
  const minX = area.x - width + minVisible;
  const maxX = area.x + area.width - minVisible;
  const minY = area.y;
  const maxY = area.y + area.height - minVisible;
  return {
    x: Math.round(Math.max(minX, Math.min(maxX, x))),
    y: Math.round(Math.max(minY, Math.min(maxY, y))),
  };
}

function savePositionDebounced(win, file, timerRef) {
  if (!win || win.isDestroyed()) return timerRef;
  if (timerRef) clearTimeout(timerRef);
  return setTimeout(() => {
    try {
      fs.writeFileSync(file, JSON.stringify(win.getBounds()));
    } catch {}
  }, 500);
}

module.exports = {
  loadPosition,
  isPositionOnScreen,
  clampWindowPosition,
  savePositionDebounced,
};
