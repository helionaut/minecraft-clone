function px(value: number): string {
  return `${Math.max(0, Math.round(value * 100) / 100)}px`;
}

type Cleanup = () => void;

export function installViewportLayout(): Cleanup {
  const root = document.documentElement;

  const syncViewport = () => {
    const visualViewport = window.visualViewport;
    const width = visualViewport?.width ?? window.innerWidth;
    const height = visualViewport?.height ?? window.innerHeight;
    const top = visualViewport?.offsetTop ?? 0;
    const left = visualViewport?.offsetLeft ?? 0;
    const right = Math.max(0, window.innerWidth - width - left);
    const bottom = Math.max(0, window.innerHeight - height - top);

    root.style.setProperty('--app-width', px(width));
    root.style.setProperty('--app-height', px(height));
    root.style.setProperty('--browser-ui-top', px(top));
    root.style.setProperty('--browser-ui-right', px(right));
    root.style.setProperty('--browser-ui-bottom', px(bottom));
    root.style.setProperty('--browser-ui-left', px(left));
  };

  syncViewport();

  const visualViewport = window.visualViewport;

  window.addEventListener('resize', syncViewport);
  window.addEventListener('orientationchange', syncViewport);
  visualViewport?.addEventListener('resize', syncViewport);
  visualViewport?.addEventListener('scroll', syncViewport);

  return () => {
    window.removeEventListener('resize', syncViewport);
    window.removeEventListener('orientationchange', syncViewport);
    visualViewport?.removeEventListener('resize', syncViewport);
    visualViewport?.removeEventListener('scroll', syncViewport);
  };
}
