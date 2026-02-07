'use client';

import { useState, useEffect } from 'react';
import { BBDSimulatorConfig, PriceScenario, InterestMode, BorrowFrequency, getScenarioLabel } from '@/lib/bbd-simulator';

// Scenario presets
const SCENARIOS = {
  conservative: {
    btcHeld: 1,
    monthlySpendingUsd: 1500,
    interestAprPercent: 5,
    liquidationLtvPercent: 30,
    projectionYears: 20,
  },
  balanced: {
    btcHeld: 2,
    monthlySpendingUsd: 3000,
    interestAprPercent: 7,
    liquidationLtvPercent: 40,
    projectionYears: 20,
  },
  aggressive: {
    btcHeld: 5,
    monthlySpendingUsd: 10000,
    interestAprPercent: 9,
    liquidationLtvPercent: 60,
    projectionYears: 20,
  },
} as const;

type ScenarioKey = keyof typeof SCENARIOS;

interface BBDControlsProps {
  config: BBDSimulatorConfig;
  onConfigChange: (config: BBDSimulatorConfig) => void;
  btcHeld: number;
  onBtcHeldChange: (value: number) => void;
  onReset: () => void;
}

export default function BBDControls({
  config,
  onConfigChange,
  btcHeld,
  onBtcHeldChange,
  onReset,
}: BBDControlsProps) {
  // BTC held input handling (same as main dashboard)
  const [btcHeldInput, setBtcHeldInput] = useState(() => btcHeld > 0 ? String(btcHeld) : '');

  // Spending step-up input state
  const [stepYear, setStepYear] = useState(2);
  const [stepAmount, setStepAmount] = useState('');

  // String-based states for numeric inputs to fix "sticky first digit" bug
  const [monthlySpendingInput, setMonthlySpendingInput] = useState(() => String(config.monthlySpendingUsd));
  const [interestAprInput, setInterestAprInput] = useState(() => String(config.interestAprPercent));
  const [liquidationLtvInput, setLiquidationLtvInput] = useState(() => String(config.liquidationLtvPercent));
  const [projectionYearsInput, setProjectionYearsInput] = useState(() => String(config.projectionYears));

  useEffect(() => {
    setBtcHeldInput(btcHeld > 0 ? String(btcHeld) : '');
  }, [btcHeld]);

  // Sync string inputs when config changes externally (e.g., reset)
  useEffect(() => {
    setMonthlySpendingInput(String(config.monthlySpendingUsd));
  }, [config.monthlySpendingUsd]);

  useEffect(() => {
    setInterestAprInput(String(config.interestAprPercent));
  }, [config.interestAprPercent]);

  useEffect(() => {
    setLiquidationLtvInput(String(config.liquidationLtvPercent));
  }, [config.liquidationLtvPercent]);

  useEffect(() => {
    setProjectionYearsInput(String(config.projectionYears));
  }, [config.projectionYears]);

  const handleBtcHeldInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setBtcHeldInput(value);
      const numValue = parseFloat(value);
      onBtcHeldChange(isNaN(numValue) || numValue < 0 ? 0 : numValue);
    }
  };

  const handleBtcHeldBlur = () => {
    const numValue = parseFloat(btcHeldInput);
    if (isNaN(numValue) || numValue <= 0) {
      setBtcHeldInput('');
      onBtcHeldChange(0);
    } else {
      const cleaned = btcHeldInput.replace(/\.$/, '');
      setBtcHeldInput(cleaned);
    }
  };

  // Generic handler for numeric string inputs (allows empty and valid number patterns)
  const handleNumericInputChange = (
    value: string,
    setter: (val: string) => void,
    allowDecimal: boolean = true
  ) => {
    const pattern = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
    if (value === '' || pattern.test(value)) {
      setter(value);
    }
  };

  // Blur handlers that parse, clamp, and update config
  const handleMonthlySpendingBlur = () => {
    const numValue = parseFloat(monthlySpendingInput);
    const clamped = isNaN(numValue) ? 0 : Math.max(0, numValue);
    setMonthlySpendingInput(String(clamped));
    updateConfig({ monthlySpendingUsd: clamped });
  };

  const handleInterestAprBlur = () => {
    const numValue = parseFloat(interestAprInput);
    const clamped = isNaN(numValue) ? 0 : Math.max(0, numValue);
    setInterestAprInput(String(clamped));
    updateConfig({ interestAprPercent: clamped });
  };

  const handleLiquidationLtvBlur = () => {
    const numValue = parseFloat(liquidationLtvInput);
    const clamped = isNaN(numValue) ? 1 : Math.max(1, Math.min(100, numValue));
    setLiquidationLtvInput(String(clamped));
    updateConfig({ liquidationLtvPercent: clamped });
  };

  const handleProjectionYearsBlur = () => {
    const numValue = parseInt(projectionYearsInput, 10);
    const clamped = isNaN(numValue) ? 1 : Math.max(1, Math.min(30, numValue));
    setProjectionYearsInput(String(clamped));
    updateConfig({ projectionYears: clamped });
  };

  const updateConfig = (updates: Partial<BBDSimulatorConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  // Apply a scenario preset - updates both config and string input states
  const applyScenario = (scenarioKey: ScenarioKey) => {
    const scenario = SCENARIOS[scenarioKey];
    // Update string states immediately for UI
    setBtcHeldInput(String(scenario.btcHeld));
    setMonthlySpendingInput(String(scenario.monthlySpendingUsd));
    setInterestAprInput(String(scenario.interestAprPercent));
    setLiquidationLtvInput(String(scenario.liquidationLtvPercent));
    setProjectionYearsInput(String(scenario.projectionYears));
    // Update numeric states
    onBtcHeldChange(scenario.btcHeld);
    onConfigChange({
      ...config,
      monthlySpendingUsd: scenario.monthlySpendingUsd,
      interestAprPercent: scenario.interestAprPercent,
      liquidationLtvPercent: scenario.liquidationLtvPercent,
      projectionYears: scenario.projectionYears,
      spendingSteps: [],
    });
  };

  const scenarios: PriceScenario[] = ['fair', 'plus1sigma', 'plus2sigma', 'minus1sigma', 'minus2sigma'];

  return (
    <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Simulator Configuration</h2>
        <button
          onClick={onReset}
          className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded border border-gray-600 hover:border-gray-500 transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      {/* Scenario Presets */}
      <div className="mb-4 pb-4 border-b border-gray-700">
        <label className="text-sm text-gray-400 block mb-2">Scenarios</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyScenario('conservative')}
            className="px-4 py-1.5 text-sm rounded border border-green-600 text-green-400 hover:bg-green-600 hover:text-white transition-colors"
          >
            Conservative
          </button>
          <button
            onClick={() => applyScenario('balanced')}
            className="px-4 py-1.5 text-sm rounded border border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors"
          >
            Balanced
          </button>
          <button
            onClick={() => applyScenario('aggressive')}
            className="px-4 py-1.5 text-sm rounded border border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white transition-colors"
          >
            Aggressive
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* BTC Held */}
        <div className="flex flex-col gap-1">
          <label htmlFor="bbd-btcHeld" className="text-sm text-gray-400">
            BTC Held
          </label>
          <input
            type="text"
            inputMode="decimal"
            id="bbd-btcHeld"
            value={btcHeldInput}
            onChange={handleBtcHeldInputChange}
            onBlur={handleBtcHeldBlur}
            className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-orange-500 focus:outline-none"
            placeholder="0"
          />
          <p className="text-xs text-gray-500">Typical range: 0.5–5 BTC</p>
        </div>

        {/* Start Date */}
        <div className="flex flex-col gap-1">
          <label htmlFor="startDate" className="text-sm text-gray-400">
            Start Date
          </label>
          <input
            type="month"
            id="startDate"
            value={config.startDate}
            onChange={(e) => updateConfig({ startDate: e.target.value })}
            className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            min="2010-07"
            max="2050-12"
          />
        </div>

        {/* Monthly Spending */}
        <div className="flex flex-col gap-1">
          <label htmlFor="monthlySpending" className="text-sm text-gray-400">
            Monthly Spending (USD)
          </label>
          <input
            type="text"
            inputMode="decimal"
            id="monthlySpending"
            value={monthlySpendingInput}
            onChange={(e) => handleNumericInputChange(e.target.value, setMonthlySpendingInput)}
            onBlur={handleMonthlySpendingBlur}
            className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            placeholder="0"
          />
          <p className="text-xs text-gray-500">Example: $1,000–$10,000 / month</p>
        </div>

        {/* Spending Step-Ups */}
        <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-4">
          <label className="text-sm text-gray-400">Spending Step-Ups</label>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Start in Year</span>
              <input
                type="number"
                value={stepYear}
                onChange={(e) => setStepYear(Math.max(2, Math.min(config.projectionYears, parseInt(e.target.value, 10) || 2)))}
                className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none w-24"
                min={2}
                max={config.projectionYears}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">New $/mo</span>
              <input
                type="text"
                inputMode="numeric"
                value={stepAmount}
                onChange={(e) => {
                  if (e.target.value === '' || /^\d*$/.test(e.target.value)) {
                    setStepAmount(e.target.value);
                  }
                }}
                className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none w-32"
                placeholder="e.g. 50000"
              />
            </div>
            <button
              onClick={() => {
                const amount = parseInt(stepAmount, 10);
                if (isNaN(amount) || amount <= 0) return;
                if (stepYear < 2 || stepYear > config.projectionYears) return;
                const filtered = config.spendingSteps.filter(s => s.startYear !== stepYear);
                updateConfig({ spendingSteps: [...filtered, { startYear: stepYear, monthlySpendingUsd: amount }] });
                setStepAmount('');
              }}
              className="px-4 py-2 text-sm rounded border border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors whitespace-nowrap"
            >
              + Add step
            </button>
          </div>
          {config.spendingSteps.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {[...config.spendingSteps]
                .sort((a, b) => a.startYear - b.startYear)
                .map((step) => (
                  <span
                    key={step.startYear}
                    className="inline-flex items-center gap-1.5 bg-gray-700 text-gray-300 text-sm px-3 py-1 rounded"
                  >
                    Year {step.startYear} &rarr; ${step.monthlySpendingUsd.toLocaleString()}/mo
                    <button
                      onClick={() => updateConfig({ spendingSteps: config.spendingSteps.filter(s => s.startYear !== step.startYear) })}
                      className="text-gray-500 hover:text-red-400 ml-1"
                      title="Remove step"
                    >
                      &times;
                    </button>
                  </span>
                ))}
            </div>
          )}
          <p className="text-xs text-gray-500">Year 1 uses the base spending above.</p>
        </div>

        {/* Interest APR */}
        <div className="flex flex-col gap-1">
          <label htmlFor="interestApr" className="text-sm text-gray-400">
            Interest APR (%)
          </label>
          <input
            type="text"
            inputMode="decimal"
            id="interestApr"
            value={interestAprInput}
            onChange={(e) => handleNumericInputChange(e.target.value, setInterestAprInput)}
            onBlur={handleInterestAprBlur}
            className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            placeholder="0"
          />
          <p className="text-xs text-gray-500">Common range: 4%–10%</p>
        </div>

        {/* Liquidation LTV */}
        <div className="flex flex-col gap-1">
          <label htmlFor="liquidationLtv" className="text-sm text-gray-400">
            Liquidation LTV (%)
          </label>
          <input
            type="text"
            inputMode="numeric"
            id="liquidationLtv"
            value={liquidationLtvInput}
            onChange={(e) => handleNumericInputChange(e.target.value, setLiquidationLtvInput, false)}
            onBlur={handleLiquidationLtvBlur}
            className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            placeholder="80"
          />
          <p className="text-xs text-gray-500">Lower = safer · Higher = more leverage</p>
        </div>

        {/* Projection Horizon */}
        <div className="flex flex-col gap-1">
          <label htmlFor="projectionYears" className="text-sm text-gray-400">
            Projection Horizon (years)
          </label>
          <input
            type="text"
            inputMode="numeric"
            id="projectionYears"
            value={projectionYearsInput}
            onChange={(e) => handleNumericInputChange(e.target.value, setProjectionYearsInput, false)}
            onBlur={handleProjectionYearsBlur}
            className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
            placeholder="20"
          />
          <p className="text-xs text-gray-500">Typical: 10–30 years</p>
        </div>

        {/* Price Scenario */}
        <div className="flex flex-col gap-1">
          <label htmlFor="scenario" className="text-sm text-gray-400">
            Price Scenario
          </label>
          <select
            id="scenario"
            value={config.scenario}
            onChange={(e) => updateConfig({ scenario: e.target.value as PriceScenario })}
            className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {scenarios.map((scenario) => (
              <option key={scenario} value={scenario}>
                {getScenarioLabel(scenario)}
              </option>
            ))}
          </select>
        </div>

        {/* Interest Mode */}
        <div className="flex flex-col gap-1">
          <label htmlFor="interestMode" className="text-sm text-gray-400">
            Interest Mode
          </label>
          <select
            id="interestMode"
            value={config.interestMode}
            onChange={(e) => updateConfig({ interestMode: e.target.value as InterestMode })}
            className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="capitalize">Capitalize Interest</option>
            <option value="pay_monthly">Pay Interest Monthly</option>
          </select>
        </div>

        {/* Starting LTV or Borrow Monthly Toggle */}
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Borrow Strategy</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.borrowMonthly}
                onChange={(e) => updateConfig({
                  borrowMonthly: e.target.checked,
                  startingLtvPercent: e.target.checked ? null : 20,
                })}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
              <span className="text-sm text-gray-300">Borrow to Fund Spending</span>
            </label>
          </div>
        </div>

        {/* Borrow Frequency (only shown when borrow to fund spending is ON) */}
        {config.borrowMonthly && (
          <div className="flex flex-col gap-1">
            <label htmlFor="borrowFrequency" className="text-sm text-gray-400">
              Borrow Frequency
            </label>
            <select
              id="borrowFrequency"
              value={config.borrowFrequency}
              onChange={(e) => updateConfig({ borrowFrequency: e.target.value as BorrowFrequency })}
              className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        )}
      </div>

      {/* Starting LTV (only shown when not in borrow monthly mode) */}
      {!config.borrowMonthly && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex flex-col gap-1 max-w-xs">
            <label htmlFor="startingLtv" className="text-sm text-gray-400">
              Starting LTV (%)
            </label>
            <input
              type="number"
              id="startingLtv"
              value={config.startingLtvPercent ?? 20}
              onChange={(e) => updateConfig({
                startingLtvPercent: Math.max(1, Math.min(config.liquidationLtvPercent - 1, Number(e.target.value))),
              })}
              className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              min="1"
              max={config.liquidationLtvPercent - 1}
              step="1"
            />
            <p className="text-xs text-gray-500">
              Initial loan will be {config.startingLtvPercent ?? 20}% of collateral value
            </p>
          </div>
        </div>
      )}

      {/* Strategy explanation */}
      <div className="mt-4 text-sm text-gray-500">
        {config.borrowMonthly ? (
          <p>
            <strong>Borrow {config.borrowFrequency === 'monthly' ? 'Monthly' : 'Yearly'}:</strong>{' '}
            {config.borrowFrequency === 'monthly'
              ? `Each month, borrow $${config.monthlySpendingUsd.toLocaleString()} against your BTC collateral to fund spending.`
              : `Once per year, borrow $${(config.monthlySpendingUsd * 12).toLocaleString()} (12x monthly) against your BTC collateral.`}
            {config.interestMode === 'capitalize'
              ? ' Interest accrues monthly and adds to your loan balance.'
              : ' You pay interest separately each month.'}
          </p>
        ) : (
          <p>
            <strong>Lump Sum:</strong> Take an initial loan at {config.startingLtvPercent ?? 20}% LTV.
            {config.interestMode === 'capitalize'
              ? ' Interest accrues and adds to your loan balance over time.'
              : ' You pay interest separately each month, keeping the balance stable.'}
          </p>
        )}
      </div>
    </div>
  );
}
