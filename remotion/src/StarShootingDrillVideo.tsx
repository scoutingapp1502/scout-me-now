import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import {
  ACCENT,
  Player,
  Basketball,
  Hoop,
  HoopViewBackground,
  ThreePointLine,
  CourtBoundaryLines,
  CounterBadge,
  TitleBar,
  FinalOverlay,
  project,
  smoothstep,
  RIM_Z,
  RIM_Y,
  PLAYER_PX_PER_M,
} from "./shared";

const RELEASE_Y = 1.75;

// Shooting order: right corner (0°) -> left wing (45° left) -> right wing (45° right) -> left corner (0°) -> center
const spots = [
  { x: 6.0, z: 13.4 },
  { x: -4.6, z: 9.0 },
  { x: 4.6, z: 9.0 },
  { x: -6.0, z: 13.4 },
  { x: 0, z: 7.2 },
];

const actionStart = 20;
const cycleLen = 48;

export const StarShootingDrillVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const idx = Math.min(spots.length - 1, Math.floor(Math.max(0, frame - actionStart) / cycleLen));
  const rel = Math.max(0, frame - actionStart) - idx * cycleLen;
  const prevSpot = idx === 0 ? spots[0] : spots[idx - 1];
  const currSpot = spots[idx];

  const moveT = smoothstep(Math.min(1, rel / 18));
  const worldX = idx === 0 ? currSpot.x : interpolate(moveT, [0, 1], [prevSpot.x, currSpot.x]);
  const worldZ = idx === 0 ? currSpot.z : interpolate(moveT, [0, 1], [prevSpot.z, currSpot.z]);
  const playerP = project({ x: worldX, y: 0, z: worldZ });

  const shootStart = 20;
  const shootEnd = 34;
  const shooting = rel >= shootStart && rel < shootEnd;
  let ball3d = { x: worldX, y: RELEASE_Y, z: worldZ };
  let scored = false;
  if (shooting) {
    const t = smoothstep((rel - shootStart) / (shootEnd - shootStart));
    ball3d = {
      x: interpolate(t, [0, 1], [worldX, 0]),
      y: interpolate(t, [0, 1], [RELEASE_Y, RIM_Y]) + Math.sin(t * Math.PI) * 1.7,
      z: interpolate(t, [0, 1], [worldZ, RIM_Z]),
    };
  } else if (rel >= shootEnd && rel < shootEnd + 6) {
    ball3d = { x: 0, y: RIM_Y - 0.1, z: RIM_Z };
    scored = true;
  }
  const ball = project(ball3d);

  const completedSpots = frame >= actionStart ? Math.min(spots.length, Math.floor((frame - actionStart) / cycleLen) + (rel >= shootEnd + 6 ? 1 : 0)) : 0;
  const shotsCount = Math.min(25, completedSpots * 5);

  const totalEnd = actionStart + spots.length * cycleLen;
  const finalOpacity = interpolate(frame, [totalEnd + 5, totalEnd + 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#7a4a26" }}>
      <HoopViewBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        <CourtBoundaryLines />
        <ThreePointLine />
        {spots.map((sp, i) => {
          const p = project({ x: sp.x, y: 0, z: sp.z });
          return <circle key={i} cx={p.sx} cy={p.sy} r={0.5 * p.scale} fill="none" stroke={i === idx ? ACCENT : "rgba(255,255,255,0.4)"} strokeWidth={i === idx ? 2.5 : 1.5} />;
        })}
        <Hoop />
        <Player x={playerP.sx} y={playerP.sy} scale={playerP.scale / PLAYER_PX_PER_M} armsUp={shooting} />
        <Basketball x={ball.sx} y={ball.sy} r={Math.max(1.5, 0.12 * ball.scale)} />
        {scored && (
          <text x={ball.sx + 45} y={ball.sy - 10} textAnchor="middle" fill={ACCENT} fontSize={16} fontWeight="bold" fontFamily="sans-serif">✔ COȘ!</text>
        )}
      </svg>

      <div style={{ position: "absolute", top: 16, right: 16, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 16px", opacity: setupOpacity }}>
        <span style={{ color: "white", fontSize: 12, fontFamily: "sans-serif" }}>⏱ Fără cronometru</span>
      </div>
      <CounterBadge label="Aruncări:" value={`${shotsCount}/25`} opacity={setupOpacity} />
      <TitleBar text="🎯 Star Shooting Drill" />
      <FinalOverlay opacity={finalOpacity} mainText="25 de aruncări — 5 din fiecare poziție" subText="jucătorul schimbă poziția după fiecare aruncare, fără cronometru" />
    </AbsoluteFill>
  );
};
