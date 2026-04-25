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
    body: 'Handcrafted with the finest ingredients. Every batch baked to a perfect golden crunch.',
  },
  {
    id: 'scene3',
    startPct: 0.27,
    endPct: 0.44,
    title: 'Crafted for Crunch',
    tagline: null,
    sub: 'Every bite tells a story',
    body: 'From the first crack to the last crumb — texture, warmth, and flavour in perfect harmony.',
  },
  {
    id: 'scene4a',
    startPct: 0.56,
    endPct: 0.68,
    title: 'The Journey Begins',
    tagline: null,
    sub: 'Rolling toward perfection.',
    body: 'Every bite is crafted with precision, texture, and flavour — designed to deliver the perfect crunch.',
  },
  {
    id: 'scene4b',
    startPct: 0.68,
    endPct: 0.76,
    title: 'Perfectly Baked',
    tagline: null,
    sub: 'Golden. Warm. Irresistible.',
    body: 'Slow-baked at just the right temperature so every chip melts and every edge stays perfectly crisp.',
  },
  {
    id: 'final',
    startPct: 0.84,
    endPct: 1.0,
    title: 'Made to be Remembered',
    tagline: null,
    sub: 'Crunch Bites — Order yours today.',
    body: 'A moment of pure indulgence. Share the crunch with the people who matter most.',
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

// ─── Leaf SVG decoration ─────────────────────────────────────────────────────
function LeafSvg({ className }) {
  return (
    <svg className={className} viewBox="0 0 80 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M40,175 C18,130 8,85 18,42 C28,0 62,-8 72,35 C82,68 70,118 40,175 Z"
        fill="#7A7F4B"
        opacity="0.32"
      />
      <path d="M40,175 C44,115 54,70 50,32" stroke="#7A7F4B" strokeWidth="1.5" fill="none" opacity="0.38" />
      <path d="M28,130 C40,108 56,98 66,76" stroke="#7A7F4B" strokeWidth="1" fill="none" opacity="0.28" />
      <path d="M30,96 C42,76 55,68 62,50" stroke="#7A7F4B" strokeWidth="1" fill="none" opacity="0.28" />
      <path d="M34,60 C44,46 54,40 60,28" stroke="#7A7F4B" strokeWidth="1" fill="none" opacity="0.22" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const scrollProgress = useRef(0);
  // Normalised mouse coordinates in [-1, +1]; shared with the 3D scene via ref
  // to avoid per-frame React re-renders.
  const mouseRef = useRef({ x: 0, y: 0 });
  const [activeScene, setActiveScene] = useState('scene1');
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [activeDot, setActiveDot] = useState(0);
  // PresentationControls enabled only while in hero landing (scene 1)
  const [presentationEnabled, setPresentationEnabled] = useState(true);
  // Track last presentationEnabled to avoid unnecessary state updates
  const prevPERef = useRef(true);

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

        // PresentationControls: enable only in scene 1 (p < 0.16)
        const newPE = p < 0.16;
        if (newPE !== prevPERef.current) {
          prevPERef.current = newPE;
          setPresentationEnabled(newPE);
        }
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
        <Scene
          scrollProgress={scrollProgress}
          mouseRef={mouseRef}
          presentationEnabled={presentationEnabled}
        />
      </div>

      {/* Lenis + GSAP scroll driver */}
      <ScrollController scrollProgress={scrollProgress} />

      {/* Tall scroll track (900vh) – pointer-events none so scroll passes through */}
      <div id="scroll-container" className="scroll-container" />

      {/* Brand logo — new round-badge artwork */}
      <motion.div
        className="brand-logo"
        variants={logoVariants}
        initial="hidden"
        animate="visible"
        style={{ mixBlendMode: 'multiply' }}
      >
        <img
          src="https://github.com/user-attachments/assets/eae77061-4e05-4e8a-b907-d53f09eea0b2"
          alt="Crunch Bites"
          style={{ width: '160px', height: 'auto', display: 'block' }}
        />
      </motion.div>

      {/* ── Hero landing panel — only visible during scene 1 ──────────────── */}
      <AnimatePresence>
        {activeScene === 'scene1' && (
          <motion.aside
            className="hero-panel"
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.85, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <motion.p
              className="hero-welcome"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.20, duration: 0.65 }}
            >
              Welcome to
            </motion.p>
            <motion.h1
              className="hero-title"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.36, duration: 0.9 }}
            >
              Crunch Bites
            </motion.h1>
            <motion.div
              className="hero-divider"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.58, duration: 0.7, ease: 'easeOut' }}
            >
              <span className="hero-divider-line" />
              <span className="hero-divider-icon">✦</span>
              <span className="hero-divider-line" />
            </motion.div>
            <motion.p
              className="hero-sub"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.72, duration: 0.8 }}
            >
              Every bite tells a story of quality,<br />
              passion and perfection.
            </motion.p>
            <motion.button
              className="hero-cta"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.92, duration: 0.7 }}
              onClick={() => window.scrollTo({ top: window.innerHeight * 1.5, behavior: 'smooth' })}
            >
              Discover More&nbsp;&nbsp;→
            </motion.button>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Botanical leaf decorations (scene 1 only) ─────────────────────── */}
      <AnimatePresence>
        {activeScene === 'scene1' && (
          <>
            <motion.div
              className="hero-leaf hero-leaf--left"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
            >
              <LeafSvg className="hero-leaf-svg" />
            </motion.div>
            <motion.div
              className="hero-leaf hero-leaf--right"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
            >
              <LeafSvg className="hero-leaf-svg hero-leaf-svg--flip" />
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

      {/* Scene text overlays (all scenes EXCEPT scene1, which uses HeroPanel) */}
      <div className="ui-overlay">
        <AnimatePresence mode="wait">
          {currentScene && currentScene.id !== 'scene1' && (
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
              {currentScene.body && (
                <motion.p className="scene-body" variants={subVariants}>
                  {currentScene.body}
                </motion.p>
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
