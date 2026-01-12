'use client';

import { useMemo, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  Plugin,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { VolatilityDataPoint } from '@/lib/types';
import { HALVING_CYCLES, getHalvingIndices, debugHalvingCoverage } from '@/lib/halvings';
import { ROLLING_WINDOW_DAYS } from '@/lib/powerlaw';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface VolatilityChartProps {
  data: VolatilityDataPoint[];
  showHalvings: boolean;
}

export default function VolatilityChart({ data, showHalvings }: VolatilityChartProps) {
  // Sample data for performance
  const sampleRate = Math.max(1, Math.floor(data.length / 1000));
  const sampledData = data.filter((_, i) => i % sampleRate === 0 || i === data.length - 1);

  const labels = sampledData.map(d => format(new Date(d.date), 'yyyy-MM-dd'));

  // Get halving indices for the sampled data
  const halvingIndices = useMemo(() => getHalvingIndices(labels), [labels]);

  // Debug output for halving coverage (temporary)
  const debugInfo = useMemo(() => debugHalvingCoverage(labels), [labels]);
  useEffect(() => {
    console.log('[VolatilityChart] Halving Debug Info:', {
      dataRange: `${debugInfo.minDate} to ${debugInfo.maxDate}`,
      totalLabels: labels.length,
      sampleRate,
      halvings: debugInfo.halvings,
      foundIndices: halvingIndices.map(h => ({ date: h.halving.dateStr, index: h.index })),
    });
  }, [debugInfo, halvingIndices, labels.length, sampleRate]);

  // Create halving plugin for vertical lines, cycle shading, and labels
  const halvingPlugin: Plugin<'line'> = useMemo(() => ({
    id: 'halvingPluginVolatility',
    beforeDraw: (chart) => {
      if (!showHalvings) return;

      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;

      const { left, right, top, bottom } = chartArea;

      // Draw cycle shading
      for (const cycle of HALVING_CYCLES) {
        const startLabel = format(cycle.start, 'yyyy-MM-dd');
        const endLabel = format(cycle.end, 'yyyy-MM-dd');

        let startX = left;
        let endX = right;

        // Find start position
        const startIdx = labels.findIndex(l => l >= startLabel);
        if (startIdx !== -1) {
          const xPos = scales.x.getPixelForValue(startIdx);
          if (xPos > left) startX = xPos;
        }

        // Find end position
        const endIdx = labels.findIndex(l => l >= endLabel);
        if (endIdx !== -1) {
          const xPos = scales.x.getPixelForValue(endIdx);
          if (xPos < right) endX = xPos;
        } else {
          // Cycle extends beyond data
          endX = right;
        }

        // Only draw if in visible range
        if (startX < right && endX > left) {
          ctx.save();
          ctx.fillStyle = cycle.color;
          ctx.fillRect(
            Math.max(startX, left),
            top,
            Math.min(endX, right) - Math.max(startX, left),
            bottom - top
          );
          ctx.restore();
        }
      }
    },
    afterDraw: (chart) => {
      if (!showHalvings) return;

      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;

      const { top, bottom } = chartArea;

      // Draw halving lines and labels
      for (const { index, halving } of halvingIndices) {
        const xPos = scales.x.getPixelForValue(index);

        // Draw vertical line
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(xPos, top);
        ctx.lineTo(xPos, bottom);
        ctx.stroke();
        ctx.restore();

        // Draw label
        ctx.save();
        ctx.fillStyle = 'rgba(249, 115, 22, 0.9)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';

        // Extract year for label
        const year = halving.date.getFullYear();
        const labelText = `Halving ${year}`;

        // Background for label
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillStyle = 'rgba(31, 41, 55, 0.9)';
        ctx.fillRect(xPos - textWidth / 2 - 4, top + 5, textWidth + 8, 18);

        // Label text
        ctx.fillStyle = 'rgba(249, 115, 22, 1)';
        ctx.fillText(labelText, xPos, top + 18);
        ctx.restore();
      }
    },
  }), [showHalvings, halvingIndices, labels]);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Rolling 2-Year Volatility (σ)',
        data: sampledData.map(d => d.rollingStdDev),
        borderColor: 'rgb(168, 85, 247)', // Purple
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.1,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e5e7eb',
        },
      },
      title: {
        display: true,
        text: 'Market Volatility vs Power Law (Rolling 2-Year σ of Log Residuals)',
        color: '#e5e7eb',
        font: {
          size: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            if (value === null || value === undefined) return '';
            return `Volatility (σ): ${value.toFixed(4)}`;
          },
          afterLabel: () => {
            return `Window: ${ROLLING_WINDOW_DAYS} days (2 years)`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 10,
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
      },
      y: {
        ticks: {
          color: '#9ca3af',
          callback: (value) => {
            if (typeof value === 'number') {
              return value.toFixed(2);
            }
            return value;
          },
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
        title: {
          display: true,
          text: 'Volatility (σ of log residuals)',
          color: '#9ca3af',
        },
      },
    },
  };

  // Conditionally include plugin based on showHalvings
  const plugins = showHalvings ? [halvingPlugin] : [];

  return (
    <div className="w-full h-[400px] md:h-[500px]">
      {/* Debug info banner (temporary) */}
      <div className="text-xs text-gray-500 mb-1">
        Data: {debugInfo.minDate} → {debugInfo.maxDate} |
        Halvings found: {halvingIndices.length}/4 |
        Show: {showHalvings ? 'ON' : 'OFF'}
      </div>
      <div className="text-xs text-gray-400 mb-2">
        This chart shows volatility relative to the adoption curve, not raw price volatility.
        Lower values indicate Bitcoin is tracking the power law model more closely.
      </div>
      <Line
        key={`volatility-chart-${showHalvings}`}
        data={chartData}
        options={options}
        plugins={plugins}
      />
    </div>
  );
}
