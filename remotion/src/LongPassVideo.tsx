import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { FIELD_GREEN, ACCENT, PLAYER_COLOR, Player, SoccerBall, FieldBackground, CounterBadge, TitleBar, FinalOverlay, smoothstep } from "./shared";

const PLAYER_X = 90;
const PLAYER_Y = 400;
const TARGET_X = 520;
const TARGET_Y = 110;
const TARGET_R = 26;

const landings = [
  { dx: 0, dy: 0, hit: true },
  { dx: -34, dy: 12, hit: false },
  { dx: 6, dy: -6, hit: true },
  { dx: -12, dy: 28, hit: false },
  { dx: 8, dy: 6, hit: true },
];

const START = 30;
const CYCLE = 48;

export const LongPassVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const attemptIdx = Math.min(landings.length - 1, Math.max(0, Math.floor((frame - START) / CYCLE)));
  const rel = Math.max(0, frame - START) - attemptIdx * CYCLE;
  const landing = landings[attemptIdx];
  const landX = TARGET_X + landing.dx;
  const landY = TARGET_Y + landing.dy;
  const foot = attemptIdx % 2 === 0 ? "Piciorul drept" : "Piciorul stâng";

  const kicking = rel >= 6 && rel < 10;
  const flying = rel >= 10 && rel < 32;
  let ballX = PLAYER_X;
  let ballY = PLAYER_Y - 10;
  let shadowScale = 0;
  let showResult = false;
  if (flying) {
    const t = smoothstep((rel - 10) / 22);
    ballX = interpolate(t, [0, 1], [PLAYER_X, landX]);
    const arc = Math.sin(t * Math.PI) * 90;
    ballY = interpolate(t, [0, 1], [PLAYER_Y - 10, landY]) - arc;
    shadowScale = 0.5 + 0.5 * (1 - Math.sin(t * Math.PI));
  } else if (rel >= 32 && rel < 40) {
    ballX = landX;
    ballY = landY;
    shadowScale = 1;
    showResult = true;
  }

  const attemptsDone = Math.min(5, Math.floor((frame - START) / CYCLE) + (rel >= 32 ? 1 : 0));
  const hitsDone = landings.slice(0, Math.min(5, Math.floor((frame - START) / CYCLE) + (rel >= 40 ? 1 : 0))).filter((l) => l.hit).length;

  const endFrame = START + landings.length * CYCLE;
  const finalOpacity = interpolate(frame, [endFrame + 5, endFrame + 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: FIELD_GREEN }}>
      <FieldBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        <circle cx={TARGET_X} cy={TARGET_Y} r={TARGET_R} fill="rgba(255,215,0,0.12)" stroke={ACCENT} strokeWidth={2} strokeDasharray="6,4" />
        <text x={TARGET_X} y={TARGET_Y - TARGET_R - 10} textAnchor="middle" fill={ACCENT} fontSize={11} fontWeight="bold" fontFamily="sans-serif">CERC 3m</text>
        <line x1={PLAYER_X + 20} y1={PLAYER_Y} x2={TARGET_X - 10} y2={TARGET_Y + 5} stroke="white" strokeWidth={1} strokeDasharray="4,6" opacity={0.2} />
        <text x={(PLAYER_X + TARGET_X) / 2} y={260} textAnchor="middle" fill="white" fontSize={11} fontFamily="sans-serif" opacity={0.6}>30 metri</text>

        <Player x={PLAYER_X} y={PLAYER_Y} color={PLAYER_COLOR} />
        {kicking && <line x1={PLAYER_X + 5} y1={PLAYER_Y - 8} x2={PLAYER_X + 18} y2={PLAYER_Y - 2} stroke={PLAYER_COLOR} strokeWidth={4} strokeLinecap="round" />}

        {shadowScale > 0 && <ellipse cx={landX} cy={landY + 6} rx={8 * shadowScale} ry={3 * shadowScale} fill="rgba(0,0,0,0.35)" />}
        <SoccerBall x={ballX} y={ballY} />
        {showResult && (
          <text x={landX} y={landY - 16} textAnchor="middle" fill={landing.hit ? ACCENT : "#ff6b6b"} fontSize={14} fontWeight="bold" fontFamily="sans-serif">
            {landing.hit ? "✔" : "✘"}
          </text>
        )}
      </svg>

      <div style={{ position: "absolute", top: 16, right: 16, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 16px", opacity: setupOpacity }}>
        <span style={{ color: "white", fontSize: 12, fontFamily: "sans-serif" }}>{foot}</span>
      </div>
      <CounterBadge label="Încercări:" value={`${attemptsDone}/5 (${hitsDone} în cerc)`} opacity={setupOpacity} />
      <TitleBar text="⚽ Pasă Lungă la Punct Fix" />
      <FinalOverlay opacity={finalOpacity} mainText="5 încercări pe fiecare picior" subText="mingea trebuie să aterizeze prin aer în interiorul cercului, de la 30 de metri" />
    </AbsoluteFill>
  );
};
