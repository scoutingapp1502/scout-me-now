import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { FIELD_GREEN, ACCENT, PLAYER_COLOR, Player, SoccerBall, FieldBackground, CounterBadge, TitleBar, FinalOverlay, smoothstep } from "./shared";

const PLAYER_X = 320;
const PLAYER_Y = 360;

const contacts = [
  { dx: -10, dy: 8, label: "Stângul" },
  { dx: 10, dy: 8, label: "Dreptul" },
  { dx: -9, dy: -22, label: "Coapsa stângă" },
  { dx: 9, dy: -22, label: "Coapsa dreaptă" },
  { dx: 0, dy: -46, label: "Capul" },
];

const START = 25;
const SEG_LEN = 20;
const REPS = 2;
const sequence = Array.from({ length: contacts.length * REPS + 1 }, (_, i) => contacts[i % contacts.length]);

export const CoordinationVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const rel = Math.max(0, frame - START);
  const segIdx = Math.min(sequence.length - 2, Math.floor(rel / SEG_LEN));
  const segT = smoothstep(Math.min(1, (rel - segIdx * SEG_LEN) / SEG_LEN));
  const a = sequence[segIdx];
  const b = sequence[segIdx + 1];

  const ballX = PLAYER_X + interpolate(segT, [0, 1], [a.dx, b.dx]);
  const arc = Math.sin(segT * Math.PI) * 40;
  const ballY = PLAYER_Y + interpolate(segT, [0, 1], [a.dy, b.dy]) - arc;

  const activeLabel = segT < 0.5 ? a.label : b.label;
  const sequencesDone = Math.floor((segIdx + (segT > 0.5 ? 1 : 0)) / contacts.length);

  const endFrame = START + (sequence.length - 1) * SEG_LEN;
  const finalOpacity = interpolate(frame, [endFrame + 10, endFrame + 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: FIELD_GREEN }}>
      <FieldBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        <Player x={PLAYER_X} y={PLAYER_Y} color={PLAYER_COLOR} />
        <SoccerBall x={ballX} y={ballY} />
      </svg>

      <div style={{ position: "absolute", top: 16, right: 16, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 16px", opacity: setupOpacity }}>
        <span style={{ color: ACCENT, fontSize: 13, fontWeight: "bold", fontFamily: "sans-serif" }}>{activeLabel}</span>
      </div>
      <CounterBadge label="Secvențe:" value={sequencesDone} opacity={setupOpacity} />
      <TitleBar text="⚽ Coordonare — jonglerii" />
      <FinalOverlay opacity={finalOpacity} mainText="Secvență fixă, fără să scape mingea" subText="stângul → dreptul → coapsa stângă → coapsa dreaptă → capul, repetat de câte ori posibil" />
    </AbsoluteFill>
  );
};
