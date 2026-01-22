'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type AccountType = 'freelancer' | 'business' | 'personal';
type IRPFRate = 7 | 15;
type VATRegime = 'general' | 'reduced' | 'exempt';

const ConfigPage = () => {
  const router = useRouter();
  const params = useParams();
  const accountType = (params.type as AccountType) || 'freelancer';

  // For MVP: Only support freelancer config
  if (accountType !== 'freelancer') {
    return <SimpleBusinessConfig />;
  }

  return <FreelancerConfigForm />;
};

/**
 * Freelancer Configuration (Image 4)
 */
const FreelancerConfigForm = () => {
  const router = useRouter();
  const [config, setConfig] = useState({
    irpfRate: 15 as IRPFRate,
    applyIRPFByDefault: true,
    vatRegime: 'general' as VATRegime,
    autoSaveProfit: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('kyros_config', JSON.stringify(config));
    router.push('/dashboard');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-800 mb-4">
          <span className="text-xl">📄</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">Configuración Freelancer</h1>
        <p className="text-gray-400">Ajusta tu configuración fiscal para facturación</p>
      </div>

      {/* IRPF Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Retención en Facturas (IRPF)</h3>
          <button
            type="button"
            className="text-cyan-400 text-sm font-semibold cursor-help"
          >
            ℹ️ Help me choose
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 7 as IRPFRate, label: '7%', hint: 'Nuevo Autónomo' },
            { value: 15 as IRPFRate, label: '15%', hint: 'General' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, irpfRate: option.value }))}
              className={`
                p-3 rounded-lg font-semibold transition-all
                ${
                  config.irpfRate === option.value
                    ? 'bg-cyan-400 text-gray-900'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                }
              `}
            >
              {option.label}
              <span className="block text-xs opacity-75">{option.hint}</span>
            </button>
          ))}
        </div>

        <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={config.applyIRPFByDefault}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, applyIRPFByDefault: e.target.checked }))
            }
            className="w-5 h-5 accent-cyan-400"
          />
          <span>Aplicar IRPF a facturas por defecto</span>
        </label>
      </div>

      {/* VAT Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold">Régimen de IVA</h3>
        <select
          value={config.vatRegime}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, vatRegime: e.target.value as VATRegime }))
          }
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
        >
          <option value="general">General (21%) - IVA aplicado en facturas</option>
          <option value="reduced">Reducido (10%)</option>
          <option value="exempt">Exento (0%)</option>
        </select>
      </div>

      {/* Quarterly Payment Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <h3 className="text-lg font-semibold">Pago Trimestral (Modelo 130)</h3>
            <p className="text-sm text-gray-400">
              Auto-guardar 20% del beneficio
            </p>
            <span className="inline-block mt-2 px-2 py-1 text-xs bg-cyan-400/20 text-cyan-400 rounded">
              Recomendado
            </span>
          </div>
          <input
            type="checkbox"
            checked={config.autoSaveProfit}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, autoSaveProfit: e.target.checked }))
            }
            className="w-6 h-6 accent-cyan-400"
          />
        </label>
      </div>

      {/* Buttons */}
      <Button variant="primary" size="lg">
        Completar Configuración
      </Button>

      <p className="text-sm text-gray-600 text-center">
        Puedes modificar estos ajustes en cualquier momento desde la configuración
      </p>
    </form>
  );
};

/**
 * Simple Business Config (Placeholder)
 */
const SimpleBusinessConfig = () => {
  const router = useRouter();

  return (
    <div className="text-center space-y-6">
      <h1 className="text-2xl font-bold">Configuración Business</h1>
      <p className="text-gray-400">
        La configuración completa para empresas estará disponible en Phase 2.
      </p>
      <Button
        variant="primary"
        size="lg"
        onClick={() => router.push('/dashboard')}
      >
        Ir al Dashboard
      </Button>
    </div>
  );
};

export default ConfigPage;
