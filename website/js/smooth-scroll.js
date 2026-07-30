import Lenis from 'lenis';

// ─── Lenis smooth scroll — desktop only ───
// On iOS/mobile, Lenis overrides native momentum scroll which makes the
// page feel sluggish. Native CSS scroll-behavior: smooth is better on mobile.
function isMobile() {
  return window.innerWidth < 1024 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function initSmoothScroll() {
  if (isMobile()) {
    // Use native CSS smooth scrolling on mobile — already handled by CSS
    return null;
  }

  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    touchMultiplier: 2,
    infinite: false,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);

  return lenis;
}
