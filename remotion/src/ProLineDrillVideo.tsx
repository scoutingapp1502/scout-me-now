import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import {
  COURT_COLOR,
  COURT_LINE,
  PLAYER_COLOR,
  ACCENT,
  Player,
  TimerBadge,
  TitleBar,
  FinalOverlay,
  smoothstep,
  lerp,
} from "./shared";

// Zoomed-in view of a single free-throw lane ("careul de 3 secunde"), viewed from an
// elevated side angle — same visual grammar as StraightLineSpeedBasketballVideo's
// CourtEnd, just scaled up since only one key needs to fit the frame.
const SCALE = 40; // px per meter
const KEY_DEPTH_PX = 5.8 * SCALE; // baseline -> free-throw line
const KEY_HALF_W = 2.45 * SCALE; // half width of the lane
const FT_CIRCLE_R = 1.8 * SCALE; // free-throw circle ("căciulă") radius

const BASELINE_X = 110;
const FT_X = BASELINE_X + KEY_DEPTH_PX;
const TRACK_Y = 240;
const Y_TOP = TRACK_Y - KEY_HALF_W;
const Y_BOTTOM = TRACK_Y + KEY_HALF_W;

// "Primul semn de jos al careului" — the rebound hash mark closest to the baseline.
const FIRST_MARK_F = 0.32;
const HASH_MARKS_F = [0.32, 0.52, 0.72];
const X_START = BASELINE_X + KEY_DEPTH_PX * FIRST_MARK_F;

// Route waypoints, in order.
const P0 = { x: X_START, y: Y_TOP }; // start, at the first mark
const P1 = { x: FT_X, y: TRACK_Y - FT_CIRCLE_R }; // forward run -> edge of the free-throw circle (exterior, where the arc meets the line)
const P2 = { x: FT_X, y: TRACK_Y + FT_CIRCLE_R }; // lateral slide across, level with the free-throw line
const P3 = { x: X_START, y: Y_BOTTOM }; // backpedal to the first mark, other side

// Full route: start-1-2-3-start-3-2-1-start (out, direct return, then the
// same box retraced a second time in reverse).
const RUN1_START = 45;
const RUN1_END = 95; // start -> 1
const SLIDE1_END = 140; // 1 -> 2
const BACK_END = 190; // 2 -> 3
const TO_START_END = 235; // 3 -> start
const TO_3_END = 280; // start -> 3
const RUN_BACK_END = 330; // 3 -> 2
const SLIDE_BACK_END = 375; // 2 -> 1
const FINISH_END = 425; // 1 -> start

const SEGMENTS = [
  { start: 0, end: RUN1_START, from: P0, to: P0, kind: "idle" as const, label: "Poziție de start" },
  { start: RUN1_START, end: RUN1_END, from: P0, to: P1, kind: "run" as const, label: "① Alergare înainte → căciulă" },
  { start: RUN1_END, end: SLIDE1_END, from: P1, to: P2, kind: "slide" as const, label: "② Slide lateral" },
  { start: SLIDE1_END, end: BACK_END, from: P2, to: P3, kind: "run" as const, label: "③ Alergare cu spatele" },
  { start: BACK_END, end: TO_START_END, from: P3, to: P0, kind: "slide" as const, label: "④ Slide lateral — retur la start" },
  { start: TO_START_END, end: TO_3_END, from: P0, to: P3, kind: "slide" as const, label: "⑤ Slide lateral — spre punctul 3" },
  { start: TO_3_END, end: RUN_BACK_END, from: P3, to: P2, kind: "run" as const, label: "⑥ Alergare înainte — retur" },
  { start: RUN_BACK_END, end: SLIDE_BACK_END, from: P2, to: P1, kind: "slide" as const, label: "⑦ Slide lateral — retur" },
  { start: SLIDE_BACK_END, end: FINISH_END, from: P1, to: P0, kind: "run" as const, label: "⑧ Retur la poziția de start" },
  { start: FINISH_END, end: Infinity, from: P0, to: P0, kind: "idle" as const, label: "✔ Test finalizat" },
];

const getSegment = (frame: number) => SEGMENTS.find((s) => frame < s.end) ?? SEGMENTS[SEGMENTS.length - 1];

const getPlayerPos = (frame: number) => {
  const seg = getSegment(frame);
  const dur = seg.end - seg.start;
  const t = dur > 0 && Number.isFinite(dur) ? Math.min(1, Math.max(0, (frame - seg.start) / dur)) : 1;
  const eased = smoothstep(t);
  return { x: lerp(seg.from.x, seg.to.x, eased), y: lerp(seg.from.y, seg.to.y, eased) };
};

const PATH_D = `M ${P0.x},${P0.y} L ${P1.x},${P1.y} L ${P2.x},${P2.y} L ${P3.x},${P3.y} L ${P0.x},${P0.y} L ${P3.x},${P3.y} L ${P2.x},${P2.y} L ${P1.x},${P1.y} L ${P0.x},${P0.y}`;

const Waypoint = ({ x, y, n }: { x: number; y: number; n: string }) => (
  <g>
    <circle cx={x} cy={y} r={10} fill="rgba(0,0,0,0.7)" stroke={ACCENT} strokeWidth={1.5} />
    <text x={x} y={y + 4} textAnchor="middle" fill={ACCENT} fontSize={11} fontWeight="bold" fontFamily="sans-serif">
      {n}
    </text>
  </g>
);

export const ProLineDrillVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const timerOpacity = interpolate(frame, [30, 40], [0, 1], { extrapolateRight: "clamp" });
  const captionOpacity = interpolate(frame, [40, 50], [0, 1], { extrapolateRight: "clamp" });

  const seg = getSegment(frame);
  const { x: playerX, y: playerY } = getPlayerPos(frame);
  const bounce = seg.kind === "run" ? Math.abs(Math.sin(frame * 0.9)) * 6 : 0;
  const crouch = seg.kind === "slide" ? 0.55 : 0;

  const elapsedSeconds = frame < RUN1_START ? 0 : Math.min((Math.min(frame, FINISH_END) - RUN1_START) / fps, (FINISH_END - RUN1_START) / fps);
  const finished = frame >= FINISH_END;
  const finalOpacity = interpolate(frame, [430, 445], [0, 1], { extrapolateRight: "clamp" });

  const ftLabelPt = { x: FT_X, y: Y_TOP - 14 };

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

        {/* Rebound hash marks — first one is the drill's start/return mark */}
        {HASH_MARKS_F.map((f) => {
          const hx = BASELINE_X + KEY_DEPTH_PX * f;
          const isFirst = f === FIRST_MARK_F;
          return (
            <g key={f}>
              <line x1={hx} y1={Y_TOP} x2={hx} y2={Y_TOP - 8} stroke={isFirst ? ACCENT : COURT_LINE} strokeWidth={isFirst ? 3 : 2} opacity={isFirst ? 1 : 0.85} />
              <line x1={hx} y1={Y_BOTTOM} x2={hx} y2={Y_BOTTOM + 8} stroke={isFirst ? ACCENT : COURT_LINE} strokeWidth={isFirst ? 3 : 2} opacity={isFirst ? 1 : 0.85} />
            </g>
          );
        })}

        {/* Free-throw line + circle ("căciula") */}
        <line x1={FT_X} y1={Y_TOP - 20} x2={FT_X} y2={Y_BOTTOM + 20} stroke={COURT_LINE} strokeWidth={2.5} opacity={0.9} />
        <text x={ftLabelPt.x} y={ftLabelPt.y} textAnchor="middle" fill={COURT_LINE} fontSize={10} fontFamily="sans-serif" opacity={0.75}>Linia careului</text>
        <path
          d={`M ${FT_X},${TRACK_Y - FT_CIRCLE_R} A ${FT_CIRCLE_R} ${FT_CIRCLE_R} 0 0 0 ${FT_X},${TRACK_Y + FT_CIRCLE_R}`}
          fill="none"
          stroke={COURT_LINE}
          strokeWidth={2}
          strokeDasharray="4,4"
          opacity={0.8}
        />
        <path
          d={`M ${FT_X},${TRACK_Y - FT_CIRCLE_R} A ${FT_CIRCLE_R} ${FT_CIRCLE_R} 0 0 1 ${FT_X},${TRACK_Y + FT_CIRCLE_R}`}
          fill="none"
          stroke={COURT_LINE}
          strokeWidth={2}
          opacity={0.9}
        />

        {/* Ghost route + numbered waypoints */}
        <path d={PATH_D} fill="none" stroke={ACCENT} strokeWidth={2} strokeDasharray="6,6" opacity={0.55} />
        <Waypoint x={P1.x} y={P1.y} n="1" />
        <Waypoint x={P2.x} y={P2.y} n="2" />
        <Waypoint x={P3.x} y={P3.y} n="3" />
        <circle cx={P0.x} cy={P0.y} r={11} fill="none" stroke={ACCENT} strokeWidth={2} opacity={0.9} />
        <text x={P0.x} y={Y_TOP - 44} textAnchor="middle" fill={ACCENT} fontSize={10} fontWeight="bold" fontFamily="sans-serif">START / FINISH</text>

        <Player x={playerX} y={playerY - bounce} color={PLAYER_COLOR} crouch={crouch} />
      </svg>

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

      {finished && (
        <div style={{ position: "absolute", top: 60, right: 16, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 16px" }}>
          <span style={{ color: ACCENT, fontSize: 14, fontWeight: "bold", fontFamily: "sans-serif" }}>✔ Traseu complet</span>
        </div>
      )}

      <TitleBar text="⚡ Pro Line Drill — agilitate în careu" />

      <FinalOverlay
        opacity={finalOpacity}
        mainText="Traseu complet dus-întors, executat de doua ori (tur si retur)"
        subText="Se cronometrează timpul total de execuție"
      />
    </AbsoluteFill>
  );
};
