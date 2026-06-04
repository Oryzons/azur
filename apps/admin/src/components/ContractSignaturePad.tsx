import { useEffect, useRef } from 'react';

function prepareCanvasContext(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
}

export function ContractSignaturePad(props: Readonly<{
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}>) {
  const { label, value, onChange, disabled } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!value) {
      prepareCanvasContext(ctx, canvas);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      const context = c?.getContext('2d');
      if (!c || !context) return;
      prepareCanvasContext(context, c);
      context.drawImage(img, 0, 0, c.width, c.height);
      context.strokeStyle = '#0f172a';
      context.lineWidth = 2;
      context.lineCap = 'round';
    };
    img.onerror = () => {
      const c = canvasRef.current;
      const context = c?.getContext('2d');
      if (c && context) prepareCanvasContext(context, c);
    };
    img.src = value;
  }, [value]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    prepareCanvasContext(ctx, canvas);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-800">{label}</span>
        {!disabled ? (
          <button type="button" className="text-xs font-semibold text-[#416B9F] hover:underline" onClick={clear}>
            Effacer
          </button>
        ) : null}
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={140}
        className={`w-full touch-none rounded-xl border border-zinc-200 bg-white ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onPointerDown={(e) => {
          if (disabled) return;
          const ctx = canvasRef.current?.getContext('2d');
          if (!ctx || !canvasRef.current) return;
          drawing.current = true;
          canvasRef.current.setPointerCapture(e.pointerId);
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || disabled) return;
          const ctx = canvasRef.current?.getContext('2d');
          if (!ctx) return;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          if (disabled) return;
          drawing.current = false;
          const canvas = canvasRef.current;
          if (canvas) onChange(canvas.toDataURL('image/png'));
        }}
      />
      {value ? <p className="text-xs font-medium text-emerald-700">Signature enregistrée</p> : null}
    </div>
  );
}
