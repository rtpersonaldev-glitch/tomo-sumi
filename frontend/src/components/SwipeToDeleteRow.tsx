import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_WIDTH = 72;

interface SwipeToDeleteRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  className?: string;
}

export function SwipeToDeleteRow({ children, onDelete, className }: SwipeToDeleteRowProps) {
  const [offset, _setOffset] = useState(0);
  const offsetRef = useRef(0);
  const startXRef = useRef<number | null>(null);
  const baseOffsetRef = useRef(0);
  const movedRef = useRef(false);

  const setOffset = (v: number) => {
    offsetRef.current = v;
    _setOffset(v);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    baseOffsetRef.current = offsetRef.current;
    movedRef.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null) return;
    const dx = startXRef.current - e.clientX;
    if (Math.abs(dx) > 4) movedRef.current = true;
    setOffset(Math.max(0, Math.min(baseOffsetRef.current + dx, ACTION_WIDTH)));
  };

  const onPointerUp = () => {
    if (startXRef.current === null) return;
    startXRef.current = null;
    setOffset(offsetRef.current >= ACTION_WIDTH / 2 ? ACTION_WIDTH : 0);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (movedRef.current || offsetRef.current > 0) {
      e.stopPropagation();
      e.preventDefault();
      if (offsetRef.current > 0) setOffset(0);
      movedRef.current = false;
    }
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Delete action revealed underneath */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-destructive"
        style={{ width: ACTION_WIDTH }}
      >
        <button
          type="button"
          onClick={onDelete}
          className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-white"
          aria-label="削除"
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-[10px] font-semibold">削除</span>
        </button>
      </div>

      {/* Content slides left on swipe */}
      <div
        className="relative bg-card"
        style={{
          transform: `translateX(-${offset}px)`,
          transition: startXRef.current === null ? "transform 0.2s ease" : "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
