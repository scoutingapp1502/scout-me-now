import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { FIELD_GREEN, FIELD_LINE, PLAYER_COLOR, ACCENT, Player, FieldBackground, CounterBadge, TitleBar, FinalOverlay, smoothstep } from "./shared";

const PLAYER_X = 250;
const BASE_Y = 360;
const POLE_X = 380;
const POLE_TOP = 190;

type Jump = { crouchStart: number; upStart: number; apexStart: number; downStart: number; landEnd: number; apexOffset: number };

const jumps: Jump[] = [
  { crouchStart: 40, upStart: 56, apexStart: 70, downStart: 80, landEnd: 96, apexOffset: 55 },
  { crouchStart: 130, upStart: 146, apexStart: 160, downStart: 170, landEnd: 186, apexOffset: 78 },
];

const getJumpState = (frame: number) => {
  for (const j of jumps) {
    if (frame < j.crouchStart) continue;
    if (frame < j.upStart) {
      const t = (frame - j.crouchStart) / (j.upStart - j.crouchStart);
      return { crouch: smoothstep(t) * 0.6, dy: 0, atApex: false, apexOffset: 0 };
    }
    if (frame < j.apexStart) {
      const t = (frame - j.upStart) / (j.apexStart - j.upStart);
      return { crouch: 0.6 * (1 - t), dy: -j.apexOffset * smoothstep(t), atApex: false, apexOffset: 0 };
    }
    if (frame < j.downStart) {
      return { crouch: 0, dy: -j.apexOffset, atApex: true, apexOffset: j.apexOffset };
    }
    if (frame < j.landEnd) {
      const t = (frame - j.downStart) / (j.landEnd - j.downStart);
      return { crouch: 0.3 * t, dy: -j.apexOffset * (1 - smoothstep(t)), atApex: false, apexOffset: 0 };
    }
  }
  return { crouch: 0, dy: 0, atApex: false, apexOffset: 0 };
};

export const VerticalJumpVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const state = getJumpState(frame);
  const jumpsCompleted = jumps.filter((j) => frame >= j.landEnd).length;
  const currentApex = jumps.slice().reverse().find((j) => frame >= j.apexStart)?.apexOffset ?? 0;

  const finalOpacity = interpolate(frame, [210, 230], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: FIELD_GREEN }}>
      <FieldBackground />
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        <line x1={POLE_X} y1={POLE_TOP} x2={POLE_X} y2={BASE_Y + 15} stroke={FIELD_LINE} strokeWidth={4} />
        {Array.from({ length: 6 }).map((_, i) => {
          const ty = BASE_Y - i * 30;
          return (
            <g key={i}>
              <line x1={POLE_X - 6} y1={ty} x2={POLE_X + 6} y2={ty} stroke={FIELD_LINE} strokeWidth={2} />
              <text x={POLE_X + 12} y={ty + 4} fill={FIELD_LINE} fontSize={10} fontFamily="sans-serif" opacity={0.6}>
                {i * 20}cm
              </text>
            </g>
          );
        })}

        {state.atApex && (
          <g>
            <line x1={PLAYER_X} y1={BASE_Y - 40 - state.apexOffset} x2={POLE_X} y2={BASE_Y - 40 - state.apexOffset} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="5,4" />
            <rect x={(PLAYER_X + POLE_X) / 2 - 26} y={BASE_Y - 56 - state.apexOffset} width={52} height={22} rx={4} fill="rgba(0,0,0,0.75)" />
            <text x={(PLAYER_X + POLE_X) / 2} y={BASE_Y - 41 - state.apexOffset} textAnchor="middle" fill={ACCENT} fontSize={12} fontWeight="bold" fontFamily="sans-serif">
              {Math.round(state.apexOffset * 0.9)}cm
            </text>
          </g>
        )}

        <Player x={PLAYER_X} y={BASE_Y + state.dy} color={PLAYER_COLOR} crouch={state.crouch} armsUp={state.dy < -10} />
      </svg>

      <CounterBadge label="Sărituri:" value={jumpsCompleted} opacity={setupOpacity} />
      <TitleBar text="🦘 2 Foots Vertical Jump" />
      <FinalOverlay opacity={finalOpacity} mainText="Se măsoară înălțimea săriturii" subText="sărituri din poziție statică, pe ambele picioare" />
    </AbsoluteFill>
  );
};
