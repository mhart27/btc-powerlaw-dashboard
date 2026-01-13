'use client';

import { useMemo } from 'react';
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
import { BBDSimulationResult, formatUsd, formatLtv } from '@/lib/bbd-simulator';
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

interface BBDChartsProps {
  result: BBDSimulationResult | null;
}

export default function BBDCharts({ result }: BBDChartsProps) {
  if (!result || result.steps.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        Configure simulation parameters above to see results
      </div>
    );
  }

  const { steps, config, summary } = result;

  // Sample data for performance if needed
  const sampleRate = Math.max(1, Math.floor(steps.length / 200));
  const sampledSteps = steps.filter((_, i) => i % sampleRate === 0 || i === steps.length - 1);

  const labels = sampledSteps.map(s => format(s.date, 'MMM yyyy'));

  // Liquidation indicator plugin
  const liquidationPlugin: Plugin<'line'> = useMemo(() => ({
    id: 'liquidationPlugin',
    afterDraw: (chart) => {
      if (!summary.isLiquidated || summary.liquidationMonth === null) return;

      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;

      // Find the index of liquidation in sampled data
      const liquidationSampledIdx = sampledSteps.findIndex(s => s.isLiquidated);
      if (liquidationSampledIdx === -1) return;

      const xPos = scales.x.getPixelForValue(liquidationSampledIdx);
      const { top, bottom } = chartArea;

      // Draw vertical line at liquidation
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = 'rgba(239, 68, 68, 1)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const labelText = 'LIQUIDATED';
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = 'rgba(31, 41, 55, 0.9)';
      ctx.fillRect(xPos - textWidth / 2 - 4, top + 5, textWidth + 8, 18);

      ctx.fillStyle = 'rgba(239, 68, 68, 1)';
      ctx.fillText(labelText, xPos, top + 18);
      ctx.restore();
    },
  }), [summary.isLiquidated, summary.liquidationMonth, sampledSteps]);

  // LTV Chart
  const ltvChartData = {
    labels,
    datasets: [
      {
        label: 'LTV',
        data: sampledSteps.map(s => s.ltv * 100),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.1,
      },
      {
        label: 'Liquidation Threshold',
        data: sampledSteps.map(() => config.liquidationLtvPercent),
        borderColor: 'rgba(239, 68, 68, 0.8)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        borderDash: [5, 5],
        fill: false,
      },
      {
        label: 'Danger Zone (70%+ of Liquidation)',
        data: sampledSteps.map(() => config.liquidationLtvPercent * 0.7),
        borderColor: 'rgba(249, 115, 22, 0.5)',
        backgroundColor: 'rgba(249, 115, 22, 0.05)',
        borderWidth: 1,
        pointRadius: 0,
        borderDash: [3, 3],
        fill: '+1',
      },
    ],
  };

  const ltvOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#e5e7eb' },
      },
      title: {
        display: true,
        text: 'Loan-to-Value (LTV) Over Time',
        color: '#e5e7eb',
        font: { size: 16 },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            if (value === null) return '';
            return `${context.dataset.label}: ${value.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af', maxTicksLimit: 12 },
        grid: { color: 'rgba(75, 85, 99, 0.3)' },
      },
      y: {
        min: 0,
        max: Math.max(config.liquidationLtvPercent + 10, ...sampledSteps.map(s => s.ltv * 100 + 5)),
        ticks: {
          color: '#9ca3af',
          callback: (value) => `${value}%`,
        },
        grid: { color: 'rgba(75, 85, 99, 0.3)' },
      },
    },
  };

  // Loan Balance Chart
  const loanChartData = {
    labels,
    datasets: [
      {
        label: 'Loan Balance',
        data: sampledSteps.map(s => s.loanBalance),
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.1,
      },
      {
        label: 'Collateral Value',
        data: sampledSteps.map(s => s.collateralValue),
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        borderDash: [5, 5],
        fill: false,
      },
    ],
  };

  const loanOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#e5e7eb' },
      },
      title: {
        display: true,
        text: 'Loan Balance vs Collateral Value',
        color: '#e5e7eb',
        font: { size: 16 },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            if (value === null) return '';
            return `${context.dataset.label}: ${formatUsd(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af', maxTicksLimit: 12 },
        grid: { color: 'rgba(75, 85, 99, 0.3)' },
      },
      y: {
        ticks: {
          color: '#9ca3af',
          callback: (value) => {
            if (typeof value === 'number') {
              if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
              return `$${value.toFixed(0)}`;
            }
            return value;
          },
        },
        grid: { color: 'rgba(75, 85, 99, 0.3)' },
      },
    },
  };

  // Net Equity Chart
  const equityChartData = {
    labels,
    datasets: [
      {
        label: 'Net Equity',
        data: sampledSteps.map(s => s.netEquity),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height);
          gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
          gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
          return gradient;
        },
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.1,
      },
    ],
  };

  const equityOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#e5e7eb' },
      },
      title: {
        display: true,
        text: 'Net Equity Over Time (Collateral - Loan)',
        color: '#e5e7eb',
        font: { size: 16 },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            if (value === null) return '';
            const idx = context.dataIndex * sampleRate;
            const step = steps[Math.min(idx, steps.length - 1)];
            return [
              `Net Equity: ${formatUsd(value)}`,
              `Collateral: ${formatUsd(step.collateralValue)}`,
              `Loan: ${formatUsd(step.loanBalance)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af', maxTicksLimit: 12 },
        grid: { color: 'rgba(75, 85, 99, 0.3)' },
      },
      y: {
        ticks: {
          color: '#9ca3af',
          callback: (value) => {
            if (typeof value === 'number') {
              if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
              if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}k`;
              return `$${value.toFixed(0)}`;
            }
            return value;
          },
        },
        grid: { color: 'rgba(75, 85, 99, 0.3)' },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* LTV Chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="h-[300px] md:h-[350px]">
          <Line
            data={ltvChartData}
            options={ltvOptions}
            plugins={[liquidationPlugin]}
          />
        </div>
      </div>

      {/* Loan Balance Chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="h-[300px] md:h-[350px]">
          <Line
            data={loanChartData}
            options={loanOptions}
            plugins={[liquidationPlugin]}
          />
        </div>
      </div>

      {/* Net Equity Chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="h-[300px] md:h-[350px]">
          <Line
            data={equityChartData}
            options={equityOptions}
            plugins={[liquidationPlugin]}
          />
        </div>
      </div>
    </div>
  );
}
