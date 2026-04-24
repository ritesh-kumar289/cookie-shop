import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function ScrollController({ scrollProgress }) {
  useEffect(() => {
    // ── Lenis smooth scroll ─────────────────────────────────────────────────
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    // ── GSAP ScrollTrigger → updates scrollProgress ref ────────────────────
    const proxy = { progress: 0 };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#scroll-container',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 2,
        onUpdate: (self) => {
          scrollProgress.current = self.progress;
        },
      },
    });

    tl.to(proxy, { progress: 1, ease: 'none' });

    // Integrate Lenis with GSAP ticker
    lenis.on('scroll', ScrollTrigger.update);

    // GSAP ticker delivers time in seconds; Lenis.raf() requires milliseconds.
    const onRaf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(onRaf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(onRaf);
      tl.kill();
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, [scrollProgress]);

  return null;
}
