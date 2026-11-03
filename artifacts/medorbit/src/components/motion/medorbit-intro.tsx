import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Map, Pause, Play, Route } from "lucide-react";
import { Link } from "wouter";
import { OrbitPlaceholder } from "./orbit-placeholder";

const OrbitVisual = lazy(() => import("./orbit-visual").then((module) => ({ default: module.OrbitVisual })));

class OrbitBoundary extends Component<{ children: ReactNode; onUnavailable: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? <OrbitPlaceholder /> : this.props.children; }
}

export function MedOrbitIntro() {
  const reducedMotion = useReducedMotion() ?? true;
  const [paused, setPaused] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  return (
    <motion.section
      className="medorbit-intro mb-6"
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
      aria-label="مساحة العمل الميدانية"
      data-testid="section-motion-intro"
    >
      <div className="intro-orbit-art">
        {reducedMotion ? <OrbitPlaceholder /> : (
          <OrbitBoundary onUnavailable={() => setSceneReady(false)}>
            <Suspense fallback={<OrbitPlaceholder />}>
              <OrbitVisual reducedMotion={reducedMotion} paused={paused} onReadyChange={setSceneReady} />
            </Suspense>
          </OrbitBoundary>
        )}
      </div>
      <div className="intro-content">
        <p className="intro-eyebrow"><span aria-hidden="true" />ميد أوربت · مساحة عملك الميدانية</p>
        <h2 className="font-display">خطّط بثقة.<br /><span>وابدأ يومك بوضوح.</span></h2>
        <p className="intro-description">الأطباء، الجولة، وتقارير الزيارات في مساحة واحدة.</p>
        <div className="intro-actions">
          <motion.div whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }}>
            <Link href="/smart-route" className="intro-cta intro-cta-primary" data-testid="link-intro-smart-route"><Route className="h-4 w-4" />خطّط لجولتك<ArrowLeft className="h-3.5 w-3.5" /></Link>
          </motion.div>
          <motion.div whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }}>
            <Link href="/doctor-map" className="intro-cta intro-cta-secondary" data-testid="link-intro-doctor-map"><Map className="h-4 w-4" />خريطة الأطباء</Link>
          </motion.div>
        </div>
      </div>
      {!reducedMotion && sceneReady && <button type="button" className="intro-pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? "تشغيل حركة المجسم" : "إيقاف حركة المجسم"} data-testid="button-toggle-orbit-motion">{paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</button>}
    </motion.section>
  );
}
