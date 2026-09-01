import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { FIELD_GREEN, FIELD_LINE, PLAYER_COLOR, ACCENT, Player, FieldBackground, CounterBadge, TitleBar, FinalOverlay, smoothstep } from "./shared";

const RUN_FROM_X = 130;
const JUMP_X = 260;
const POLE_X = 380;
const BASE_Y = 360;

const RUN_START = 30;
const RUN_END = 72;
const CROUCH_END = 86;
const UP_END = 100;
const APEX_END = 110;
const DOWN_END = 126;
const APEX_OFFSET = 70;

export const VerticalJumpActionVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  let playerX = RUN_FROM_X;
  let dy = 0;
  let crouch = 0;
  let atApex = false;
  let bounce = 0;

  if (frame >= RUN_START && frame < RUN_END) {
    const t = smoothstep((frame - RUN_START) / (RUN_END - RUN_START));
    playerX = interpolate(t, [0, 1], [RUN_FROM_X, JUMP_X]);
    bounce = Math.abs(Math.sin(frame * 1.1)) * 5;
  } else if (frame >= RUN_END) {
    playerX = JUMP_X;
  }

  if (frame >= RUN_END && frame < CROUCH_END) {
    const t = (frame - RUN_END) / (CROUCH_END - RUN_END);
    crouch = smoothstep(t) * 0.6;
  } else if (frame >= CROUCH_END && frame < UP_END) {
    const t = (frame - CROUCH_END) / (UP_END - CROUCH_END);
    crouch = 0.6 * (1 - t);
    dy = -APEX_OFFSET * smoothstep(t);
  } else if (frame >= UP_END && frame < APEX_END) {
    dy = -APEX_OFFSET;
    atApex = true;
  } else if (frame >= APEX_END && frame < DOWN_END) {
    const t = (frame - APEX_END) / (DOWN_END - APEX_END);
    dy = -APEX_OFFSET * (1 - smoothstep(t));
    crouch = 0.3 * t;
  }

  const finalOpacity = interpolate(frame, [190, 210], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: FIELD_GREEN }}>
      <FieldBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        <line x1={RUN_FROM_X} y1={BASE_Y + 20} x2={POLE_X} y2={BASE_Y + 20} stroke={FIELD_LINE} strokeWidth={2} strokeDasharray="6,6" opacity={0.4} />
        <line x1={POLE_X} y1={200} x2={POLE_X} y2={BASE_Y + 15} stroke={FIELD_LINE} strokeWidth={4} />
        {Array.from({ length: 5 }).map((_, i) => {
          const ty = BASE_Y - i * 30;
          return (
            <g key={i}>
              <line x1={POLE_X - 6} y1={ty} x2={POLE_X + 6} y2={ty} stroke={FIELD_LINE} strokeWidth={2} />
              <text x={POLE_X + 12} y={ty + 4} fill={FIELD_LINE} fontSize={10} fontFamily="sans-serif" opacity={0.6}>{i * 20}cm</text>
            </g>
          );
        })}
        <text x={(RUN_FROM_X + JUMP_X) / 2} y={BASE_Y + 40} textAnchor="middle" fill={FIELD_LINE} fontSize={11} fontFamily="sans-serif" opacity={0.7}>elan 3-5m</text>

        {atApex && (
          <g>
            <line x1={JUMP_X} y1={BASE_Y - 40 - APEX_OFFSET} x2={POLE_X} y2={BASE_Y - 40 - APEX_OFFSET} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="5,4" />
            <rect x={(JUMP_X + POLE_X) / 2 - 26} y={BASE_Y - 56 - APEX_OFFSET} width={52} height={22} rx={4} fill="rgba(0,0,0,0.75)" />
            <text x={(JUMP_X + POLE_X) / 2} y={BASE_Y - 41 - APEX_OFFSET} textAnchor="middle" fill={ACCENT} fontSize={12} fontWeight="bold" fontFamily="sans-serif">
              {Math.round(APEX_OFFSET * 0.9)}cm
            </text>
          </g>
        )}

        <Player x={playerX} y={BASE_Y + dy - bounce} color={PLAYER_COLOR} crouch={crouch} armsUp={dy < -10} />
      </svg>

      <CounterBadge label="Reper:" value={frame >= UP_END ? "săritură din elan" : "elan"} opacity={setupOpacity} />
      <TitleBar text="🚀 Vertical Jump in Action" />
      <FinalOverlay opacity={finalOpacity} mainText="Se măsoară înălțimea din mișcare" subText="cursă scurtă de elan (3-5m), apoi săritură pe verticală cu ambele picioare" />
    </AbsoluteFill>
  );
};
