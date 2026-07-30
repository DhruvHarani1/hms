import { initSmoothScroll } from './smooth-scroll.js';
import { initScrollAnimations } from './scroll-animations.js';
import { initFaq } from './faq.js';
import { fetchVersion } from './version.js';

const isMobile = window.innerWidth < 1024;

// ─── Initialize non-heavy modules immediately ───
initScrollAnimations();
initFaq();

// ─── Defer version fetch — not critical for display ───
setTimeout(() => fetchVersion(), 1000);

// ─── Smooth scroll — mobile guard is inside ───
initSmoothScroll();

// ─── Lazy-load Three.js scene only on desktop, after first paint ───
if (!isMobile) {
  // Use requestIdleCallback to defer Three.js until browser is idle
  const loadThreeScene = () => {
    import('./three-scene.js').then(({ initThreeScene }) => {
      initThreeScene();
    });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadThreeScene, { timeout: 3000 });
  } else {
    setTimeout(loadThreeScene, 1000);
  }
}

// ─── Nav Scroll Effect ───
const nav = document.getElementById('nav');

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}, { passive: true });

// ─── Smooth Anchor Scroll ───
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const href = anchor.getAttribute('href');
    if (!href || href === '#') return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ─── Mobile Hamburger Toggle ───
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('open');
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      navLinks.classList.remove('open');
    });
  });
}
