import { useCallback, useEffect, useRef, useState } from 'react';
import { createEngine, DEFAULT_BRIGHTNESS } from './features/game/index.js';
import { getBookContent } from './features/books/index.js';
import {
  initAudio,
  getAudio,
  setVolume as setAudioVolume,
  setMuted as setAudioMuted,
} from './features/audio/index.js';
import { DIRECTION_NAMES, PATH_LENGTH, revelationForProgress } from './features/world/index.js';
import Splash from './features/ui/Splash.jsx';
import Hud from './features/ui/Hud.jsx';
import BookOverlay from './features/ui/BookOverlay.jsx';
import Ending from './features/ui/Ending.jsx';
import PauseMenu from './features/ui/PauseMenu.jsx';
import TouchControls from './features/ui/TouchControls.jsx';
import CrimsonArrival from './features/ui/CrimsonArrival.jsx';
import MysteryCutscene from './features/ui/MysteryCutscene.jsx';

// Primary input is touch when the pointer is coarse (phones/tablets).
// ?touch forces it for testing.
const IS_TOUCH =
  window.matchMedia?.('(pointer: coarse)').matches ||
  new URLSearchParams(window.location.search).has('touch');

const INITIAL_STATS = { rooms: 1, books: 0, fragments: 0 };

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const openedRef = useRef(new Set());
  const fragmentsRef = useRef(new Set());

  // Incremented on restart: remounts the canvas and rebuilds the engine.
  const [session, setSession] = useState(0);
  const [phase, setPhase] = useState('splash'); // splash | playing | ended
  const phaseRef = useRef('splash');
  const [stats, setStats] = useState(INITIAL_STATS);
  const [openBook, setOpenBook] = useState(null);
  const openBookRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  const [questProgress, setQuestProgress] = useState(0);
  const [facing, setFacing] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [brightness, setBrightness] = useState(DEFAULT_BRIGHTNESS);
  const winPendingRef = useRef(false);
  const winTimer = useRef(null);
  const crimsonArrivingRef = useRef(false);
  const [crimsonArriving, setCrimsonArriving] = useState(false);
  const seenRevelationsRef = useRef(new Set());
  const mysteryRef = useRef(null);
  const [mystery, setMystery] = useState(null);

  const setPhaseSync = useCallback((value) => {
    phaseRef.current = value;
    setPhase(value);
  }, []);

  const setMenuOpenSync = useCallback((value) => {
    menuOpenRef.current = value;
    setMenuOpen(value);
  }, []);

  const showToast = useCallback((text) => {
    clearTimeout(toastTimer.current);
    setToast({ text, at: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    const engine = createEngine(
      canvasRef.current,
      {
        onRoomEnter({ roomsVisited, crimson }) {
          setStats((s) => ({ ...s, rooms: roomsVisited }));
          getAudio()?.roomStep();
          if (crimson && !crimsonArrivingRef.current) {
            showToast('The lamps turn to embers.');
          }
        },
        onCrimsonTransitionStart() {
          crimsonArrivingRef.current = true;
          setCrimsonArriving(true);
          document.exitPointerLock();
        },
        onCrimsonReveal() {
          getAudio()?.crimsonReveal();
        },
        onCrimsonTransitionEnd() {
          crimsonArrivingRef.current = false;
          setCrimsonArriving(false);
          showToast('The lamps turn to embers.');
          engineRef.current?.requestLock();
        },
        onQuestEvent(event) {
          setQuestProgress(event.progress ?? 0);
          if (event.type === 'advanced') {
            const step = event.progress;
            const revelation = revelationForProgress(step);
            if (revelation && !seenRevelationsRef.current.has(step)) {
              seenRevelationsRef.current.add(step);
              const beat = { revelation, step };
              mysteryRef.current = beat;
              setMystery(beat);
              engine.setPaused(true);
              document.exitPointerLock();
              getAudio()?.revelation();
            } else {
              showToast(`The path holds. (${step} of ${PATH_LENGTH})`);
              getAudio()?.pathAdvance();
            }
          } else if (event.type === 'lost') {
            showToast('The path crumbles behind you.');
            getAudio()?.pathLost();
          } else if (event.type === 'arrived') {
            setQuestProgress(PATH_LENGTH);
          }
        },
        onOpenBook(target) {
          if (
            openBookRef.current ||
            menuOpenRef.current ||
            winPendingRef.current ||
            mysteryRef.current
          ) {
            return;
          }
          if (phaseRef.current !== 'playing') return;
          if (target.crimson) {
            // Taking the perfect book: let it ascend for a moment, then
            // the ending takes over. There is no walking away from it.
            winPendingRef.current = true;
            engine.markWon();
            getAudio()?.win();
            engine.setPaused(true);
            document.exitPointerLock();
            winTimer.current = setTimeout(() => setPhaseSync('ended'), 2200);
            return;
          }
          const [q, r] = target.room.split(',').map(Number);
          const content = getBookContent(q, r, target.index);
          const bookKey = `${target.room}:${target.index}`;
          openedRef.current.add(bookKey);
          if (content.kind !== 'gibberish') fragmentsRef.current.add(bookKey);
          setStats((s) => ({
            ...s,
            books: openedRef.current.size,
            fragments: fragmentsRef.current.size,
          }));
          getAudio()?.pageOpen();
          engine.setPaused(true);
          openBookRef.current = content;
          setOpenBook(content);
          document.exitPointerLock();
        },
        onHover(target) {
          setHovering(target !== null);
        },
        onFacing(dir) {
          setFacing(dir);
        },
        onFootstep() {
          getAudio()?.footstep();
        },
        onCatMeow(colorIdx) {
          getAudio()?.meow(colorIdx);
        },
        onLockChange(isLocked) {
          setLocked(isLocked);
          // Losing pointer lock mid-game (ESC, alt-tab) opens the pause menu.
          if (
            !isLocked &&
            !IS_TOUCH &&
            phaseRef.current === 'playing' &&
            !openBookRef.current &&
            !menuOpenRef.current &&
            !winPendingRef.current &&
            !crimsonArrivingRef.current &&
            !mysteryRef.current
          ) {
            engine.setPaused(true);
            setMenuOpenSync(true);
          }
        },
      },
      { touchMode: IS_TOUCH }
    );
    engineRef.current = engine;
    engine.setBrightness(brightness);
    return () => engine.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const startGame = useCallback(() => {
    initAudio();
    setPhaseSync('playing');
    const engine = engineRef.current;
    engine.setPaused(false);
    engine.requestLock();
  }, [setPhaseSync]);

  const closeBook = useCallback((viaClick) => {
    openBookRef.current = null;
    setOpenBook(null);
    getAudio()?.pageClose();
    const engine = engineRef.current;
    engine.setPaused(false);
    if (viaClick) engine.requestLock();
  }, []);

  const resume = useCallback(() => {
    getAudio()?.uiClick();
    setMenuOpenSync(false);
    const engine = engineRef.current;
    engine.setPaused(false);
    engine.requestLock();
  }, [setMenuOpenSync]);

  const closeMystery = useCallback(() => {
    const step = mysteryRef.current?.step ?? questProgress;
    mysteryRef.current = null;
    setMystery(null);
    showToast(`The path holds. (${step} of ${PATH_LENGTH})`);
    const engine = engineRef.current;
    engine.setPaused(false);
    engine.requestLock();
  }, [questProgress, showToast]);

  const restart = useCallback(() => {
    getAudio()?.uiClick();
    clearTimeout(winTimer.current);
    winPendingRef.current = false;
    openedRef.current = new Set();
    fragmentsRef.current = new Set();
    seenRevelationsRef.current = new Set();
    mysteryRef.current = null;
    setMystery(null);
    setStats(INITIAL_STATS);
    setQuestProgress(0);
    openBookRef.current = null;
    setOpenBook(null);
    setMenuOpenSync(false);
    setToast(null);
    setCrimsonArriving(false);
    crimsonArrivingRef.current = false;
    setPhaseSync('splash');
    setSession((s) => s + 1);
  }, [setMenuOpenSync, setPhaseSync]);

  const changeVolume = useCallback((v) => {
    setVolume(v);
    setAudioVolume(v);
  }, []);

  const changeBrightness = useCallback((v) => {
    setBrightness(v);
    engineRef.current?.setBrightness(v);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      setAudioMuted(!m);
      return !m;
    });
  }, []);

  const openMenu = useCallback(() => {
    getAudio()?.uiClick();
    engineRef.current.setPaused(true);
    setMenuOpenSync(true);
  }, [setMenuOpenSync]);

  useEffect(() => {
    function onKey(e) {
      if (e.code === 'Escape' && openBookRef.current) closeBook(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeBook]);

  const showResumeHint =
    phase === 'playing' &&
    !IS_TOUCH &&
    !locked &&
    !openBook &&
    !menuOpen &&
    !crimsonArriving &&
    !mystery;

  return (
    <div className="app">
      <canvas key={session} ref={canvasRef} className="game-canvas" />
      {crimsonArriving && phase === 'playing' && <CrimsonArrival />}
      {mystery && phase === 'playing' && (
        <MysteryCutscene
          revelation={mystery.revelation}
          step={mystery.step}
          of={PATH_LENGTH}
          onContinue={closeMystery}
          touch={IS_TOUCH}
        />
      )}
      {phase === 'playing' && (
        <Hud
          stats={stats}
          questProgress={questProgress}
          facingName={DIRECTION_NAMES[facing]}
          hovering={hovering}
          showCrosshair={
            (locked || IS_TOUCH) && !openBook && !menuOpen && !crimsonArriving && !mystery
          }
          showInteract={
            !IS_TOUCH && hovering && locked && !openBook && !crimsonArriving && !mystery
          }
          showResumeHint={showResumeHint}
          toast={toast}
        />
      )}
      {phase === 'playing' &&
        IS_TOUCH &&
        !openBook &&
        !menuOpen &&
        !crimsonArriving &&
        !mystery && (
          <TouchControls
            onMove={(x, z) => engineRef.current.setMoveInput(x, z)}
            onInteract={() => engineRef.current.interact()}
            onPause={openMenu}
            hovering={hovering}
          />
        )}
      {openBook && <BookOverlay book={openBook} onClose={() => closeBook(true)} />}
      {menuOpen && phase === 'playing' && !openBook && !mystery && (
        <PauseMenu
          onResume={resume}
          onRestart={restart}
          touch={IS_TOUCH}
          volume={volume}
          muted={muted}
          onVolume={changeVolume}
          onToggleMute={toggleMute}
          brightness={brightness}
          onBrightness={changeBrightness}
        />
      )}
      {phase === 'splash' && <Splash onStart={startGame} touch={IS_TOUCH} />}
      {phase === 'ended' && <Ending stats={stats} onRestart={restart} />}
    </div>
  );
}
