import { useState, useEffect } from 'react';
import { Eraser } from 'lucide-react';

interface FirmaCanvasFieldProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  hasSignature: boolean;
  setHasSignature: (has: boolean) => void;
  resetSignal?: unknown;
}

export function FirmaCanvasField({
  canvasRef,
  hasSignature,
  setHasSignature,
  resetSignal,
}: FirmaCanvasFieldProps) {
  const [isDrawing, setIsDrawing] = useState(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [canvasRef, resetSignal]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const point = getCanvasPoint(e);
    if (!point) return;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const point = getCanvasPoint(e);
    if (!point) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
          Firma Digital (Táctil o Ratón)
        </label>
        <button
          type="button"
          onClick={clearCanvas}
          className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium transition cursor-pointer"
        >
          <Eraser size={14} />
          Limpiar Canvas
        </button>
      </div>

      <div
        className="border-2 border-dashed border-slate-300 dark:border-slate-400 rounded-2xl overflow-hidden flex items-center justify-center relative touch-none bg-[#ffffff] shadow-inner"
        style={{ backgroundColor: '#ffffff' }}
      >
        <canvas
          ref={canvasRef}
          width={560}
          height={180}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          className="w-full h-44 cursor-crosshair bg-[#ffffff]"
          style={{ backgroundColor: '#ffffff' }}
        />
        {!hasSignature && (
          <span className="absolute text-slate-400 text-sm font-semibold pointer-events-none select-none">
            Firme aquí dentro del recuadro
          </span>
        )}
      </div>
    </div>
  );
}
