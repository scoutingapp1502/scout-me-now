import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { FIELD_GREEN, PLAYER_COLOR, Player, SoccerBall, Cone, FieldBackground, CounterBadge, TitleBar, FinalOverlay, smoothstep } from "./shared";

const conePositions = [100, 150, 200, 250, 300, 350].map((y) => ({ x: 320, y }));

const waypoints = [
  { x: 320, y: 60 },
  { x: 280, y: 100 },
  { x: 360, y: 150 },
  { x: 280, y: 200 },
  { x: 360, y: 250 },
  { x: 280, y: 300 },
  { x: 360, y: 350 },
  { x: 320, y: 390 },
  { x: 360, y: 350 },
  { x: 280, y: 300 },
  { x: 360, y: 250 },
  { x: 280, y: 200 },
  { x: 360, y: 150 },
  { x: 280, y: 100 },
  { x: 320, y: 60 },
];

const START = 25;
const SEG_LEN = 15;

export const SlalomVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const rel = Math.max(0, frame - START);
  const segIdx = Math.min(waypoints.length - 2, Math.floor(rel / SEG_LEN));
  const segT = smoothstep(Math.min(1, (rel - segIdx * SEG_LEN) / SEG_LEN));
  const a = waypoints[segIdx];
  const b = waypoints[segIdx + 1];
  const x = interpolate(segT, [0, 1], [a.x, b.x]);
  const y = interpolate(segT, [0, 1], [a.y, b.y]);

  const facing = b.x >= a.x ? 1 : -1;
  const ballSide = facing;
  const bounce = Math.abs(Math.sin(frame * 1.1)) * 3;
  const ballX = x + ballSide * 12;
  const ballY = y + 14 - bounce;

  const passesDone = Math.min(waypoints.length - 1, segIdx + (segT > 0.5 ? 1 : 0));
  const endFrame = START + (waypoints.length - 1) * SEG_LEN;
  const finalOpacity = interpolate(frame, [endFrame + 10, endFrame + 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: FIELD_GREEN }}>
      <FieldBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        {conePositions.map((c, i) => (
          <Cone key={i} x={c.x} y={c.y} />
        ))}
        {conePositions.map((c, i) => (
          <text key={`l${i}`} x={c.x + 26} y={c.y + 4} fill="white" fontSize={9} fontFamily="sans-serif" opacity={0.55}>1m</text>
        ))}
        <Player x={x} y={y} color={PLAYER_COLOR} facing={facing} />
        <SoccerBall x={ballX} y={ballY} />
      </svg>

      <CounterBadge label="Treceri:" value={`${passesDone}/${waypoints.length - 1}`} opacity={setupOpacity} />
      <TitleBar text="⚽ Slalom printre Jaloane" />
      <FinalOverlay opacity={finalOpacity} mainText="Slalom dus-întors, cât mai rapid" subText="mingea rămâne sub control tot timpul — variante: piciorul drept, stâng sau liber" />
    </AbsoluteFill>
  );
};
