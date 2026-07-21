import { initSmoothScroll } from './smooth-scroll.js';
import { initScrollAnimations } from './scroll-animations.js';
import { initFaq } from './faq.js';
import { fetchVersion } from './version.js';

// ─── Initialize Modules ───
initSmoothScroll();
initScrollAnimations();
initFaq();
fetchVersion();

// ─── Nav Scroll Effect ───
const nav = document.getElementById('nav');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const current = window.scrollY;
  if (current > 60) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
  lastScroll = current;
});

// ─── Smooth Anchor Scroll ───
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
