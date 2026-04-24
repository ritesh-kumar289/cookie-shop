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
    endPct: 0.18,
    title: 'Crunch Bites',
    tagline: 'Crunchy cookies, made for every moment.',
    sub: null,
  },
  {
    id: 'scene3',
    startPct: 0.29,
    endPct: 0.48,
    title: 'Crafted for Crunch',
    tagline: null,
    sub: 'Every bite tells a story',
  },
  {
    id: 'scene5',
    startPct: 0.63,
    endPct: 0.81,
    title: 'Perfectly Baked',
    tagline: null,
    sub: 'Golden. Warm. Irresistible.',
  },
  {
    id: 'final',
    startPct: 0.81,
    endPct: 1.0,
    title: 'Made to be Remembered',
    tagline: null,
    sub: 'Crunch Bites — Order yours today.',
  },
];

const SCENE_MILESTONES = [0, 0.15, 0.30, 0.45, 0.65, 0.80];

// ─── Animation variants ───────────────────────────────────────────────────────
const titleVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.85, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    y: -22,
    transition: { duration: 0.45, ease: 'easeIn' },
  },
};

const subVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: 0.28, ease: 'easeOut' },
  },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const scrollProgress = useRef(0);
  const [activeScene, setActiveScene] = useState('scene1');
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [activeDot, setActiveDot] = useState(0);

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
        <meta name="theme-color" content="#0a0704" />
      </Head>

      {/* Fixed 3D canvas */}
      <div className="canvas-wrapper">
        <Scene scrollProgress={scrollProgress} />
      </div>

      {/* Lenis + GSAP scroll driver */}
      <ScrollController scrollProgress={scrollProgress} />

      {/* Tall scroll track (700vh) – pointer-events none so scroll passes through */}
      <div id="scroll-container" className="scroll-container" />

      {/* Brand watermark */}
      <div className="brand-logo">Crunch Bites</div>

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
