import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Player, Basketball, Cone, CourtBackground, CounterBadge, TitleBar, FinalOverlay, smoothstep } from "./shared";

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
const SEG_LEN = 32;

const usePathState = (frame: number) => {
  const rel = Math.max(0, frame - START);
  const segIdx = Math.min(waypoints.length - 2, Math.floor(rel / SEG_LEN));
  const segT = smoothstep(Math.min(1, (rel - segIdx * SEG_LEN) / SEG_LEN));
  const a = waypoints[segIdx];
  const b = waypoints[segIdx + 1];
  const x = interpolate(segT, [0, 1], [a.x, b.x]);
  const y = interpolate(segT, [0, 1], [a.y, b.y]);
  const conesPassed = Math.min(cones.length, segIdx + (segT > 0.5 ? 1 : 0));
  const dir = b.x >= a.x ? 1 : -1;
  return { x, y, segIdx, conesPassed, dir };
};

export const CrossoverVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const { x, y, segIdx, conesPassed, dir } = usePathState(frame);

  const ballSide = dir;
  const bounce = Math.abs(Math.sin(frame * 0.8)) * 6;
  const ballX = x + ballSide * 16;
  const ballY = y + 14 - bounce;

  const endFrame = START + (waypoints.length - 1) * SEG_LEN;
  const finalOpacity = interpolate(frame, [endFrame + 10, endFrame + 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#7a4a26" }}>
      <CourtBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        {cones.map((c, i) => (
          <Cone key={i} x={c.x} y={c.y} active={i === segIdx} />
        ))}
        <Player x={x} y={y} facing={ballSide} />
        <Basketball x={ballX} y={ballY} />
      </svg>

      <CounterBadge label="Jaloane:" value={conesPassed} opacity={setupOpacity} />
      <TitleBar text="🏀 Crossover — viteză maximă" />
      <FinalOverlay opacity={finalOpacity} mainText="Cros la viteză maximă" subText="schimbarea direcției (crossover) la fiecare jalon" />
    </AbsoluteFill>
  );
};
