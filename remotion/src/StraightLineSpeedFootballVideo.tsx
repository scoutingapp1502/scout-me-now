import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import {
  FIELD_GREEN,
  FIELD_LINE,
  PLAYER_COLOR,
  ACCENT,
  Player,
  TimerBadge,
  TitleBar,
  FinalOverlay,
  smoothstep,
} from "./shared";

const SCALE = 5.1; // px per meter
const PITCH_LENGTH = 105;
const PITCH_WIDTH = 68;

const NEAR_GOAL_X = 40;
const FAR_GOAL_X = NEAR_GOAL_X + PITCH_LENGTH * SCALE;
const TRACK_Y = 240;
const HALF_WIDTH_PX = (PITCH_WIDTH / 2) * SCALE;
const CENTER_X = (NEAR_GOAL_X + FAR_GOAL_X) / 2;
const CENTER_CIRCLE_R = 9.15 * SCALE;

const PENALTY_DEPTH_PX = 16.5 * SCALE;
const PENALTY_HALF_W = 20.16 * SCALE;
const GOAL_AREA_DEPTH_PX = 5.5 * SCALE;
const GOAL_AREA_HALF_W = 9.16 * SCALE;
const PENALTY_SPOT_PX = 11 * SCALE;
const PENALTY_ARC_R = 9.15 * SCALE;
const GOAL_MOUTH_HALF = 3.66 * SCALE;
const CORNER_R = Math.max(1 * SCALE, 6);

const START_X = NEAR_GOAL_X + PENALTY_DEPTH_PX; // edge of the penalty area
const FINISH_X = START_X + GOAL_AREA_DEPTH_PX; // + goal-area depth = 22m total

const RUN_START = 45;
const RUN_END = 225;

const CornerArc = ({ goalX, cornerY, dir }: { goalX: number; cornerY: number; dir: 1 | -1 }) => {
  const alongGoalSign = cornerY > TRACK_Y ? -1 : 1;
  const a = { x: goalX, y: cornerY + alongGoalSign * CORNER_R };
  const b = { x: goalX + dir * CORNER_R, y: cornerY };
  const sweep = dir === alongGoalSign ? 0 : 1;
  return <path d={`M ${a.x},${a.y} A ${CORNER_R} ${CORNER_R} 0 0 ${sweep} ${b.x},${b.y}`} fill="none" stroke={FIELD_LINE} strokeWidth={2} opacity={0.85} />;
};

const PitchEnd = ({ goalX, dir, label, markerX, showMarker = true }: { goalX: number; dir: 1 | -1; label: string; markerX: number; showMarker?: boolean }) => {
  const sixX = goalX + dir * GOAL_AREA_DEPTH_PX;
  const boxX = goalX + dir * PENALTY_DEPTH_PX;
  const spotX = goalX + dir * PENALTY_SPOT_PX;
  const arcInset = Math.abs(boxX - spotX);
  const arcYOffset = Math.sqrt(PENALTY_ARC_R * PENALTY_ARC_R - arcInset * arcInset);
  const arcSweep = dir === 1 ? 1 : 0;

  return (
    <g>
      {/* Goal line */}
      <line x1={goalX} y1={TRACK_Y - HALF_WIDTH_PX} x2={goalX} y2={TRACK_Y + HALF_WIDTH_PX} stroke={FIELD_LINE} strokeWidth={2.5} />

      {/* Goal */}
      <rect x={goalX - dir * 7} y={TRACK_Y - GOAL_MOUTH_HALF} width={7} height={GOAL_MOUTH_HALF * 2} fill="none" stroke={FIELD_LINE} strokeWidth={2} opacity={0.9} />

      {/* Goal area (six-yard box) */}
      <rect x={Math.min(goalX, sixX)} y={TRACK_Y - GOAL_AREA_HALF_W} width={Math.abs(sixX - goalX)} height={GOAL_AREA_HALF_W * 2} fill="none" stroke={FIELD_LINE} strokeWidth={2} opacity={0.9} />

      {/* Penalty area (18-yard box) */}
      <rect x={Math.min(goalX, boxX)} y={TRACK_Y - PENALTY_HALF_W} width={Math.abs(boxX - goalX)} height={PENALTY_HALF_W * 2} fill="none" stroke={FIELD_LINE} strokeWidth={2} opacity={0.9} />
      <text x={(goalX + boxX) / 2} y={TRACK_Y - PENALTY_HALF_W - 8} textAnchor="middle" fill={FIELD_LINE} fontSize={9} fontFamily="sans-serif" opacity={0.75}>Careul mare (16,5 m)</text>

      {/* Penalty spot */}
      <circle cx={spotX} cy={TRACK_Y} r={2} fill={FIELD_LINE} />

      {/* Penalty arc ("D") */}
      <path
        d={`M ${boxX},${TRACK_Y - arcYOffset} A ${PENALTY_ARC_R} ${PENALTY_ARC_R} 0 0 ${arcSweep} ${boxX},${TRACK_Y + arcYOffset}`}
        fill="none"
        stroke={FIELD_LINE}
        strokeWidth={2}
        opacity={0.8}
      />

      {/* Corner arcs */}
      <CornerArc goalX={goalX} cornerY={TRACK_Y - HALF_WIDTH_PX} dir={dir} />
      <CornerArc goalX={goalX} cornerY={TRACK_Y + HALF_WIDTH_PX} dir={dir} />

      {/* Marker at the actual start point of the sprint — crosses the player's own running lane */}
      {showMarker && (
        <>
          <line x1={markerX} y1={TRACK_Y - 40} x2={markerX} y2={TRACK_Y + 50} stroke={ACCENT} strokeWidth={3} />
          <text x={markerX} y={TRACK_Y - 46} textAnchor="middle" fill={ACCENT} fontSize={12} fontWeight="bold" fontFamily="sans-serif">{label}</text>
        </>
      )}
    </g>
  );
};

export const StraightLineSpeedFootballVideo: React.FC = () => {
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
    <AbsoluteFill style={{ backgroundColor: FIELD_GREEN }}>
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x={0} y={i * 60} width={640} height={30} fill="rgba(255,255,255,0.03)" />
        ))}
      </svg>

      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        {/* Touchlines */}
        <line x1={NEAR_GOAL_X} y1={TRACK_Y - HALF_WIDTH_PX} x2={FAR_GOAL_X} y2={TRACK_Y - HALF_WIDTH_PX} stroke={FIELD_LINE} strokeWidth={2.5} />
        <line x1={NEAR_GOAL_X} y1={TRACK_Y + HALF_WIDTH_PX} x2={FAR_GOAL_X} y2={TRACK_Y + HALF_WIDTH_PX} stroke={FIELD_LINE} strokeWidth={2.5} />
        <text x={CENTER_X} y={TRACK_Y - HALF_WIDTH_PX - 8} textAnchor="middle" fill={FIELD_LINE} fontSize={9} fontFamily="sans-serif" opacity={0.6}>Tușa (touchline)</text>

        {/* Center line + center circle */}
        <line x1={CENTER_X} y1={TRACK_Y - HALF_WIDTH_PX} x2={CENTER_X} y2={TRACK_Y + HALF_WIDTH_PX} stroke={FIELD_LINE} strokeWidth={2} opacity={0.85} />
        <circle cx={CENTER_X} cy={TRACK_Y} r={CENTER_CIRCLE_R} fill="none" stroke={FIELD_LINE} strokeWidth={2} opacity={0.85} />
        <circle cx={CENTER_X} cy={TRACK_Y} r={2} fill={FIELD_LINE} />
        <text x={CENTER_X} y={TRACK_Y + HALF_WIDTH_PX + 14} textAnchor="middle" fill={FIELD_LINE} fontSize={9} fontFamily="sans-serif" opacity={0.7}>Linia de centru</text>

        <PitchEnd goalX={NEAR_GOAL_X} dir={1} label="START" markerX={START_X} />
        <PitchEnd goalX={FAR_GOAL_X} dir={-1} label="" markerX={FAR_GOAL_X} showMarker={false} />

        {/* Sprint track + finish marker — same running lane the player actually uses */}
        <line x1={START_X} y1={TRACK_Y + 20} x2={FINISH_X} y2={TRACK_Y + 20} stroke={FIELD_LINE} strokeWidth={2} strokeDasharray="6,6" opacity={0.5} />
        <line x1={FINISH_X} y1={TRACK_Y - 40} x2={FINISH_X} y2={TRACK_Y + 50} stroke={ACCENT} strokeWidth={3} />
        <text x={FINISH_X} y={TRACK_Y - 64} textAnchor="middle" fill={ACCENT} fontSize={12} fontWeight="bold" fontFamily="sans-serif">FINISH</text>
        <text x={midX} y={TRACK_Y - 82} textAnchor="middle" fill="#fff" fontSize={15} fontWeight="bold" fontFamily="sans-serif">22 m</text>

        <Player x={playerX} y={TRACK_Y - bounce} color={PLAYER_COLOR} />
      </svg>

      <TimerBadge seconds={elapsedSeconds} opacity={timerOpacity} />

      {finished && (
        <div style={{ position: "absolute", top: 16, left: 16, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 16px" }}>
          <span style={{ color: ACCENT, fontSize: 14, fontWeight: "bold", fontFamily: "sans-serif" }}>✔ Distanță parcursă</span>
        </div>
      )}

      <TitleBar text="🏁 Straight Line Speed (Fotbal) — sprint pe 22 m" />

      <FinalOverlay
        opacity={finalOpacity}
        mainText="Marginea careului mare → +5,5 m (careul mic)"
        subText="16,5 m + 5,5 m = 22 m — sprint maxim, cronometrat"
      />
    </AbsoluteFill>
  );
};
