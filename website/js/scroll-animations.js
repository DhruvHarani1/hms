import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initScrollAnimations() {
  // ─── Counter Animation (Stats) ───
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseInt(el.dataset.count, 10);

    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      onEnter: () => {
        gsap.to(
          { val: 0 },
          {
            val: target,
            duration: 1.8,
            ease: 'power2.out',
            onUpdate() {
              el.textContent = Math.round(this.targets()[0].val) + '+';
            },
          },
        );
      },
      once: true,
    });
  });

  // ─── Stats Cards Entrance ───
  gsap.utils.toArray('.stats__card').forEach((card, i) => {
    gsap.from(card, {
      scrollTrigger: {
        trigger: card,
        start: 'top 90%',
      },
      y: 40,
      opacity: 0,
      duration: 0.6,
      delay: i * 0.1,
      ease: 'power2.out',
    });
  });

  // ─── Section Headers Fade Up ───
  gsap.utils.toArray('.section-label, .section-title, .section-desc').forEach((header) => {
    gsap.from(header, {
      scrollTrigger: {
        trigger: header,
        start: 'top 92%',
      },
      y: 35,
      opacity: 0,
      duration: 0.7,
      ease: 'power3.out',
    });
  });

  // ─── Phone Mockup Entrance & 3D Tilt ───
  const phoneFrame = document.getElementById('phone-frame');
  if (phoneFrame) {
    gsap.from(phoneFrame, {
      scrollTrigger: {
        trigger: '.mockup-section',
        start: 'top 85%',
        end: 'bottom 40%',
        scrub: 1,
      },
      scale: 0.85,
      rotateX: 16,
      opacity: 0.5,
      ease: 'power2.out',
    });

    const mockupContainer = document.querySelector('.mockup-container');
    if (mockupContainer) {
      mockupContainer.addEventListener('mousemove', (e) => {
        const rect = mockupContainer.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const rotateX = (-y / rect.height) * 18;
        const rotateY = (x / rect.width) * 18;
        gsap.to(phoneFrame, {
          rotateX,
          rotateY,
          duration: 0.4,
          ease: 'power2.out',
        });
      });

      mockupContainer.addEventListener('mouseleave', () => {
        gsap.to(phoneFrame, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.8,
          ease: 'power2.out',
        });
      });
    }
  }

  // ─── Feature Cards Staggered Entrance ───
  gsap.utils.toArray('.feat').forEach((card, i) => {
    gsap.from(card, {
      scrollTrigger: {
        trigger: card,
        start: 'top 92%',
      },
      y: 50,
      opacity: 0,
      duration: 0.6,
      delay: (i % 3) * 0.1,
      ease: 'power3.out',
    });
  });

  // ─── Role Cards Entrance ───
  gsap.utils.toArray('.role').forEach((card, i) => {
    gsap.from(card, {
      scrollTrigger: {
        trigger: card,
        start: 'top 90%',
      },
      y: 60,
      opacity: 0,
      duration: 0.7,
      delay: i * 0.12,
      ease: 'power3.out',
    });
  });

  // ─── Step Timeline Cards Entrance ───
  gsap.utils.toArray('.step').forEach((step, i) => {
    gsap.from(step, {
      scrollTrigger: {
        trigger: step,
        start: 'top 90%',
      },
      y: 45,
      opacity: 0,
      duration: 0.7,
      delay: i * 0.15,
      ease: 'power3.out',
    });
  });

  // ─── FAQ Items Entrance ───
  gsap.utils.toArray('.faq__item').forEach((item, i) => {
    gsap.from(item, {
      scrollTrigger: {
        trigger: item,
        start: 'top 94%',
      },
      y: 30,
      opacity: 0,
      duration: 0.5,
      delay: i * 0.08,
      ease: 'power2.out',
    });
  });

  // ─── CTA Box Scale-Up ───
  const ctaBox = document.querySelector('.cta__box');
  if (ctaBox) {
    gsap.from(ctaBox, {
      scrollTrigger: {
        trigger: ctaBox,
        start: 'top 88%',
      },
      scale: 0.94,
      opacity: 0,
      duration: 0.7,
      ease: 'power3.out',
    });
  }

  // ─── Parallax Ambient Orbs ───
  gsap.utils.toArray('.orb').forEach((orb, i) => {
    gsap.to(orb, {
      y: () => (i % 2 === 0 ? -100 : 70),
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.5,
      },
    });
  });
}
