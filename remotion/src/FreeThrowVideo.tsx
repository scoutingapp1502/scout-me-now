import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import {
  ACCENT,
  Player,
  Basketball,
  Hoop,
  HoopViewBackground,
  FreeThrowKey,
  ThreePointLine,
  CourtBoundaryLines,
  TimerBadge,
  CounterBadge,
  TitleBar,
  FinalOverlay,
  project,
  smoothstep,
  FT_LINE_Z,
  RIM_Z,
  RIM_Y,
  PLAYER_PX_PER_M,
} from "./shared";

const RELEASE_Y = 1.75;

const cycleLen = 70;
const actionStart = 40;
const shots = [0, 1, 2].map((i) => actionStart + i * cycleLen);

const getBall3D = (frame: number) => {
  for (const start of shots) {
    const rel = frame - start;
    if (rel < 0) continue;
    if (rel < 25) {
      const t = smoothstep(rel / 25);
      const z = interpolate(t, [0, 1], [FT_LINE_Z, RIM_Z]);
      const y = interpolate(t, [0, 1], [RELEASE_Y, RIM_Y]) + Math.sin(t * Math.PI) * 1.9;
      return { x: 0, y, z, phase: "shot" as const };
    }
    if (rel < 30) return { x: 0, y: RIM_Y - 0.1, z: RIM_Z, phase: "score" as const };
    if (rel < 55) {
      const t = smoothstep((rel - 30) / 25);
      const z = interpolate(t, [0, 1], [RIM_Z, FT_LINE_Z]);
      const bounce = Math.abs(Math.sin(t * Math.PI * 3)) * 0.55 * (1 - t);
      const y = interpolate(t, [0, 1], [RIM_Y - 0.3, RELEASE_Y - 0.6]) + bounce;
      return { x: 0, y, z, phase: "retrieve" as const };
    }
  }
  return { x: 0, y: RELEASE_Y - 0.6, z: FT_LINE_Z, phase: "idle" as const };
};

export const FreeThrowVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const ball3d = getBall3D(frame);
  const ball = project(ball3d);
  const madeCount = shots.filter((s) => frame >= s + 26).length;

  const timerOpacity = interpolate(frame, [30, actionStart], [0, 1], { extrapolateRight: "clamp" });
  const lastShotEnd = shots[shots.length - 1] + cycleLen;
  const progress = Math.min(1, Math.max(0, (frame - actionStart) / (lastShotEnd - actionStart)));
  const secondsLeft = Math.max(0, Math.round(60 * (1 - progress)));

  const shooting = ball3d.phase === "shot";
  const finalOpacity = interpolate(frame, [lastShotEnd + 10, lastShotEnd + 30], [0, 1], { extrapolateRight: "clamp" });

  const player = project({ x: 0, y: 0, z: FT_LINE_Z });
  const ftLabel = project({ x: -3.4, y: 0, z: FT_LINE_Z });

  return (
    <AbsoluteFill style={{ backgroundColor: "#7a4a26" }}>
      <HoopViewBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        <CourtBoundaryLines />
        <ThreePointLine />
        <FreeThrowKey />
        <Hoop />
        <text x={ftLabel.sx} y={ftLabel.sy} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold" fontFamily="sans-serif" opacity={0.85}>
          LINIA DE FAULT
        </text>

        <Player x={player.sx} y={player.sy} scale={player.scale / PLAYER_PX_PER_M} armsUp={shooting} />
        <Basketball x={ball.sx} y={ball.sy} r={Math.max(1.5, 0.12 * ball.scale)} />

        {ball3d.phase === "score" && (
          <text x={ball.sx + 45} y={ball.sy - 10} textAnchor="middle" fill={ACCENT} fontSize={16} fontWeight="bold" fontFamily="sans-serif">
            ✔ COȘ!
          </text>
        )}
      </svg>

      <TimerBadge seconds={secondsLeft} opacity={timerOpacity} />
      <CounterBadge label="Coșuri:" value={madeCount} opacity={timerOpacity} />
      <TitleBar text="🏀 Free Throw Shooting — 60 secunde" />
      <FinalOverlay opacity={finalOpacity} mainText="Se numără coșurile reușite" subText="jucătorul își recuperează singur mingea, timp de 60 de secunde" />
    </AbsoluteFill>
  );
};
