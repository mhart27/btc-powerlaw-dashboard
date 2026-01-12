'use client';

import { useEffect, useRef, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
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
import { HALVING_DATES, HALVING_CYCLES, getHalvingIndices, debugHalvingCoverage } from '@/lib/halvings';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PriceChartProps {
  data: FittedDataPoint[];
  isLogScale: boolean;
  showHalvings: boolean;
}

export default function PriceChart({ data, isLogScale, showHalvings }: PriceChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Sample data for performance (take every nth point if too many)
  const sampleRate = Math.max(1, Math.floor(data.length / 1000));
  const sampledData = data.filter((_, i) => i % sampleRate === 0 || i === data.length - 1);

  const labels = sampledData.map(d => format(new Date(d.date), 'yyyy-MM-dd'));

  // Get halving indices for the sampled data
  const halvingIndices = useMemo(() => getHalvingIndices(labels), [labels]);

  // Debug output for halving coverage (temporary)
  const debugInfo = useMemo(() => debugHalvingCoverage(labels), [labels]);
  useEffect(() => {
    console.log('[PriceChart] Halving Debug Info:', {
      dataRange: `${debugInfo.minDate} to ${debugInfo.maxDate}`,
      totalLabels: labels.length,
      sampleRate,
      halvings: debugInfo.halvings,
      foundIndices: halvingIndices.map(h => ({ date: h.halving.dateStr, index: h.index })),
    });
  }, [debugInfo, halvingIndices, labels.length, sampleRate]);

  // Create halving plugin for vertical lines, cycle shading, and labels
  // Only create actual plugin when showHalvings is true
  const halvingPlugin: Plugin<'line'> = useMemo(() => ({
    id: 'halvingPlugin',
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
      // +2σ band (bubble zone) - top boundary
      {
        label: '+2σ (Bubble)',
        data: sampledData.map(d => d.band2SigmaUpper),
        borderColor: 'rgba(239, 68, 68, 0.3)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 10,
      },
      // +1σ to +2σ (expensive zone)
      {
        label: '+1σ to +2σ (Expensive)',
        data: sampledData.map(d => d.band1SigmaUpper),
        borderColor: 'rgba(249, 115, 22, 0.4)',
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        borderWidth: 1,
        pointRadius: 0,
        fill: '+1',
        tension: 0,
        order: 9,
      },
      // Fair value zone (-1σ to +1σ)
      {
        label: 'Fair Value (-1σ to +1σ)',
        data: sampledData.map(d => d.band1SigmaLower),
        borderColor: 'rgba(34, 197, 94, 0.4)',
        backgroundColor: 'rgba(100, 116, 139, 0.1)',
        borderWidth: 1,
        pointRadius: 0,
        fill: '-1',
        tension: 0,
        order: 8,
      },
      // -1σ to -2σ (undervalued/deep value)
      {
        label: '-1σ to -2σ (Deep Value)',
        data: sampledData.map(d => d.band2SigmaLower),
        borderColor: 'rgba(34, 197, 94, 0.3)',
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        borderWidth: 1,
        pointRadius: 0,
        fill: '+1',
        tension: 0,
        order: 7,
      },
      // Power law fit line
      {
        label: 'Power Law Model',
        data: sampledData.map(d => d.fittedPrice),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        borderDash: [5, 5],
        tension: 0,
        fill: false,
        order: 2,
      },
      // Actual BTC price
      {
        label: 'BTC Price (USD)',
        data: sampledData.map(d => d.price),
        borderColor: 'rgb(247, 147, 26)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
        fill: false,
        order: 1,
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
          filter: (item) => {
            return item.text === 'BTC Price (USD)' || item.text === 'Power Law Model';
          },
        },
      },
      title: {
        display: true,
        text: 'BTC Price vs Power Law Model with Valuation Bands',
        color: '#e5e7eb',
        font: {
          size: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            if (value === null) return;
            const datasetLabel = context.dataset.label || '';

            if (datasetLabel.includes('BTC Price')) {
              const dataIndex = context.dataIndex;
              const sigmaVal = sampledData[dataIndex]?.sigmaDeviation;
              const sigmaStr = sigmaVal !== undefined
                ? ` (${sigmaVal >= 0 ? '+' : ''}${sigmaVal.toFixed(2)}σ)`
                : '';
              return `${datasetLabel}: $${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${sigmaStr}`;
            }

            if (datasetLabel.includes('Power Law')) {
              return `${datasetLabel}: $${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }

            return;
          },
          afterBody: (tooltipItems) => {
            const dataIndex = tooltipItems[0]?.dataIndex;
            if (dataIndex === undefined) return [];

            const point = sampledData[dataIndex];
            if (!point) return [];

            return [
              '',
              `+2σ: $${point.band2SigmaUpper.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
              `+1σ: $${point.band1SigmaUpper.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
              `-1σ: $${point.band1SigmaLower.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
              `-2σ: $${point.band2SigmaLower.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            ];
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
        type: isLogScale ? 'logarithmic' : 'linear',
        ticks: {
          color: '#9ca3af',
          callback: (value) => {
            if (typeof value === 'number') {
              if (value >= 1000000) {
                return '$' + (value / 1000000).toFixed(1) + 'M';
              }
              if (value >= 1000) {
                return '$' + (value / 1000).toFixed(0) + 'k';
              }
              if (value >= 1) {
                return '$' + value.toFixed(0);
              }
              return '$' + value.toFixed(2);
            }
            return value;
          },
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
      },
    },
  };

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update();
    }
  }, [isLogScale, showHalvings]);

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
        key={`price-chart-${showHalvings}`}
        ref={chartRef}
        data={chartData}
        options={options}
        plugins={plugins}
      />
    </div>
  );
}
