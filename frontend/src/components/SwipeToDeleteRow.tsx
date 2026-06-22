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
  const isDraggingRef = useRef(false);

  const setOffset = (v: number) => {
    offsetRef.current = v;
    _setOffset(v);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    baseOffsetRef.current = offsetRef.current;
    movedRef.current = false;
    isDraggingRef.current = true;
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
    isDraggingRef.current = false;
    setOffset(offsetRef.current >= ACTION_WIDTH / 2 ? ACTION_WIDTH : 0);
  };

  const onPointerCancel = () => {
    if (startXRef.current === null) return;
    startXRef.current = null;
    isDraggingRef.current = false;
    setOffset(0);
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
    <div className={cn("overflow-hidden", className)}>
      {/* Flex row: content + action side-by-side; translateX reveals action on left swipe */}
      <div
        className="flex"
        style={{
          transform: `translateX(-${offset}px)`,
          transition: isDraggingRef.current ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* Content — full width; onClickCapture closes panel on tap */}
        <div className="w-full shrink-0" onClickCapture={onClickCapture}>
          {children}
        </div>
        {/* Delete action — hidden until swiped */}
        <div
          className="shrink-0 flex items-center justify-center bg-destructive"
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
      </div>
    </div>
  );
}
