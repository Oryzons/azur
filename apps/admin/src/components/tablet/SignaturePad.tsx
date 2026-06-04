import { useEffect, useRef } from 'react';

function prepareCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

type Props = {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
};

export function SignaturePad({ label, value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!value) {
      prepareCanvas(ctx, canvas);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      const context = c?.getContext('2d');
      if (!c || !context) return;
      prepareCanvas(context, c);
      context.drawImage(img, 0, 0, c.width, c.height);
      context.strokeStyle = '#0f172a';
      context.lineWidth = 2.5;
      context.lineCap = 'round';
      context.lineJoin = 'round';
    };
    img.src = value;
  }, [value]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    prepareCanvas(ctx, canvas);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-800">{label}</span>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-semibold text-[#416B9F] hover:underline"
        >
          Effacer
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="w-full touch-manipulation rounded-2xl border border-zinc-200/90 bg-white shadow-inner [touch-action:none]"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      {value ? (
        <p className="text-xs font-medium text-emerald-700">Signature capturée</p>
      ) : (
        <p className="text-xs text-zinc-500">Signez dans le cadre ci-dessus</p>
      )}
    </div>
  );
}
