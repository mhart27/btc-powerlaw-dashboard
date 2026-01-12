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
import { FittedDataPoint, ProjectionDataPoint } from '@/lib/types';
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
  showProjections: boolean;
  projectionData: ProjectionDataPoint[];
}

export default function PriceChart({ data, isLogScale, showHalvings, showProjections, projectionData }: PriceChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Sample data for performance (take every nth point if too many)
  const sampleRate = Math.max(1, Math.floor(data.length / 1000));
  const sampledData = data.filter((_, i) => i % sampleRate === 0 || i === data.length - 1);

  // Sample projection data similarly
  const projectionSampleRate = Math.max(1, Math.floor(projectionData.length / 500));
  const sampledProjections = projectionData.filter((_, i) => i % projectionSampleRate === 0 || i === projectionData.length - 1);

  // Combined labels: historical + projection
  const historicalLabels = sampledData.map(d => format(new Date(d.date), 'yyyy-MM-dd'));
  const projectionLabels = showProjections ? sampledProjections.map(d => format(new Date(d.date), 'yyyy-MM-dd')) : [];
  const labels = [...historicalLabels, ...projectionLabels];

  // Track the index where projection starts
  const projectionStartIndex = historicalLabels.length;

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

  // Create projection plugin for shading and label
  const projectionPlugin: Plugin<'line'> = useMemo(() => ({
    id: 'projectionPlugin',
    beforeDraw: (chart) => {
      if (!showProjections || sampledProjections.length === 0) return;

      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;

      const { right, top, bottom } = chartArea;

      // Get the x position where projection starts
      const projStartX = scales.x.getPixelForValue(projectionStartIndex);

      // Draw shaded region for projection
      ctx.save();
      ctx.fillStyle = 'rgba(139, 92, 246, 0.08)'; // Subtle purple tint
      ctx.fillRect(projStartX, top, right - projStartX, bottom - top);

      // Draw vertical dashed line at projection boundary
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.moveTo(projStartX, top);
      ctx.lineTo(projStartX, bottom);
      ctx.stroke();
      ctx.restore();
    },
    afterDraw: (chart) => {
      if (!showProjections || sampledProjections.length === 0) return;

      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;

      const { top } = chartArea;

      // Get the x position where projection starts
      const projStartX = scales.x.getPixelForValue(projectionStartIndex);

      // Draw "Projection" label
      ctx.save();
      ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';

      const labelText = 'Projection';
      const textWidth = ctx.measureText(labelText).width;

      // Background for label
      ctx.fillStyle = 'rgba(31, 41, 55, 0.9)';
      ctx.fillRect(projStartX + 8, top + 5, textWidth + 8, 18);

      // Label text
      ctx.fillStyle = 'rgba(139, 92, 246, 1)';
      ctx.fillText(labelText, projStartX + 12, top + 18);
      ctx.restore();
    },
  }), [showProjections, sampledProjections.length, projectionStartIndex]);

  // Build data arrays that include projections
  // Historical data + projection data for model/bands
  // Historical data + nulls for BTC price (no projection)
  const band2UpperData = [
    ...sampledData.map(d => d.band2SigmaUpper),
    ...(showProjections ? sampledProjections.map(d => d.band2SigmaUpper) : []),
  ];
  const band1UpperData = [
    ...sampledData.map(d => d.band1SigmaUpper),
    ...(showProjections ? sampledProjections.map(d => d.band1SigmaUpper) : []),
  ];
  const band1LowerData = [
    ...sampledData.map(d => d.band1SigmaLower),
    ...(showProjections ? sampledProjections.map(d => d.band1SigmaLower) : []),
  ];
  const band2LowerData = [
    ...sampledData.map(d => d.band2SigmaLower),
    ...(showProjections ? sampledProjections.map(d => d.band2SigmaLower) : []),
  ];
  const modelData = [
    ...sampledData.map(d => d.fittedPrice),
    ...(showProjections ? sampledProjections.map(d => d.fittedPrice) : []),
  ];
  // BTC price stops at historical data - null for projections
  const priceData = [
    ...sampledData.map(d => d.price),
    ...(showProjections ? sampledProjections.map(() => null as number | null) : []),
  ];

  const chartData = {
    labels,
    datasets: [
      // +2σ band (bubble zone) - top boundary
      {
        label: '+2σ (Bubble)',
        data: band2UpperData,
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
        data: band1UpperData,
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
        data: band1LowerData,
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
        data: band2LowerData,
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
        data: modelData,
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
        data: priceData,
        borderColor: 'rgb(247, 147, 26)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
        fill: false,
        order: 1,
        spanGaps: false, // Don't connect across null values
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
          title: (tooltipItems) => {
            const dataIndex = tooltipItems[0]?.dataIndex;
            if (dataIndex === undefined) return '';
            const isProjection = dataIndex >= projectionStartIndex;
            const label = tooltipItems[0]?.label || '';
            return isProjection ? `${label} (Projection)` : label;
          },
          label: (context) => {
            const value = context.parsed.y;
            if (value === null) return;
            const datasetLabel = context.dataset.label || '';
            const dataIndex = context.dataIndex;
            const isProjection = dataIndex >= projectionStartIndex;

            if (datasetLabel.includes('BTC Price')) {
              // BTC price is only available for historical data
              if (isProjection) return;
              const sigmaVal = sampledData[dataIndex]?.sigmaDeviation;
              const sigmaStr = sigmaVal !== undefined
                ? ` (${sigmaVal >= 0 ? '+' : ''}${sigmaVal.toFixed(2)}σ)`
                : '';
              return `${datasetLabel}: $${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${sigmaStr}`;
            }

            if (datasetLabel.includes('Power Law')) {
              const prefix = isProjection ? 'Projected Model' : datasetLabel;
              return `${prefix}: $${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }

            return;
          },
          afterBody: (tooltipItems) => {
            const dataIndex = tooltipItems[0]?.dataIndex;
            if (dataIndex === undefined) return [];

            const isProjection = dataIndex >= projectionStartIndex;

            // Get band values from either historical or projection data
            let band2Upper: number, band1Upper: number, band1Lower: number, band2Lower: number;
            if (isProjection) {
              const projIndex = dataIndex - projectionStartIndex;
              const projPoint = sampledProjections[projIndex];
              if (!projPoint) return [];
              band2Upper = projPoint.band2SigmaUpper;
              band1Upper = projPoint.band1SigmaUpper;
              band1Lower = projPoint.band1SigmaLower;
              band2Lower = projPoint.band2SigmaLower;
            } else {
              const point = sampledData[dataIndex];
              if (!point) return [];
              band2Upper = point.band2SigmaUpper;
              band1Upper = point.band1SigmaUpper;
              band1Lower = point.band1SigmaLower;
              band2Lower = point.band2SigmaLower;
            }

            return [
              '',
              `+2σ: $${band2Upper.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
              `+1σ: $${band1Upper.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
              `-1σ: $${band1Lower.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
              `-2σ: $${band2Lower.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
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
  }, [isLogScale, showHalvings, showProjections]);

  // Build plugins array based on enabled features
  const plugins: Plugin<'line'>[] = [];
  if (showHalvings) {
    plugins.push(halvingPlugin);
  }
  if (showProjections && sampledProjections.length > 0) {
    plugins.push(projectionPlugin);
  }

  return (
    <div className="w-full h-[400px] md:h-[500px]">
      {/* Debug info banner (temporary) */}
      <div className="text-xs text-gray-500 mb-1">
        Data: {debugInfo.minDate} → {debugInfo.maxDate} |
        Halvings found: {halvingIndices.length}/4 |
        Show: {showHalvings ? 'ON' : 'OFF'}
        {showProjections && ` | Projection: ${sampledProjections.length} pts`}
      </div>
      <Line
        key={`price-chart-${showHalvings}-${showProjections}-${projectionData.length}`}
        ref={chartRef}
        data={chartData}
        options={options}
        plugins={plugins}
      />
    </div>
  );
}
