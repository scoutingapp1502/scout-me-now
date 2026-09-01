import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { ACCENT, Player, Basketball, Cone, CourtBackground, CounterBadge, TitleBar, FinalOverlay, smoothstep } from "./shared";

const COL_X = 320;
const CONE_Y = [100, 190, 280, 370, 460];
const START = 25;
const END = 265;
const CYCLE = 24;

export const BetweenLegsCrossVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const t = smoothstep(interpolate(frame, [START, END], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const y = interpolate(t, [0, 1], [40, 520]);

  const activeConeIdx = CONE_Y.findIndex((cy) => Math.abs(cy - y) < 35);
  const phase = frame >= START ? (frame - START) % CYCLE : 0;
  const throughLegs = phase < CYCLE / 2;
  const localT = throughLegs ? phase / (CYCLE / 2) : (phase - CYCLE / 2) / (CYCLE / 2);
  const ballX = throughLegs ? interpolate(localT, [0, 1], [COL_X - 15, COL_X + 15]) : interpolate(localT, [0, 1], [COL_X + 15, COL_X - 15]);
  const ballY = y + 14 + (throughLegs ? Math.sin(localT * Math.PI) * 6 : 0);

  const conesPassed = CONE_Y.filter((cy) => y > cy + 20).length;
  const finalOpacity = interpolate(frame, [END + 10, END + 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#7a4a26" }}>
      <CourtBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        <line x1={COL_X} y1={30} x2={COL_X} y2={470} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeDasharray="5,5" />
        {CONE_Y.map((cy, i) => (
          <Cone key={i} x={COL_X} y={cy} active={i === activeConeIdx} />
        ))}
        {throughLegs && (
          <path d={`M${COL_X - 15},${y + 18} Q${COL_X},${y + 30} ${COL_X + 15},${y + 18}`} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="3,3" fill="none" opacity={0.8} />
        )}
        <Player x={COL_X} y={y} crouch={throughLegs ? 0.2 : 0} />
        <Basketball x={ballX} y={ballY} />
      </svg>

      <CounterBadge label="Jaloane:" value={conesPassed} opacity={setupOpacity} />
      <TitleBar text="🏀 Between the Legs Cross" />
      <FinalOverlay opacity={finalOpacity} mainText="Printre picioare + cros la fiecare jalon" subText="combinație: trecerea mingii printre picioare, apoi cros, la fiecare jalon" />
    </AbsoluteFill>
  );
};
