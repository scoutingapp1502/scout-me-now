import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";

const FIELD_GREEN = "#2d5a27";
const FIELD_LINE = "#ffffff";
const WALL_COLOR = "#8B7355";
const PLAYER_COLOR = "#1a73e8";
const BALL_COLOR = "#ffffff";
const ACCENT = "#FFD700";

const Player = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`}>
    {/* Body */}
    <circle cx={0} cy={-20} r={12} fill={PLAYER_COLOR} stroke="#0d47a1" strokeWidth={2} />
    {/* Head */}
    <circle cx={0} cy={-38} r={9} fill="#FFCC80" stroke="#E0A050" strokeWidth={1.5} />
    {/* Legs */}
    <line x1={-5} y1={-8} x2={-8} y2={10} stroke={PLAYER_COLOR} strokeWidth={4} strokeLinecap="round" />
    <line x1={5} y1={-8} x2={8} y2={10} stroke={PLAYER_COLOR} strokeWidth={4} strokeLinecap="round" />
    {/* Feet */}
    <ellipse cx={-10} cy={12} rx={6} ry={3} fill="#333" />
    <ellipse cx={10} cy={12} rx={6} ry={3} fill="#333" />
  </g>
);

const Wall = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} fill={WALL_COLOR} stroke="#6d5a3a" strokeWidth={2} rx={3} />
    {/* Brick pattern */}
    {Array.from({ length: Math.floor(h / 15) }).map((_, row) => (
      <g key={row}>
        <line x1={x} y1={y + row * 15} x2={x + w} y2={y + row * 15} stroke="#7a6545" strokeWidth={0.5} />
        {Array.from({ length: Math.floor(w / 25) }).map((_, col) => (
          <line
            key={col}
            x1={x + col * 25 + (row % 2 === 0 ? 0 : 12)}
            y1={y + row * 15}
            x2={x + col * 25 + (row % 2 === 0 ? 0 : 12)}
            y2={y + (row + 1) * 15}
            stroke="#7a6545"
            strokeWidth={0.5}
          />
        ))}
      </g>
    ))}
  </g>
);

export const ControlPassVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Animation phases:
  // 0-60: Setup scene appears with labels
  // 60-90: Ball goes to wall (pass)
  // 90-120: Ball comes back (control)
  // 120-150: Ball goes to wall again (pass 2)
  // 150-180: Ball comes back again (control 2)
  // 180-210: Ball goes to wall (pass 3)
  // 210-240: Ball comes back (control 3)
  // 240-300: Timer + score display

  const playerX = 320;
  const playerY = 340;
  const wallX = 200;
  const wallY = 80;
  const wallW = 240;
  const wallH = 40;
  const wallCenterX = wallX + wallW / 2;
  const wallBottomY = wallY + wallH;

  // Ball cycle: each pass-return cycle is 60 frames
  const cycleStart = 60;
  const cycleDuration = 60;

  const getBallPosition = (f: number) => {
    if (f < cycleStart) return { x: playerX + 15, y: playerY + 10, visible: true };

    const cycleFrame = (f - cycleStart) % cycleDuration;
    const cycleNum = Math.floor((f - cycleStart) / cycleDuration);

    if (cycleNum >= 3) return { x: playerX + 15, y: playerY + 10, visible: true };

    if (cycleFrame < 30) {
      // Going to wall
      const t = cycleFrame / 30;
      const eased = t * t * (3 - 2 * t); // smoothstep
      return {
        x: interpolate(eased, [0, 1], [playerX + 15, wallCenterX]),
        y: interpolate(eased, [0, 1], [playerY + 10, wallBottomY + 10]),
        visible: true,
      };
    } else {
      // Coming back
      const t = (cycleFrame - 30) / 30;
      const eased = t * t * (3 - 2 * t);
      return {
        x: interpolate(eased, [0, 1], [wallCenterX, playerX - 15]),
        y: interpolate(eased, [0, 1], [wallBottomY + 10, playerY + 10]),
        visible: true,
      };
    }
  };

  const ball = getBallPosition(frame);

  // Fade in setup
  const setupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Distance label
  const labelOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });

  // Timer
  const timerStart = 60;
  const timerOpacity = interpolate(frame, [50, 60], [0, 1], { extrapolateRight: "clamp" });
  const elapsedSeconds = Math.min(60, Math.floor(((frame - timerStart) / (durationInFrames - timerStart)) * 60));

  // Rep counter
  const currentCycle = frame >= cycleStart ? Math.min(3, Math.floor((frame - cycleStart) / cycleDuration) + 1) : 0;
  const passPhase = frame >= cycleStart ? ((frame - cycleStart) % cycleDuration) < 30 : false;

  // Action labels
  const showPassLabel = frame >= cycleStart && frame < 240 && passPhase;
  const showControlLabel = frame >= cycleStart && frame < 240 && !passPhase && ((frame - cycleStart) % cycleDuration) >= 30;

  // Final score
  const finalOpacity = interpolate(frame, [250, 270], [0, 1], { extrapolateRight: "clamp" });

  // Kick animation (player leg)
  const isKicking = frame >= cycleStart && frame < 240 && passPhase && ((frame - cycleStart) % cycleDuration) < 8;

  return (
    <AbsoluteFill style={{ backgroundColor: FIELD_GREEN }}>
      {/* Field lines */}
      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0 }}>
        {/* Grass texture lines */}
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x={0} y={i * 60} width={640} height={30} fill="rgba(255,255,255,0.03)" />
        ))}
      </svg>

      <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0, opacity: setupOpacity }}>
        {/* Wall */}
        <Wall x={wallX} y={wallY} w={wallW} h={wallH} />
        <text x={wallCenterX} y={wallY - 10} textAnchor="middle" fill={FIELD_LINE} fontSize={14} fontWeight="bold" fontFamily="sans-serif">
          PERETE
        </text>

        {/* Distance marker */}
        <g opacity={labelOpacity}>
          <line x1={wallCenterX} y1={wallBottomY + 5} x2={wallCenterX} y2={playerY - 55} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="6,4" />
          <polygon points={`${wallCenterX - 5},${wallBottomY + 10} ${wallCenterX + 5},${wallBottomY + 10} ${wallCenterX},${wallBottomY + 3}`} fill={ACCENT} />
          <polygon points={`${wallCenterX - 5},${playerY - 58} ${wallCenterX + 5},${playerY - 58} ${wallCenterX},${playerY - 52}`} fill={ACCENT} />

          <rect x={wallCenterX - 28} y={(wallBottomY + playerY - 55) / 2 - 12} width={56} height={24} rx={4} fill="rgba(0,0,0,0.7)" />
          <text x={wallCenterX} y={(wallBottomY + playerY - 55) / 2 + 5} textAnchor="middle" fill={ACCENT} fontSize={14} fontWeight="bold" fontFamily="sans-serif">
            5m
          </text>
        </g>

        {/* Player */}
        <Player x={playerX} y={playerY} />

        {/* Kick leg animation */}
        {isKicking && (
          <line x1={playerX + 5} y1={playerY - 8} x2={playerX + 18} y2={playerY - 2} stroke={PLAYER_COLOR} strokeWidth={4} strokeLinecap="round" />
        )}

        {/* Ball */}
        {ball.visible && (
          <g>
            <circle cx={ball.x} cy={ball.y} r={8} fill={BALL_COLOR} stroke="#ccc" strokeWidth={1.5} />
            {/* Ball pattern */}
            <path d={`M${ball.x - 3},${ball.y - 3} L${ball.x + 3},${ball.y + 3} M${ball.x + 3},${ball.y - 3} L${ball.x - 3},${ball.y + 3}`} stroke="#999" strokeWidth={0.8} />
          </g>
        )}

        {/* Ball trail */}
        {frame >= cycleStart && frame < 240 && (
          <g opacity={0.3}>
            <line
              x1={playerX + 15} y1={playerY + 10}
              x2={wallCenterX} y2={wallBottomY + 10}
              stroke={ACCENT} strokeWidth={1} strokeDasharray="4,4"
            />
          </g>
        )}

        {/* Action labels */}
        {showPassLabel && (
          <g>
            <rect x={430} y={200} width={100} height={30} rx={6} fill="rgba(26,115,232,0.9)" />
            <text x={480} y={220} textAnchor="middle" fill="white" fontSize={13} fontWeight="bold" fontFamily="sans-serif">
              PASĂ ➜
            </text>
          </g>
        )}
        {showControlLabel && (
          <g>
            <rect x={430} y={200} width={120} height={30} rx={6} fill="rgba(76,175,80,0.9)" />
            <text x={490} y={220} textAnchor="middle" fill="white" fontSize={13} fontWeight="bold" fontFamily="sans-serif">
              ⬅ CONTROL
            </text>
          </g>
        )}
      </svg>

      {/* Timer */}
      <div style={{
        position: "absolute", top: 16, right: 16,
        backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 16px",
        opacity: timerOpacity,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ color: ACCENT, fontSize: 14, fontWeight: "bold", fontFamily: "sans-serif" }}>⏱</span>
        <span style={{ color: "white", fontSize: 20, fontWeight: "bold", fontFamily: "monospace" }}>
          {String(Math.floor(elapsedSeconds / 60)).padStart(1, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}
        </span>
      </div>

      {/* Rep counter */}
      {frame >= cycleStart && (
        <div style={{
          position: "absolute", top: 16, left: 16,
          backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "8px 16px",
        }}>
          <span style={{ color: "white", fontSize: 14, fontFamily: "sans-serif" }}>Repetări: </span>
          <span style={{ color: ACCENT, fontSize: 20, fontWeight: "bold", fontFamily: "sans-serif" }}>
            {Math.min(currentCycle, 3)}
          </span>
        </div>
      )}

      {/* Title */}
      <div style={{
        position: "absolute", bottom: 16, left: 0, right: 0,
        display: "flex", justifyContent: "center",
      }}>
        <div style={{
          backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 8, padding: "8px 24px",
        }}>
          <span style={{ color: "white", fontSize: 16, fontWeight: "bold", fontFamily: "sans-serif" }}>
            ⚽ Control și Pasă — 60 secunde
          </span>
        </div>
      </div>

      {/* Final overlay */}
      {frame >= 250 && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundColor: `rgba(0,0,0,${0.6 * (finalOpacity)})`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 12,
        }}>
          <div style={{
            backgroundColor: "rgba(0,0,0,0.85)", borderRadius: 12, padding: "24px 48px",
            textAlign: "center", opacity: finalOpacity,
          }}>
            <div style={{ color: ACCENT, fontSize: 24, fontWeight: "bold", fontFamily: "sans-serif", marginBottom: 8 }}>
              Se numără repetările corecte
            </div>
            <div style={{ color: "white", fontSize: 16, fontFamily: "sans-serif" }}>
              în 60 de secunde
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
