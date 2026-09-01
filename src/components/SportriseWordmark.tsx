import { Star } from "lucide-react";

const SportriseWordmark = ({ className = "", onDark = false }: { className?: string; onDark?: boolean }) => (
  <div className={`font-body font-bold inline-flex items-end justify-center leading-none tracking-wide ${className}`}>
    <span className={onDark ? "text-white" : "text-gray-900"}>SPORT</span>
    <span className="text-orange-500">R</span>
    <span className="relative inline-block h-[1em] w-[0.32em] mx-[0.02em]">
      <Star className="absolute left-1/2 -translate-x-1/2 -top-[0.4em] h-[0.55em] w-[0.55em] fill-electric text-electric" />
      <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[0.16em] h-[0.72em] bg-orange-500 rounded-[0.02em]" />
    </span>
    <span className="text-orange-500">SE</span>
  </div>
);

export default SportriseWordmark;
