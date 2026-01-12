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
import { FittedDataPoint } from '@/lib/types';
import { HALVING_CYCLES, getHalvingIndices, debugHalvingCoverage } from '@/lib/halvings';
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

interface DeviationChartProps {
  data: FittedDataPoint[];
  showHalvings: boolean;
}

export default function DeviationChart({ data, showHalvings }: DeviationChartProps) {
  // Sample data for performance
  const sampleRate = Math.max(1, Math.floor(data.length / 1000));
  const sampledData = data.filter((_, i) => i % sampleRate === 0 || i === data.length - 1);

  const labels = sampledData.map(d => format(new Date(d.date), 'yyyy-MM-dd'));

  // Get halving indices for the sampled data
  const halvingIndices = useMemo(() => getHalvingIndices(labels), [labels]);

  // Debug output for halving coverage (temporary)
  const debugInfo = useMemo(() => debugHalvingCoverage(labels), [labels]);
  useEffect(() => {
    console.log('[DeviationChart] Halving Debug Info:', {
      dataRange: `${debugInfo.minDate} to ${debugInfo.maxDate}`,
      totalLabels: labels.length,
      sampleRate,
      halvings: debugInfo.halvings,
      foundIndices: halvingIndices.map(h => ({ date: h.halving.dateStr, index: h.index })),
    });
  }, [debugInfo, halvingIndices, labels.length, sampleRate]);

  // Create halving plugin for vertical lines, cycle shading, and labels
  const halvingPlugin: Plugin<'line'> = useMemo(() => ({
    id: 'halvingPluginDeviation',
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
        label: 'Deviation from Model (%)',
        data: sampledData.map(d => d.deviationPercent),
        borderColor: (context: { parsed?: { y: number | null } }) => {
          const value = context.parsed?.y ?? 0;
          return value >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';
        },
        backgroundColor: (context: { chart: ChartJS }) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return 'rgba(147, 51, 234, 0.2)';

          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
          gradient.addColorStop(0.5, 'rgba(147, 51, 234, 0.1)');
          gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
          return gradient;
        },
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0,
        segment: {
          borderColor: (ctx: { p0: { parsed: { y: number | null } }; p1: { parsed: { y: number | null } } }) => {
            const y0 = ctx.p0.parsed.y ?? 0;
            const y1 = ctx.p1.parsed.y ?? 0;
            return y0 >= 0 && y1 >= 0
              ? 'rgb(34, 197, 94)'
              : y0 < 0 && y1 < 0
              ? 'rgb(239, 68, 68)'
              : 'rgb(147, 51, 234)';
          },
        },
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
        text: 'Price Deviation from Power Law Model (%)',
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
            return `Deviation: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
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
          callback: (value) => `${value}%`,
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
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
      <Line
        key={`deviation-chart-${showHalvings}`}
        data={chartData}
        options={options}
        plugins={plugins}
      />
    </div>
  );
}
