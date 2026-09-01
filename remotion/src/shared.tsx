import React from "react";

export const FIELD_GREEN = "#2d5a27";
export const FIELD_LINE = "#ffffff";
export const WALL_COLOR = "#8B7355";
export const PLAYER_COLOR = "#1a73e8";
export const PLAYER_COLOR_2 = "#e64a19";
export const BALL_COLOR = "#ffffff";
export const BASKETBALL_COLOR = "#e07b39";
export const ACCENT = "#FFD700";
export const CONE_COLOR = "#ff7a1a";
export const COURT_COLOR = "#c8874a";
export const COURT_LINE = "#f5deb3";
export const HOOP_COLOR = "#ff5722";

export const Player = ({
  x,
  y,
  scale = 1,
  color = PLAYER_COLOR,
  armsUp = false,
  crouch = 0,
  facing = 1,
}: {
  x: number;
  y: number;
  scale?: number;
  color?: string;
  armsUp?: boolean;
  crouch?: number;
  facing?: number;
}) => (
  <g transform={`translate(${x}, ${y}) scale(${scale * facing}, ${scale})`}>
    <circle cx={0} cy={-20 + crouch * 8} r={12} fill={color} stroke="#00000055" strokeWidth={2} />
    <circle cx={0} cy={-38 + crouch * 8} r={9} fill="#FFCC80" stroke="#E0A050" strokeWidth={1.5} />
    {armsUp ? (
      <>
        <line x1={-4} y1={-26} x2={-14} y2={-46} stroke={color} strokeWidth={4} strokeLinecap="round" />
        <line x1={4} y1={-26} x2={14} y2={-46} stroke={color} strokeWidth={4} strokeLinecap="round" />
      </>
    ) : (
      <>
        <line x1={-8} y1={-22} x2={-13} y2={-8} stroke={color} strokeWidth={4} strokeLinecap="round" />
        <line x1={8} y1={-22} x2={13} y2={-8} stroke={color} strokeWidth={4} strokeLinecap="round" />
      </>
    )}
    <line x1={-5} y1={-8 + crouch * 8} x2={-8} y2={10 + crouch * 4} stroke={color} strokeWidth={4} strokeLinecap="round" />
    <line x1={5} y1={-8 + crouch * 8} x2={8} y2={10 + crouch * 4} stroke={color} strokeWidth={4} strokeLinecap="round" />
    <ellipse cx={-10} cy={12 + crouch * 4} rx={6} ry={3} fill="#333" />
    <ellipse cx={10} cy={12 + crouch * 4} rx={6} ry={3} fill="#333" />
  </g>
);

export const SoccerBall = ({ x, y, r = 8 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={BALL_COLOR} stroke="#ccc" strokeWidth={1.5} />
    <path
      d={`M${x - r / 2.5},${y - r / 2.5} L${x + r / 2.5},${y + r / 2.5} M${x + r / 2.5},${y - r / 2.5} L${x - r / 2.5},${y + r / 2.5}`}
      stroke="#999"
      strokeWidth={0.8}
    />
  </g>
);

export const Basketball = ({ x, y, r = 8 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={BASKETBALL_COLOR} stroke="#8a4a1e" strokeWidth={1.2} />
    <line x1={x - r} y1={y} x2={x + r} y2={y} stroke="#8a4a1e" strokeWidth={0.8} />
    <line x1={x} y1={y - r} x2={x} y2={y + r} stroke="#8a4a1e" strokeWidth={0.8} />
    <path d={`M${x - r},${y} Q${x},${y - r * 0.6} ${x + r},${y}`} stroke="#8a4a1e" strokeWidth={0.8} fill="none" />
    <path d={`M${x - r},${y} Q${x},${y + r * 0.6} ${x + r},${y}`} stroke="#8a4a1e" strokeWidth={0.8} fill="none" />
  </g>
);

export const Cone = ({ x, y, scale = 1, active = false }: { x: number; y: number; scale?: number; active?: boolean }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`}>
    {active && <circle cx={0} cy={-2} r={13} fill="none" stroke={ACCENT} strokeWidth={1.5} opacity={0.8} />}
    <polygon points="-9,4 9,4 2.5,-16 -2.5,-16" fill={CONE_COLOR} stroke="#a34700" strokeWidth={1} />
    <rect x={-2.5} y={-16} width={5} height={4} fill="#ffb066" />
    <ellipse cx={0} cy={4} rx={10} ry={2.5} fill="#c85f00" />
  </g>
);

export const Wall = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} fill={WALL_COLOR} stroke="#6d5a3a" strokeWidth={2} rx={3} />
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

export const Goal = ({
  x,
  y,
  w,
  h,
  litCorner,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  litCorner?: "tl" | "tr" | "bl" | "br" | null;
}) => {
  const corners: Record<string, [number, number]> = {
    tl: [x + 14, y + 14],
    tr: [x + w - 14, y + 14],
    bl: [x + 14, y + h - 14],
    br: [x + w - 14, y + h - 14],
  };
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={FIELD_LINE} strokeWidth={4} />
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={`v${i}`} x1={x + (i * w) / 5} y1={y} x2={x + (i * w) / 5} y2={y + h} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <line key={`h${i}`} x1={x} y1={y + (i * h) / 3} x2={x + w} y2={y + (i * h) / 3} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
      ))}
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <circle
          key={c}
          cx={corners[c][0]}
          cy={corners[c][1]}
          r={10}
          fill={litCorner === c ? "rgba(255,215,0,0.85)" : "rgba(255,255,255,0.15)"}
          stroke={ACCENT}
          strokeWidth={litCorner === c ? 2 : 1}
        />
      ))}
    </g>
  );
};

// --- Perspective camera: centered on the lane, eye height 2m, aimed at the backboard ---
// World units are meters. x = lateral, y = height (0 = floor), z = depth (distance in front of the camera).
export const CAM_HEIGHT = 2;
export const FOCAL = 400;
export const HORIZON_Y = 170;
export const CENTER_X = 320;
export const PLAYER_PX_PER_M = 34.4;
export const RIM_Z = 13;
export const RIM_Y = 3.05;
export const FT_LINE_Z = 8.8;
export const BASELINE_Z = 14.2;
export const KEY_HALF_WIDTH_M = 2.45;
export const THREE_PT_RADIUS_M = 6.75;

export type Pt3 = { x: number; y: number; z: number };

export const project = ({ x, y, z }: Pt3) => {
  const zc = Math.max(0.35, z);
  const scale = FOCAL / zc;
  return { sx: CENTER_X + x * scale, sy: HORIZON_Y - (y - CAM_HEIGHT) * scale, scale };
};

const pathFrom = (points: Pt3[]) =>
  points
    .map(project)
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.sx.toFixed(1)},${p.sy.toFixed(1)}`)
    .join(" ");

const sampleCircleXZ = (cx: number, cz: number, r: number, aFrom: number, aTo: number, n = 20): Pt3[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = aFrom + ((aTo - aFrom) * i) / n;
    return { x: cx + r * Math.sin(a), y: 0, z: cz - r * Math.cos(a) };
  });

export const Hoop = ({ x = 0, z = RIM_Z }: { x?: number; z?: number }) => {
  const rim = project({ x, y: RIM_Y, z });
  const s = rim.scale / PLAYER_PX_PER_M;
  const bx = rim.sx;
  const by = rim.sy;
  return (
    <g>
      <line x1={bx} y1={by - 34 * s} x2={bx} y2={by - 104 * s} stroke="#888" strokeWidth={Math.max(1, 5 * s)} />
      <rect x={bx - 10 * s} y={by - 108 * s} width={20 * s} height={6 * s} fill="#777" rx={1} />
      <rect x={bx - 26 * s} y={by - 34 * s} width={52 * s} height={34 * s} fill="#f5f5f5" stroke="#999" strokeWidth={Math.max(0.6, 1.5 * s)} rx={2} />
      <rect x={bx - 14 * s} y={by - 22 * s} width={28 * s} height={18 * s} fill="none" stroke="#c0392b" strokeWidth={Math.max(0.5, 1.2 * s)} />
      <ellipse cx={bx} cy={by} rx={16 * s} ry={4 * s} fill="none" stroke={HOOP_COLOR} strokeWidth={Math.max(1, 3 * s)} />
      {Array.from({ length: 7 }).map((_, i) => (
        <line
          key={i}
          x1={bx - 15 * s + i * 5 * s}
          y1={by - s}
          x2={bx - 9 * s + i * 3 * s}
          y2={by + 16 * s}
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={Math.max(0.5, s)}
        />
      ))}
    </g>
  );
};

export const HoopViewBackground = () => {
  const floorLines = Array.from({ length: 9 }, (_, i) => -8 + i * 2);
  const depthLines = [4, 7, 10, 13, 16, 20, 25];
  return (
    <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0 }}>
      <rect x={0} y={0} width={640} height={HORIZON_Y} fill="#3a4048" />
      <rect x={0} y={HORIZON_Y} width={640} height={480 - HORIZON_Y} fill={COURT_COLOR} />
      <rect x={0} y={HORIZON_Y - 2} width={640} height={4} fill="rgba(0,0,0,0.15)" />
      {floorLines.map((x, i) => (
        <path key={i} d={pathFrom([{ x, y: 0, z: 5 }, { x, y: 0, z: 30 }])} stroke="rgba(0,0,0,0.06)" strokeWidth={1.5} />
      ))}
      {depthLines.map((z, i) => (
        <path
          key={i}
          d={pathFrom([{ x: -10, y: 0, z }, { x: 10, y: 0, z }])}
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
};

export const FreeThrowKey = () => {
  const halfW = KEY_HALF_WIDTH_M;
  const corners: Pt3[] = [
    { x: -halfW, y: 0, z: FT_LINE_Z },
    { x: halfW, y: 0, z: FT_LINE_Z },
    { x: halfW, y: 0, z: BASELINE_Z },
    { x: -halfW, y: 0, z: BASELINE_Z },
  ];
  const outerArc = sampleCircleXZ(0, FT_LINE_Z, halfW, -Math.PI / 2, Math.PI / 2);
  const innerArc = sampleCircleXZ(0, FT_LINE_Z, halfW, Math.PI / 2, (Math.PI * 3) / 2);
  const labelPt = project({ x: 0, y: 0, z: BASELINE_Z - 0.8 });
  return (
    <g>
      <path d={pathFrom(corners) + " Z"} fill="rgba(255,255,255,0.06)" stroke={COURT_LINE} strokeWidth={2} />
      <path d={pathFrom([corners[0], corners[1]])} stroke={COURT_LINE} strokeWidth={2.5} />
      <path d={pathFrom(outerArc)} stroke={COURT_LINE} strokeWidth={1.5} fill="none" />
      <path d={pathFrom(innerArc)} stroke={COURT_LINE} strokeWidth={1.5} strokeDasharray="5,5" fill="none" opacity={0.7} />
      <text x={labelPt.sx} y={labelPt.sy} textAnchor="middle" fill={COURT_LINE} fontSize={9} fontFamily="sans-serif" opacity={0.6}>
        CAREUL DE 3 SECUNDE
      </text>
    </g>
  );
};

export const ThreePointLine = ({ rimX = 0, rimZ = RIM_Z }: { rimX?: number; rimZ?: number } = {}) => {
  const arc = sampleCircleXZ(rimX, rimZ, THREE_PT_RADIUS_M, -Math.PI / 2, Math.PI / 2, 28);
  return <path d={pathFrom(arc)} stroke={COURT_LINE} strokeWidth={1.5} fill="none" opacity={0.55} />;
};

export const COURT_HALF_WIDTH_M = 7.5;

export const CourtBoundaryLines = ({ nearZ = 5.5 }: { nearZ?: number } = {}) => {
  const halfW = COURT_HALF_WIDTH_M;
  return (
    <g>
      <path
        d={pathFrom([{ x: -halfW, y: 0, z: BASELINE_Z }, { x: halfW, y: 0, z: BASELINE_Z }])}
        stroke="white"
        strokeWidth={3}
        opacity={0.9}
      />
      <path
        d={pathFrom([{ x: -halfW, y: 0, z: nearZ }, { x: -halfW, y: 0, z: BASELINE_Z }])}
        stroke="white"
        strokeWidth={2.5}
        opacity={0.8}
      />
      <path
        d={pathFrom([{ x: halfW, y: 0, z: nearZ }, { x: halfW, y: 0, z: BASELINE_Z }])}
        stroke="white"
        strokeWidth={2.5}
        opacity={0.8}
      />
    </g>
  );
};

export const CourtBackground = () => (
  <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0 }}>
    <rect x={0} y={0} width={640} height={480} fill={COURT_COLOR} />
    {Array.from({ length: 12 }).map((_, i) => (
      <line key={i} x1={i * 55} y1={0} x2={i * 55} y2={480} stroke="rgba(0,0,0,0.05)" strokeWidth={2} />
    ))}
  </svg>
);

export const FieldBackground = () => (
  <svg width="640" height="480" style={{ position: "absolute", top: 0, left: 0 }}>
    {Array.from({ length: 8 }).map((_, i) => (
      <rect key={i} x={0} y={i * 60} width={640} height={30} fill="rgba(255,255,255,0.03)" />
    ))}
  </svg>
);

export const TimerBadge = ({
  seconds,
  opacity = 1,
}: {
  seconds: number;
  opacity?: number;
}) => (
  <div
    style={{
      position: "absolute",
      top: 16,
      right: 16,
      backgroundColor: "rgba(0,0,0,0.75)",
      borderRadius: 8,
      padding: "8px 16px",
      opacity,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}
  >
    <span style={{ color: ACCENT, fontSize: 14, fontWeight: "bold", fontFamily: "sans-serif" }}>⏱</span>
    <span style={{ color: "white", fontSize: 20, fontWeight: "bold", fontFamily: "monospace" }}>
      {String(Math.floor(seconds / 60)).padStart(1, "0")}:{String(Math.floor(seconds % 60)).padStart(2, "0")}
    </span>
  </div>
);

export const CounterBadge = ({
  label,
  value,
  opacity = 1,
}: {
  label: string;
  value: number | string;
  opacity?: number;
}) => (
  <div
    style={{
      position: "absolute",
      top: 16,
      left: 16,
      backgroundColor: "rgba(0,0,0,0.75)",
      borderRadius: 8,
      padding: "8px 16px",
      opacity,
    }}
  >
    <span style={{ color: "white", fontSize: 14, fontFamily: "sans-serif" }}>{label} </span>
    <span style={{ color: ACCENT, fontSize: 20, fontWeight: "bold", fontFamily: "sans-serif" }}>{value}</span>
  </div>
);

export const TitleBar = ({ text }: { text: string }) => (
  <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
    <div style={{ backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 8, padding: "8px 24px" }}>
      <span style={{ color: "white", fontSize: 16, fontWeight: "bold", fontFamily: "sans-serif" }}>{text}</span>
    </div>
  </div>
);

export const ActionLabel = ({
  text,
  color,
  x = 430,
  y = 200,
  w = 120,
}: {
  text: string;
  color: string;
  x?: number;
  y?: number;
  w?: number;
}) => (
  <g>
    <rect x={x} y={y} width={w} height={30} rx={6} fill={color} />
    <text x={x + w / 2} y={y + 20} textAnchor="middle" fill="white" fontSize={13} fontWeight="bold" fontFamily="sans-serif">
      {text}
    </text>
  </g>
);

export const FinalOverlay = ({
  opacity,
  mainText,
  subText,
}: {
  opacity: number;
  mainText: string;
  subText: string;
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: `rgba(0,0,0,${0.6 * opacity})`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    }}
  >
    <div
      style={{
        backgroundColor: "rgba(0,0,0,0.85)",
        borderRadius: 12,
        padding: "24px 48px",
        textAlign: "center",
        opacity,
        maxWidth: 520,
      }}
    >
      <div style={{ color: ACCENT, fontSize: 22, fontWeight: "bold", fontFamily: "sans-serif", marginBottom: 8 }}>{mainText}</div>
      <div style={{ color: "white", fontSize: 15, fontFamily: "sans-serif" }}>{subText}</div>
    </div>
  </div>
);

export const smoothstep = (t: number) => t * t * (3 - 2 * t);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
