import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Player, Basketball, Cone, CourtBackground, CounterBadge, TitleBar, FinalOverlay, smoothstep } from "./shared";

const COL_X = 320;
const CONE_Y = [100, 190, 280, 370, 460];
const START = 25;
const END = 235;

export const DoubleCrossVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const t = smoothstep(interpolate(frame, [START, END], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const y = interpolate(t, [0, 1], [40, 520]);

  const WINDOW = 18;
  const activeConeIdx = CONE_Y.findIndex((cy) => Math.abs(cy - y) < WINDOW);
  let ballOffset = 16;
  if (activeConeIdx !== -1) {
    const coneY = CONE_Y[activeConeIdx];
    const u = interpolate(y, [coneY - WINDOW, coneY + WINDOW], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    ballOffset = 16 * Math.cos(2 * Math.PI * u);
  }
  const ballX = COL_X + ballOffset;
  const ballY = y + 14;

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
        {CONE_Y.map((cy, i) => (
          <text key={`l${i}`} x={COL_X + 30} y={cy + 4} fill="white" fontSize={9} fontFamily="sans-serif" opacity={0.6}>3m</text>
        ))}
        <Player x={COL_X} y={y} />
        <Basketball x={ballX} y={ballY} />
      </svg>

      <CounterBadge label="Jaloane:" value={conesPassed} opacity={setupOpacity} />
      <TitleBar text="🏀 Double Cross" />
      <FinalOverlay opacity={finalOpacity} mainText="Dublu cros în fața jalonului" subText="dribling înainte cu mâna dreaptă între jaloane, dublu cros de fiecare dată când ajunge în dreptul jalonului" />
    </AbsoluteFill>
  );
};
