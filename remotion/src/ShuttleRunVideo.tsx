import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import {
  COURT_COLOR,
  COURT_LINE,
  PLAYER_COLOR,
  ACCENT,
  Player,
  TimerBadge,
  CounterBadge,
  TitleBar,
  FinalOverlay,
  smoothstep,
  lerp,
} from "./shared";

// Same zoomed-in single free-throw lane view as ProLineDrillVideo.
const SCALE = 40; // px per meter
const KEY_DEPTH_PX = 5.8 * SCALE;
const KEY_HALF_W = 2.45 * SCALE;

const BASELINE_X = 110;
const FT_X = BASELINE_X + KEY_DEPTH_PX;
const MID_X = BASELINE_X + KEY_DEPTH_PX / 2; // player works at mid-depth of the lane
const TRACK_Y = 240;
const Y_TOP = TRACK_Y - KEY_HALF_W;
const Y_BOTTOM = TRACK_Y + KEY_HALF_W;

const START_FRAME = 45;
const LEG0_END = 90; // start (middle) -> top line, lateral slide, touch
const LEG1_END = 140; // top -> bottom line, run
const LEG2_END = 190; // bottom -> top line, run
const LEG3_END = 240; // top -> bottom line, run

const SEGMENTS = [
  { start: 0, end: START_FRAME, from: TRACK_Y, to: TRACK_Y, kind: "idle" as const, label: "Poziție de start — mijlocul careului" },
  { start: START_FRAME, end: LEG0_END, from: TRACK_Y, to: Y_TOP, kind: "slide" as const, label: "① Deplasare laterală — atinge linia" },
  { start: LEG0_END, end: LEG1_END, from: Y_TOP, to: Y_BOTTOM, kind: "run" as const, label: "② Alergare — schimbă direcția" },
  { start: LEG1_END, end: LEG2_END, from: Y_BOTTOM, to: Y_TOP, kind: "run" as const, label: "③ Alergare — schimbă direcția" },
  { start: LEG2_END, end: LEG3_END, from: Y_TOP, to: Y_BOTTOM, kind: "run" as const, label: "④ Alergare — linie finală" },
  { start: LEG3_END, end: Infinity, from: Y_BOTTOM, to: Y_BOTTOM, kind: "idle" as const, label: "✔ Test finalizat" },
];

const getSegment = (frame: number) => SEGMENTS.find((s) => frame < s.end) ?? SEGMENTS[SEGMENTS.length - 1];

const getPlayerY = (frame: number) => {
  const seg = getSegment(frame);
  const dur = seg.end - seg.start;
  const t = dur > 0 && Number.isFinite(dur) ? Math.min(1, Math.max(0, (frame - seg.start) / dur)) : 1;
  return lerp(seg.from, seg.to, smoothstep(t));
};

const LEG_ENDS = [LEG0_END, LEG1_END, LEG2_END, LEG3_END];

export const ShuttleRunVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const timerOpacity = interpolate(frame, [30, 40], [0, 1], { extrapolateRight: "clamp" });
  const captionOpacity = interpolate(frame, [40, 50], [0, 1], { extrapolateRight: "clamp" });
  const whistleOpacity = interpolate(frame, [20, 35, 45, 55], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  const seg = getSegment(frame);
  const playerY = getPlayerY(frame);
  const bounce = seg.kind === "run" ? Math.abs(Math.sin(frame * 0.9)) * 6 : 0;
  const crouch = seg.kind === "slide" ? 0.55 : 0;

  const legsDone = LEG_ENDS.filter((e) => frame >= e).length;
  const elapsedSeconds = frame < START_FRAME ? 0 : Math.min((Math.min(frame, LEG3_END) - START_FRAME) / fps, (LEG3_END - START_FRAME) / fps);
  const finished = frame >= LEG3_END;
  const finalOpacity = interpolate(frame, [250, 265], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: COURT_COLOR }}>
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0 }}>
        <rect x={0} y={0} width={640} height={480} fill={COURT_COLOR} />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x={0} y={i * 60} width={640} height={30} fill="rgba(255,255,255,0.03)" />
        ))}
      </svg>

      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        {/* Baseline */}
        <line x1={BASELINE_X} y1={Y_TOP - 30} x2={BASELINE_X} y2={Y_BOTTOM + 30} stroke={COURT_LINE} strokeWidth={3} />
        <text x={BASELINE_X} y={Y_TOP - 38} textAnchor="middle" fill={COURT_LINE} fontSize={10} fontFamily="sans-serif" opacity={0.75}>Baseline</text>

        {/* Backboard + rim */}
        <line x1={BASELINE_X + 5} y1={TRACK_Y - 16} x2={BASELINE_X + 5} y2={TRACK_Y + 16} stroke={COURT_LINE} strokeWidth={2} opacity={0.9} />
        <line x1={BASELINE_X + 9} y1={TRACK_Y - 16} x2={BASELINE_X + 9} y2={TRACK_Y + 16} stroke={COURT_LINE} strokeWidth={2} opacity={0.9} />
        <line x1={BASELINE_X + 10} y1={TRACK_Y} x2={BASELINE_X + 21} y2={TRACK_Y} stroke={ACCENT} strokeWidth={2.5} />
        <circle cx={BASELINE_X + 21} cy={TRACK_Y} r={6} fill="none" stroke={ACCENT} strokeWidth={2.5} />

        {/* 3-second key (paint) */}
        <rect
          x={BASELINE_X}
          y={Y_TOP}
          width={KEY_DEPTH_PX}
          height={KEY_HALF_W * 2}
          fill="rgba(255,255,255,0.06)"
          stroke={COURT_LINE}
          strokeWidth={2}
          opacity={0.9}
        />

        {/* Free-throw line, closing off the key */}
        <line x1={FT_X} y1={Y_TOP - 20} x2={FT_X} y2={Y_BOTTOM + 20} stroke={COURT_LINE} strokeWidth={2.5} opacity={0.9} />
        <text x={FT_X} y={Y_TOP - 14} textAnchor="middle" fill={COURT_LINE} fontSize={10} fontFamily="sans-serif" opacity={0.75}>Linia careului</text>

        {/* The two shuttle lines — the lane's own side lines — highlighted */}
        <line x1={BASELINE_X} y1={Y_TOP} x2={FT_X} y2={Y_TOP} stroke={ACCENT} strokeWidth={3.5} opacity={0.95} />
        <line x1={BASELINE_X} y1={Y_BOTTOM} x2={FT_X} y2={Y_BOTTOM} stroke={ACCENT} strokeWidth={3.5} opacity={0.95} />
        <text x={MID_X} y={Y_TOP - 10} textAnchor="middle" fill={ACCENT} fontSize={11} fontWeight="bold" fontFamily="sans-serif">LINIA CAREULUI</text>
        <text x={MID_X} y={Y_BOTTOM + 22} textAnchor="middle" fill={ACCENT} fontSize={11} fontWeight="bold" fontFamily="sans-serif">LINIA CAREULUI</text>

        {/* Ghost track between the two lines, at mid-depth */}
        <line x1={MID_X} y1={Y_TOP} x2={MID_X} y2={Y_BOTTOM} stroke={ACCENT} strokeWidth={2} strokeDasharray="6,6" opacity={0.5} />
        <circle cx={MID_X} cy={TRACK_Y} r={11} fill="none" stroke={ACCENT} strokeWidth={2} opacity={0.9} />
        <text x={MID_X + 26} y={TRACK_Y + 4} textAnchor="start" fill={ACCENT} fontSize={10} fontWeight="bold" fontFamily="sans-serif">START</text>

        <Player x={MID_X + bounce} y={playerY} color={PLAYER_COLOR} crouch={crouch} />
      </svg>

      <div style={{ position: "absolute", top: 60, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: whistleOpacity }}>
        <div style={{ backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "6px 18px" }}>
          <span style={{ color: ACCENT, fontSize: 14, fontWeight: "bold", fontFamily: "sans-serif" }}>🔊 Fluier</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: captionOpacity,
        }}
      >
        <div style={{ backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "6px 18px" }}>
          <span style={{ color: "white", fontSize: 14, fontWeight: "bold", fontFamily: "sans-serif" }}>{seg.label}</span>
        </div>
      </div>

      <TimerBadge seconds={elapsedSeconds} opacity={timerOpacity} />
      <CounterBadge label="Curse:" value={legsDone} opacity={timerOpacity} />

      {finished && (
        <div style={{ position: "absolute", top: 60, right: 16, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 16px" }}>
          <span style={{ color: ACCENT, fontSize: 14, fontWeight: "bold", fontFamily: "sans-serif" }}>✔ Traseu complet</span>
        </div>
      )}

      <TitleBar text="💪 Shuttle Run — careul de 3 secunde" />

      <FinalOverlay
        opacity={finalOpacity}
        mainText="Deplasare laterală + alergare dus-întors între liniile careului"
        subText="Se cronometrează timpul total"
      />
    </AbsoluteFill>
  );
};
