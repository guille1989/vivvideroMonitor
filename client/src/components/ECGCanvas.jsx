import { useCallback, useEffect, useRef } from 'react';

// Config visual por estado
const STATE_CONFIG = {
  good: { line: '#22c55e', glow: 'rgba(34,197,94,', dot: '#4ade80', grid: 'rgba(34,197,94,.06)', bh: 0.52, bw: 0.18, noise: 0.5, spd: 0.007 },
  warn: { line: '#f97316', glow: 'rgba(249,115,22,', dot: '#fb923c', grid: 'rgba(249,115,22,.06)', bh: 0.74, bw: 0.14, noise: 2.2, spd: 0.013 },
  bad: { line: '#ef4444', glow: 'rgba(239,68,68,', dot: '#f87171', grid: 'rgba(239,68,68,.07)', bh: 0.92, bw: 0.09, noise: 4.5, spd: 0.022 },
};

function getState(rating) {
  if (rating >= 4) return 'good';
  if (rating >= 3) return 'warn';
  return 'bad';
}

function ecgShape(t, config) {
  const cycle = t % 1;
  return (
    0.08 * Math.exp(-Math.pow((cycle - 0.12) / 0.04, 2)) +
    -0.12 * Math.exp(-Math.pow((cycle - 0.28) / 0.018, 2)) +
    config.bh * Math.exp(-Math.pow((cycle - 0.32) / (config.bw * 0.6), 2)) +
    -0.18 * Math.exp(-Math.pow((cycle - 0.38) / 0.022, 2)) +
    0.22 * Math.exp(-Math.pow((cycle - 0.58) / 0.10, 2)) +
    (Math.random() - 0.5) * config.noise * 0.015
  );
}

export default function ECGCanvas({
  rating = 4.1,
  height = 72,
  radius = 12,
  showScan = true,
}) {
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);
  const phaseRef = useRef(0);
  const rafRef = useRef(null);
  const ratingRef = useRef(rating);

  useEffect(() => {
    ratingRef.current = rating;
  }, [rating]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    pointsRef.current = [];
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const heightPx = canvas.height / dpr;
    const mid = heightPx / 2;
    const state = getState(ratingRef.current);
    const config = STATE_CONFIG[state];

    phaseRef.current = (phaseRef.current + config.spd) % 1;
    pointsRef.current.push(mid - ecgShape(phaseRef.current, config) * heightPx * 0.42);
    if (pointsRef.current.length > width) pointsRef.current.shift();

    ctx.clearRect(0, 0, width, heightPx);

    // Grid
    ctx.strokeStyle = config.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, heightPx);
      ctx.stroke();
    }
    for (let y = 0; y < heightPx; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (pointsRef.current.length < 2) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    // ECG line
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = config.line;
    ctx.shadowBlur = state === 'bad' ? 14 : state === 'warn' ? 8 : 5;
    ctx.strokeStyle = config.line;
    ctx.globalAlpha = 1;

    pointsRef.current.forEach((y, i) => {
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    });
    ctx.stroke();

    // Bloom
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Tip glow
    const pts = pointsRef.current;
    const tipX = pts.length - 1;
    const tipY = pts[tipX];
    const dotRadius = state === 'bad' ? 5 : 3.5;

    const radial = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, dotRadius * 3.5);
    radial.addColorStop(0, `${config.glow}0.85)`);
    radial.addColorStop(0.4, `${config.glow}0.3)`);
    radial.addColorStop(1, `${config.glow}0)`);

    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(tipX, tipY, dotRadius * 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = config.dot;
    ctx.beginPath();
    ctx.arc(tipX, tipY, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    resize();
    rafRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [resize, draw]);

  return (
    <>
      {showScan && (
        <style>{`
          @keyframes ecgScan {
            from { left: -3px; }
            to   { left: calc(100% + 3px); }
          }
          .ecg-scan-line::after {
            content: '';
            position: absolute;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(180deg, transparent, rgba(255,255,255,.1), transparent);
            animation: ecgScan 2.4s linear infinite;
            pointer-events: none;
          }
        `}</style>
      )}

      <div
        className={showScan ? 'ecg-scan-line' : undefined}
        style={{
          width: '100%',
          height,
          borderRadius: radius,
          overflow: 'hidden',
          background: 'rgba(0,0,0,.3)',
          position: 'relative',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    </>
  );
}
