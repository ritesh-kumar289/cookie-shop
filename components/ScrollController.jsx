import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function ScrollController({ scrollProgress }) {
  useEffect(() => {
    // ── Lenis smooth scroll — tuned for cinematic inertia ──────────────────
    const lenis = new Lenis({
      duration: 2.2,          // longer inertia — each scroll event moves the page more slowly
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.6,   // lower = fewer animation steps per wheel tick
      touchMultiplier: 1.2,   // slightly reduced for mobile too
    });

    // ── GSAP ScrollTrigger → updates scrollProgress ref ────────────────────
    const proxy = { progress: 0 };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#scroll-container',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.5,           // looser coupling — animation lags scroll slightly for cine feel
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
