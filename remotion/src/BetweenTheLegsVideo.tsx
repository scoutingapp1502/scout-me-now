import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { ACCENT, Player, Basketball, Cone, CourtBackground, CounterBadge, TitleBar, FinalOverlay, smoothstep } from "./shared";

const waypoints = [
  { x: 320, y: 60 },
  { x: 430, y: 120 },
  { x: 210, y: 190 },
  { x: 430, y: 260 },
  { x: 210, y: 330 },
  { x: 430, y: 400 },
  { x: 210, y: 470 },
];
const cones = waypoints.slice(1);

const START = 25;
const SEG_LEN = 34;

export const BetweenTheLegsVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const rel = Math.max(0, frame - START);
  const segIdx = Math.min(waypoints.length - 2, Math.floor(rel / SEG_LEN));
  const localT = Math.min(1, (rel - segIdx * SEG_LEN) / SEG_LEN);
  const segT = smoothstep(localT);
  const a = waypoints[segIdx];
  const b = waypoints[segIdx + 1];
  const x = interpolate(segT, [0, 1], [a.x, b.x]);
  const y = interpolate(segT, [0, 1], [a.y, b.y]);
  const conesPassed = Math.min(cones.length, segIdx + (segT > 0.5 ? 1 : 0));

  const currDir = b.x >= a.x ? 1 : -1;
  const nextDir = -currDir;
  const transitionStart = 0.65;
  const nearCone = localT > transitionStart;
  const ballOffset = nearCone
    ? interpolate(smoothstep((localT - transitionStart) / (1 - transitionStart)), [0, 1], [currDir * 16, nextDir * 16])
    : currDir * 16;
  const bounce = Math.abs(Math.sin(frame * 0.8)) * 5;
  const ballX = x + ballOffset;
  const ballY = y + 16 - bounce * 0.5;

  const endFrame = START + (waypoints.length - 1) * SEG_LEN;
  const finalOpacity = interpolate(frame, [endFrame + 10, endFrame + 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#7a4a26" }}>
      <CourtBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        {cones.map((c, i) => (
          <Cone key={i} x={c.x} y={c.y} active={i === segIdx} />
        ))}
        {nearCone && (
          <path d={`M${x - 16},${y + 20} Q${x},${y + 32} ${x + 16},${y + 20}`} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="3,3" fill="none" opacity={0.8} />
        )}
        <Player x={x} y={y} crouch={nearCone ? 0.25 : 0} />
        <Basketball x={ballX} y={ballY} />
      </svg>

      <CounterBadge label="Jaloane:" value={conesPassed} opacity={setupOpacity} />
      <TitleBar text="🏀 Between the Legs — viteză maximă" />
      <FinalOverlay opacity={finalOpacity} mainText="Trecerea mingii printre picioare" subText="la viteză maximă, schimbând direcția la fiecare jalon" />
    </AbsoluteFill>
  );
};
