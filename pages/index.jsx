import { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import Head from 'next/head';

// SSR-disabled: Three.js requires browser APIs
const Scene = dynamic(() => import('../components/Scene'), { ssr: false });
const ScrollController = dynamic(() => import('../components/ScrollController'), { ssr: false });

// ─── Cookie jar PNG ────────────────────────────────────────────────────────────
// Filled glass jar with chocolate-chip cookies; white background eliminated via
// mix-blend-mode: multiply in CSS (white × warm-cream page bg = transparent).
const JAR_IMG_URL =
  'https://github.com/user-attachments/assets/22a82e26-e579-4038-9ea6-4c876b6cde3c';

// ─── Scene copy ───────────────────────────────────────────────────────────────
// 5 scenes — no emoji icons, just heading + body text from the brief.
const SCENES = [
  {
    id: 'scene1',
    startPct: 0,
    endPct: 0.18,
    title: 'The First Glance',
    body: 'From the very first look, Crunch Bites invites you into a world of warmth and indulgence. Each cookie is crafted to be more than just a snack—it\'s an experience that begins with texture, aroma, and visual delight.',
  },
  {
    id: 'scene2',
    startPct: 0.18,
    endPct: 0.36,
    title: 'Crafted for Crunch',
    body: 'Every Crunch Bites cookie is designed with one goal in mind—perfect crunch. Carefully balanced ingredients and precise baking techniques ensure that every bite delivers a satisfying texture. It\'s not just baking—it\'s craftsmanship.',
  },
  {
    id: 'scene3',
    startPct: 0.36,
    endPct: 0.54,
    title: 'Rolling Into Perfection',
    body: 'As the cookie moves, it represents the journey from raw ingredients to a perfected creation. Each rotation reflects the transformation process—mixing, shaping, baking, and finishing.',
  },
  {
    id: 'scene4',
    startPct: 0.54,
    endPct: 0.76,
    title: 'The Moment of Impact',
    body: 'The moment the cookie meets its destination is where everything comes together. Flavor, texture, and craftsmanship collide to create a satisfying experience. This is the point where anticipation turns into reality.',
  },
  {
    id: 'scene5',
    startPct: 0.76,
    endPct: 1.0,
    title: 'Made to Be Remembered',
    body: 'Crunch Bites isn\'t just about cookies—it\'s about creating lasting impressions. Every detail, from the ingredients to the final presentation, is designed to leave a mark. With every bite, Crunch Bites delivers not just taste, but a memory worth coming back to.',
  },
];

// 5 milestones — one per scene start; drives the progress-dot indicator
const SCENE_MILESTONES = [0, 0.18, 0.36, 0.54, 0.76];

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
  // Direct DOM ref for jar opacity — avoids React re-render on every scroll frame
  const jarRef = useRef(null);

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

        // Active dot — one per scene milestone
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

        // PresentationControls: enable only in scene 1 (p < 0.18)
        const newPE = p < 0.18;
        if (newPE !== prevPERef.current) {
          prevPERef.current = newPE;
          setPresentationEnabled(newPE);
        }
      }

      // Jar overlay opacity — directly manipulate DOM to avoid per-frame re-render
      if (jarRef.current) {
        let jarOp = 0;
        if (p < 0.18)       jarOp = 1;
        else if (p < 0.22)  jarOp = 1 - (p - 0.18) / 0.04;
        jarRef.current.style.opacity = jarOp;
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

      {/* ── Cookie jar overlay ──────────────────────────────────────────────
          Transparent PNG sits above the canvas (z-5) so the cookie 3D model
          shows through the glass and appears to live inside the jar.
          Opacity is driven directly via jarRef to avoid per-frame re-renders.
      ──────────────────────────────────────────────────────────────────── */}
      <div className="jar-overlay" ref={jarRef}>
        <img
          src={JAR_IMG_URL}
          alt=""
          draggable={false}
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
              From the very first look, Crunch Bites invites you into a world
              of warmth and indulgence. Each cookie is crafted to be more than
              just a snack.
            </motion.p>
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
              {currentScene.body && (
                <motion.p className="scene-body" variants={subVariants}>
                  {currentScene.body}
                </motion.p>
              )}
              {/* ── "Discover More" CTA — final scene only ─────────────────── */}
              {currentScene.id === 'scene5' && (
                <motion.a
                  className="scene-discover-btn"
                  href="#order"
                  variants={subVariants}
                >
                  Discover More &nbsp;&nbsp;→
                </motion.a>
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
