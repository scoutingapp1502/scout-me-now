import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { FIELD_GREEN, ACCENT, PLAYER_COLOR, Player, SoccerBall, Goal, FieldBackground, CounterBadge, TitleBar, FinalOverlay, smoothstep } from "./shared";

const GOAL_X = 190;
const GOAL_Y = 60;
const GOAL_W = 260;
const GOAL_H = 130;
const PLAYER_X = 320;
const PLAYER_Y = 390;

const corners = ["tl", "tr", "bl", "br"] as const;
const cornerPoint: Record<(typeof corners)[number], { x: number; y: number }> = {
  tl: { x: GOAL_X + 14, y: GOAL_Y + 14 },
  tr: { x: GOAL_X + GOAL_W - 14, y: GOAL_Y + 14 },
  bl: { x: GOAL_X + 14, y: GOAL_Y + GOAL_H - 14 },
  br: { x: GOAL_X + GOAL_W - 14, y: GOAL_Y + GOAL_H - 14 },
};

const START = 30;
const CYCLE = 55;

export const PrecisionVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const idx = Math.max(0, Math.floor((frame - START) / CYCLE));
  const shotIdx = Math.min(corners.length - 1, idx);
  const rel = Math.max(0, frame - START) - shotIdx * CYCLE;
  const target = cornerPoint[corners[shotIdx]];
  const foot = shotIdx % 2 === 0 ? "Piciorul drept" : "Piciorul stâng";

  const kicking = rel >= 10 && rel < 14;
  const flying = rel >= 14 && rel < 34;
  let ballX = PLAYER_X;
  let ballY = PLAYER_Y - 10;
  let justHit = false;
  if (flying) {
    const t = smoothstep((rel - 14) / 20);
    ballX = interpolate(t, [0, 1], [PLAYER_X, target.x]);
    ballY = interpolate(t, [0, 1], [PLAYER_Y - 10, target.y]);
  } else if (rel >= 34 && rel < 40) {
    ballX = target.x;
    ballY = target.y;
    justHit = true;
  }

  const litCorner = frame >= START + shotIdx * CYCLE + 34 && frame < START + (shotIdx + 1) * CYCLE ? corners[shotIdx] : null;
  const hitsCount = Math.min(4, Math.floor((frame - START + CYCLE - 40) / CYCLE) + (frame >= START ? 1 : 0));
  const shownHits = Math.max(0, Math.min(4, hitsCount));

  const endFrame = START + corners.length * CYCLE;
  const finalOpacity = interpolate(frame, [endFrame + 5, endFrame + 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: FIELD_GREEN }}>
      <FieldBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        <Goal x={GOAL_X} y={GOAL_Y} w={GOAL_W} h={GOAL_H} litCorner={litCorner} />
        <line x1={PLAYER_X - 90} y1={PLAYER_Y + 18} x2={PLAYER_X + 90} y2={PLAYER_Y + 18} stroke="white" strokeWidth={2} strokeDasharray="6,6" opacity={0.4} />
        <text x={PLAYER_X} y={PLAYER_Y + 40} textAnchor="middle" fill="white" fontSize={11} fontFamily="sans-serif" opacity={0.7}>16 metri</text>

        <Player x={PLAYER_X} y={PLAYER_Y} color={PLAYER_COLOR} />
        {kicking && <line x1={PLAYER_X + 5} y1={PLAYER_Y - 8} x2={PLAYER_X + 18} y2={PLAYER_Y - 2} stroke={PLAYER_COLOR} strokeWidth={4} strokeLinecap="round" />}
        <SoccerBall x={ballX} y={ballY} />
        {justHit && (
          <text x={target.x} y={target.y - 18} textAnchor="middle" fill={ACCENT} fontSize={14} fontWeight="bold" fontFamily="sans-serif">✔</text>
        )}
      </svg>

      <div style={{ position: "absolute", top: 16, right: 16, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 16px", opacity: setupOpacity }}>
        <span style={{ color: "white", fontSize: 12, fontFamily: "sans-serif" }}>{foot}</span>
      </div>
      <CounterBadge label="Lovituri:" value={`${shownHits}/10`} opacity={setupOpacity} />
      <TitleBar text="⚽ Precizie — colțurile porții" />
      <FinalOverlay opacity={finalOpacity} mainText="5 șuturi cu fiecare picior" subText="jucătorul țintește colțurile porții de la 16 metri" />
    </AbsoluteFill>
  );
};
