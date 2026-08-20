(() => {
  window.__WORLDCLAW_BOOT_TIMER__ = window.setTimeout(() => {
    if (window.__WORLDCLAW_BOOTED__) return;
    const status = document.querySelector('#asset-status');
    const label = document.querySelector('#loading-label');
    const percent = document.querySelector('#loading-percent');
    const fill = document.querySelector('#loading-fill');
    if (status) status.textContent = 'Renderer module unavailable';
    if (label) label.textContent = 'Unable to load Three.js from the model CDN';
    if (percent) percent.textContent = 'OFFLINE';
    if (fill) fill.style.width = '100%';
  }, 12000);
})();
