import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { FIELD_GREEN, FIELD_LINE, PLAYER_COLOR, ACCENT, Player, FieldBackground, TimerBadge, CounterBadge, TitleBar, FinalOverlay, smoothstep } from "./shared";

const LEFT_X = 120;
const RIGHT_X = 520;
const TRACK_Y = 300;

const legs = [
  { start: 30, end: 90, from: LEFT_X, to: RIGHT_X },
  { start: 90, end: 150, from: RIGHT_X, to: LEFT_X },
  { start: 150, end: 210, from: LEFT_X, to: RIGHT_X },
];

export const ShuttleRunVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const timerOpacity = interpolate(frame, [20, 30], [0, 1], { extrapolateRight: "clamp" });

  let playerX = LEFT_X;
  let bounce = 0;
  for (const leg of legs) {
    if (frame >= leg.start) {
      const t = Math.min(1, (frame - leg.start) / (leg.end - leg.start));
      playerX = interpolate(smoothstep(t), [0, 1], [leg.from, leg.to]);
      if (frame < leg.end) bounce = Math.abs(Math.sin(frame * 0.9)) * 5;
    }
  }

  const legsDone = legs.filter((l) => frame >= l.end).length;
  const runningEnd = legs[legs.length - 1].end;
  const elapsedSeconds = Math.min(Math.max(frame - 30, 0), runningEnd - 30) / fps;
  const finalOpacity = interpolate(frame, [runningEnd + 15, runningEnd + 35], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: FIELD_GREEN }}>
      <FieldBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        <line x1={LEFT_X} y1={TRACK_Y + 20} x2={RIGHT_X} y2={TRACK_Y + 20} stroke={FIELD_LINE} strokeWidth={2} strokeDasharray="6,6" opacity={0.5} />
        <line x1={LEFT_X} y1={TRACK_Y - 40} x2={LEFT_X} y2={TRACK_Y + 30} stroke={ACCENT} strokeWidth={4} />
        <line x1={RIGHT_X} y1={TRACK_Y - 40} x2={RIGHT_X} y2={TRACK_Y + 30} stroke={ACCENT} strokeWidth={4} />
        <text x={LEFT_X} y={TRACK_Y - 46} textAnchor="middle" fill={ACCENT} fontSize={11} fontWeight="bold" fontFamily="sans-serif">LINIE</text>
        <text x={RIGHT_X} y={TRACK_Y - 46} textAnchor="middle" fill={ACCENT} fontSize={11} fontWeight="bold" fontFamily="sans-serif">LINIE</text>
        <text x={(LEFT_X + RIGHT_X) / 2} y={TRACK_Y + 55} textAnchor="middle" fill={FIELD_LINE} fontSize={11} fontFamily="sans-serif" opacity={0.7}>10 metri</text>

        <Player x={playerX} y={TRACK_Y - bounce} color={PLAYER_COLOR} />
      </svg>

      <TimerBadge seconds={elapsedSeconds} opacity={timerOpacity} />
      <CounterBadge label="Curse:" value={legsDone} opacity={timerOpacity} />
      <TitleBar text="💪 Shuttle Run — dus-întors" />
      <FinalOverlay opacity={finalOpacity} mainText="Se cronometrează timpul total" subText="alergare dus-întors la viteză maximă între cele două linii" />
    </AbsoluteFill>
  );
};
