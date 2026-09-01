import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import {
  FIELD_GREEN,
  FIELD_LINE,
  PLAYER_COLOR,
  ACCENT,
  Player,
  Cone,
  FieldBackground,
  TimerBadge,
  TitleBar,
  FinalOverlay,
  smoothstep,
} from "./shared";

const START_X = 60;
const FINISH_X = 580;
const TRACK_Y = 300;
const RUN_START = 40;
const RUN_END = 210;

export const ProLineDrillVideo: React.FC = () => {
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

  const finalOpacity = interpolate(frame, [225, 245], [0, 1], { extrapolateRight: "clamp" });

  const cones = [1, 2, 3, 4, 5].map((i) => START_X + 40 + i * ((FINISH_X - START_X - 80) / 5));

  return (
    <AbsoluteFill style={{ backgroundColor: FIELD_GREEN }}>
      <FieldBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        <line x1={START_X} y1={TRACK_Y + 20} x2={FINISH_X} y2={TRACK_Y + 20} stroke={FIELD_LINE} strokeWidth={2} strokeDasharray="6,6" opacity={0.5} />
        <line x1={START_X} y1={TRACK_Y - 40} x2={START_X} y2={TRACK_Y + 30} stroke={ACCENT} strokeWidth={3} />
        <text x={START_X} y={TRACK_Y - 46} textAnchor="middle" fill={ACCENT} fontSize={12} fontWeight="bold" fontFamily="sans-serif">START</text>
        <line x1={FINISH_X} y1={TRACK_Y - 40} x2={FINISH_X} y2={TRACK_Y + 30} stroke={ACCENT} strokeWidth={3} />
        <text x={FINISH_X} y={TRACK_Y - 46} textAnchor="middle" fill={ACCENT} fontSize={12} fontWeight="bold" fontFamily="sans-serif">FINISH</text>

        {cones.map((cx, i) => (
          <Cone key={i} x={cx} y={TRACK_Y + 22} scale={0.9} />
        ))}
        {cones.map((cx, i) => (
          <text key={`l${i}`} x={cx} y={TRACK_Y + 45} textAnchor="middle" fill={FIELD_LINE} fontSize={9} fontFamily="sans-serif" opacity={0.7}>5m</text>
        ))}

        <Player x={playerX} y={TRACK_Y - bounce} color={PLAYER_COLOR} />
      </svg>

      <TimerBadge seconds={elapsedSeconds} opacity={timerOpacity} />

      {finished && (
        <div style={{ position: "absolute", top: 16, left: 16, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 16px" }}>
          <span style={{ color: ACCENT, fontSize: 14, fontWeight: "bold", fontFamily: "sans-serif" }}>✔ Distanță parcursă</span>
        </div>
      )}

      <TitleBar text="⚡ Pro Line Drill — sprint cronometrat" />

      <FinalOverlay
        opacity={finalOpacity}
        mainText="Se cronometrează timpul de execuție"
        subText="pe toată distanța, la viteză maximă"
      />
    </AbsoluteFill>
  );
};
