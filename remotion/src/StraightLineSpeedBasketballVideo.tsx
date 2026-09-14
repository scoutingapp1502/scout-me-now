import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import {
  PLAYER_COLOR,
  ACCENT,
  COURT_COLOR,
  COURT_LINE,
  Player,
  TimerBadge,
  TitleBar,
  FinalOverlay,
  smoothstep,
} from "./shared";

const SCALE = 18.5; // px per meter
const KEY_DEPTH_PX = 5.8 * SCALE; // 3-second key depth (baseline -> free-throw line)
const KEY_HALF_W = 2.45 * SCALE; // key half-width
const FT_CIRCLE_R = 1.8 * SCALE; // free-throw circle ("căciulă") radius
// Enlarged slightly past the literal FIBA 6.75m so the drawn arc fully encloses the "căciulă"
// (baseline + key depth + FT circle radius = 7.6m, just barely past a true 7.5m half-width) —
// a small stylized allowance, not a real measurement, purely so the two never visually cross.
const THREE_PT_R = 148;

const NEAR_BASELINE_X = 55;
const START_X = NEAR_BASELINE_X;
const FINISH_X = START_X + 22 * SCALE; // opposite free-throw line
const FAR_BASELINE_X = FINISH_X + KEY_DEPTH_PX;
const TRACK_Y = 230;
const HALF_COURT_W = THREE_PT_R + 6; // sideline offset from center — must clear the 3pt arc radius
const CENTER_X = (NEAR_BASELINE_X + FAR_BASELINE_X) / 2;

const RUN_START = 45;
const RUN_END = 225;

const CourtEnd = ({ baselineX, dir, label, markerX }: { baselineX: number; dir: 1 | -1; label: string; markerX: number }) => {
  const ftX = baselineX + dir * KEY_DEPTH_PX;
  const sweep = dir === 1 ? 1 : 0;
  return (
    <g>
      {/* Baseline */}
      <line x1={baselineX} y1={TRACK_Y - HALF_COURT_W} x2={baselineX} y2={TRACK_Y + HALF_COURT_W} stroke={COURT_LINE} strokeWidth={3} />
      <text x={baselineX} y={TRACK_Y - HALF_COURT_W - 10} textAnchor="middle" fill={COURT_LINE} fontSize={9} fontFamily="sans-serif" opacity={0.75}>Baseline</text>

      {/* Backboard (double line, inside the court) + short arm + rim right in front of it */}
      <line x1={baselineX + dir * 5} y1={TRACK_Y - 16} x2={baselineX + dir * 5} y2={TRACK_Y + 16} stroke={COURT_LINE} strokeWidth={2} opacity={0.9} />
      <line x1={baselineX + dir * 9} y1={TRACK_Y - 16} x2={baselineX + dir * 9} y2={TRACK_Y + 16} stroke={COURT_LINE} strokeWidth={2} opacity={0.9} />
      <line x1={baselineX + dir * 10} y1={TRACK_Y} x2={baselineX + dir * 21} y2={TRACK_Y} stroke={ACCENT} strokeWidth={2.5} />
      <circle cx={baselineX + dir * 21} cy={TRACK_Y} r={6} fill="none" stroke={ACCENT} strokeWidth={2.5} />

      {/* 3-second key (paint) */}
      <rect
        x={Math.min(baselineX, ftX)}
        y={TRACK_Y - KEY_HALF_W}
        width={Math.abs(ftX - baselineX)}
        height={KEY_HALF_W * 2}
        fill="rgba(255,255,255,0.06)"
        stroke={COURT_LINE}
        strokeWidth={2}
        opacity={0.9}
      />

      {/* Lane hash marks (rebound spots) */}
      {[0.32, 0.52, 0.72].map((f) => {
        const hx = baselineX + dir * KEY_DEPTH_PX * f;
        return (
          <g key={f}>
            <line x1={hx} y1={TRACK_Y - KEY_HALF_W} x2={hx} y2={TRACK_Y - KEY_HALF_W - 7} stroke={COURT_LINE} strokeWidth={2} opacity={0.85} />
            <line x1={hx} y1={TRACK_Y + KEY_HALF_W} x2={hx} y2={TRACK_Y + KEY_HALF_W + 7} stroke={COURT_LINE} strokeWidth={2} opacity={0.85} />
          </g>
        );
      })}

      {/* Free-throw circle ("căciulă"): solid half toward the basket, dashed half toward mid-court */}
      <path
        d={`M ${ftX},${TRACK_Y - FT_CIRCLE_R} A ${FT_CIRCLE_R} ${FT_CIRCLE_R} 0 0 ${dir === 1 ? 0 : 1} ${ftX},${TRACK_Y + FT_CIRCLE_R}`}
        fill="none"
        stroke={COURT_LINE}
        strokeWidth={2}
        opacity={0.9}
      />
      <path
        d={`M ${ftX},${TRACK_Y - FT_CIRCLE_R} A ${FT_CIRCLE_R} ${FT_CIRCLE_R} 0 0 ${dir === 1 ? 1 : 0} ${ftX},${TRACK_Y + FT_CIRCLE_R}`}
        fill="none"
        stroke={COURT_LINE}
        strokeWidth={2}
        strokeDasharray="4,4"
        opacity={0.8}
      />

      {/* 3-point arc: clean round semicircle, centered on the baseline */}
      <path
        d={`M ${baselineX},${TRACK_Y - THREE_PT_R} A ${THREE_PT_R} ${THREE_PT_R} 0 0 ${sweep} ${baselineX},${TRACK_Y + THREE_PT_R}`}
        fill="none"
        stroke={COURT_LINE}
        strokeWidth={2}
        opacity={0.55}
      />

      {/* Marker at the actual free-throw line (finish) / baseline (start) */}
      <line x1={markerX} y1={TRACK_Y - HALF_COURT_W - 6} x2={markerX} y2={TRACK_Y + HALF_COURT_W + 6} stroke={ACCENT} strokeWidth={2.5} opacity={0.9} />
      <text x={markerX} y={TRACK_Y + HALF_COURT_W + 22} textAnchor="middle" fill={ACCENT} fontSize={10} fontWeight="bold" fontFamily="sans-serif">{label}</text>
    </g>
  );
};

export const StraightLineSpeedBasketballVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const timerOpacity = interpolate(frame, [30, 40], [0, 1], { extrapolateRight: "clamp" });

  const runT = interpolate(frame, [RUN_START, RUN_END], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eased = smoothstep(runT);
  const playerX = interpolate(eased, [0, 1], [START_X, FINISH_X]);
  const bounce = frame >= RUN_START && frame < RUN_END ? Math.abs(Math.sin(frame * 0.9)) * 6 : 0;

  const elapsedSeconds = frame < RUN_START ? 0 : Math.min((Math.min(frame, RUN_END) - RUN_START) / fps, (RUN_END - RUN_START) / fps);
  const finished = frame >= RUN_END;
  const finalOpacity = interpolate(frame, [235, 255], [0, 1], { extrapolateRight: "clamp" });
  const midX = (START_X + FINISH_X) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: COURT_COLOR }}>
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0 }}>
        <rect x={0} y={0} width={640} height={480} fill={COURT_COLOR} />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x={0} y={i * 60} width={640} height={30} fill="rgba(255,255,255,0.03)" />
        ))}
      </svg>

      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        {/* Sidelines */}
        <line x1={NEAR_BASELINE_X} y1={TRACK_Y - HALF_COURT_W} x2={FAR_BASELINE_X} y2={TRACK_Y - HALF_COURT_W} stroke={COURT_LINE} strokeWidth={2.5} />
        <line x1={NEAR_BASELINE_X} y1={TRACK_Y + HALF_COURT_W} x2={FAR_BASELINE_X} y2={TRACK_Y + HALF_COURT_W} stroke={COURT_LINE} strokeWidth={2.5} />
        <text x={(NEAR_BASELINE_X + FAR_BASELINE_X) / 2} y={TRACK_Y - HALF_COURT_W - 8} textAnchor="middle" fill={COURT_LINE} fontSize={9} fontFamily="sans-serif" opacity={0.6}>Sideline</text>

        {/* Center (halfway) line + center circle */}
        <line x1={CENTER_X} y1={TRACK_Y - HALF_COURT_W} x2={CENTER_X} y2={TRACK_Y + HALF_COURT_W} stroke={COURT_LINE} strokeWidth={2} opacity={0.85} />
        <circle cx={CENTER_X} cy={TRACK_Y} r={FT_CIRCLE_R} fill="none" stroke={COURT_LINE} strokeWidth={2} opacity={0.85} />

        <CourtEnd baselineX={NEAR_BASELINE_X} dir={1} label="START" markerX={START_X} />
        <CourtEnd baselineX={FAR_BASELINE_X} dir={-1} label="FINISH" markerX={FINISH_X} />

        {/* Sprint track */}
        <line x1={START_X} y1={TRACK_Y + 18} x2={FINISH_X} y2={TRACK_Y + 18} stroke={COURT_LINE} strokeWidth={2} strokeDasharray="6,6" opacity={0.5} />
        <text x={midX} y={TRACK_Y - HALF_COURT_W + 16} textAnchor="middle" fill="#fff" fontSize={16} fontWeight="bold" fontFamily="sans-serif">22 m</text>

        <Player x={playerX} y={TRACK_Y - bounce} color={PLAYER_COLOR} />
      </svg>

      <TimerBadge seconds={elapsedSeconds} opacity={timerOpacity} />

      {finished && (
        <div style={{ position: "absolute", top: 16, left: 16, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 16px" }}>
          <span style={{ color: ACCENT, fontSize: 14, fontWeight: "bold", fontFamily: "sans-serif" }}>✔ Distanță parcursă</span>
        </div>
      )}

      <TitleBar text="🏁 Straight Line Speed (Baschet) — sprint pe 22 m" />

      <FinalOverlay
        opacity={finalOpacity}
        mainText="Baseline → linia de aruncări libere opusă"
        subText="22 m — sprint maxim, cronometrat"
      />
    </AbsoluteFill>
  );
};
