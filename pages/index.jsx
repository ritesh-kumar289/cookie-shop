import { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import Head from 'next/head';

// SSR-disabled: Three.js requires browser APIs
const Scene = dynamic(() => import('../components/Scene'), { ssr: false });
const ScrollController = dynamic(() => import('../components/ScrollController'), { ssr: false });

// ─── Scene copy ───────────────────────────────────────────────────────────────
const SCENES = [
  {
    id: 'scene1',
    startPct: 0,
    endPct: 0.16,
    title: 'Crunch Bites',
    tagline: 'Crunchy cookies, made for every moment.',
    sub: null,
  },
  {
    id: 'scene3',
    startPct: 0.27,
    endPct: 0.44,
    title: 'Crafted for Crunch',
    tagline: null,
    sub: 'Every bite tells a story',
  },
  {
    id: 'scene4a',
    startPct: 0.56,
    endPct: 0.68,
    title: 'The Journey Begins',
    tagline: null,
    sub: 'Rolling toward perfection.',
  },
  {
    id: 'scene4b',
    startPct: 0.68,
    endPct: 0.76,
    title: 'Perfectly Baked',
    tagline: null,
    sub: 'Golden. Warm. Irresistible.',
  },
  {
    id: 'final',
    startPct: 0.84,
    endPct: 1.0,
    title: 'Made to be Remembered',
    tagline: null,
    sub: 'Crunch Bites — Order yours today.',
  },
];

const SCENE_MILESTONES = [0, 0.16, 0.30, 0.44, 0.56, 0.68, 0.76, 0.84];

// ─── Animation variants ───────────────────────────────────────────────────────
const titleVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    y: -18,
    scale: 0.98,
    transition: { duration: 0.5, ease: 'easeIn' },
  },
};

const subVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay: 0.32, ease: 'easeOut' },
  },
  exit: { opacity: 0, transition: { duration: 0.35 } },
};

const logoVariants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const scrollProgress = useRef(0);
  // Normalised mouse coordinates in [-1, +1]; shared with the 3D scene via ref
  // to avoid per-frame React re-renders.
  const mouseRef = useRef({ x: 0, y: 0 });
  const [activeScene, setActiveScene] = useState('scene1');
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [activeDot, setActiveDot] = useState(0);

  // Track cursor position so 3D components can apply mouse-parallax effects
  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Poll scroll progress ref at 60fps to drive React UI state
  useEffect(() => {
    let rafId;
    let lastP = -1;

    const tick = () => {
      const p = scrollProgress.current;

      if (Math.abs(p - lastP) > 0.001) {
        lastP = p;

        setShowScrollHint(p < 0.03);

        // Active dot
        let dotIdx = 0;
        for (let i = SCENE_MILESTONES.length - 1; i >= 0; i--) {
          if (p >= SCENE_MILESTONES[i]) { dotIdx = i; break; }
        }
        setActiveDot(dotIdx);

        // Active scene label
        let found = null;
        for (const sc of SCENES) {
          if (p >= sc.startPct && p < sc.endPct) { found = sc.id; break; }
        }
        setActiveScene(found);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const currentScene = SCENES.find((s) => s.id === activeScene);

  return (
    <>
      <Head>
        <title>Crunch Bites — Artisan Cookies</title>
        <meta name="description" content="Crunch Bites — Crunchy cookies, made for every moment." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FFF8F1" />
      </Head>

      {/* Fixed 3D canvas */}
      <div className="canvas-wrapper">
        <Scene scrollProgress={scrollProgress} mouseRef={mouseRef} />
      </div>

      {/* Lenis + GSAP scroll driver */}
      <ScrollController scrollProgress={scrollProgress} />

      {/* Tall scroll track (900vh) – pointer-events none so scroll passes through */}
      <div id="scroll-container" className="scroll-container" />

      {/* Brand logo */}
      <motion.div
        className="brand-logo"
        variants={logoVariants}
        initial="hidden"
        animate="visible"
      >
        <img
          src="https://github.com/user-attachments/assets/db551b4a-286d-4676-867c-d9d433d0b34d"
          alt="Crunch Bites"
          style={{ width: '140px', height: 'auto', display: 'block' }}
        />
      </motion.div>

      {/* Scroll hint (fades out after first scroll) */}
      <AnimatePresence>
        {showScrollHint && (
          <motion.div
            className="scroll-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span>Scroll</span>
            <div className="scroll-hint-line" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scene text overlays */}
      <div className="ui-overlay">
        <AnimatePresence mode="wait">
          {currentScene && (
            <motion.div
              key={currentScene.id}
              className="scene-label"
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.h1 variants={titleVariants}>{currentScene.title}</motion.h1>
              {currentScene.tagline && (
                <motion.p className="tagline" variants={subVariants}>
                  {currentScene.tagline}
                </motion.p>
              )}
              {currentScene.sub && (
                <motion.p variants={subVariants}>{currentScene.sub}</motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scene progress dots */}
      <div className="progress-bar">
        {SCENE_MILESTONES.map((_, i) => (
          <div
            key={i}
            className={`progress-dot${activeDot === i ? ' active' : ''}`}
          />
        ))}
      </div>
    </>
  );
}
