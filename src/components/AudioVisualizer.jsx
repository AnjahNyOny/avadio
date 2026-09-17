import { useEffect, useRef } from 'react';

export default function AudioVisualizer({ engine, isRecording }) {
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  useEffect(() => {
    if (!isRecording) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      const dataArray = engine.getFrequencyData();
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / dataArray.length) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i] / 2;

        // Gradient based on height
        const r = barHeight + (25 * (i/dataArray.length));
        const g = 250 * (i/dataArray.length);
        const b = 255;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      requestRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRecording, engine]);

  return (
    <div className="w-full h-24 mb-8 flex justify-center items-center overflow-hidden rounded-xl bg-slate-900/50">
      {!isRecording ? (
        <div className="w-full h-1 bg-slate-700/50 rounded-full"></div>
      ) : (
        <canvas ref={canvasRef} width="400" height="100" className="w-full h-full" />
      )}
    </div>
  );
}
