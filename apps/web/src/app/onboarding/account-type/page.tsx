'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type AccountType = 'freelancer' | 'business' | 'personal' | null;

interface AccountTypeOption {
  id: AccountType;
  title: string;
  description: string;
  icon: string;
}

const accountTypes: AccountTypeOption[] = [
  {
    id: 'freelancer',
    title: 'Freelancer',
    description: 'Para autónomos y profesionales. Gestiona IRPF e IVA.',
    icon: '👤',
  },
  {
    id: 'business',
    title: 'Business',
    description: 'Para Sociedades (S.L.) y Startups. Gestión fiscal completa.',
    icon: '🏢',
  },
  {
    id: 'personal',
    title: 'Personal',
    description: 'Uso personal. Sin facturación ni gestión fiscal.',
    icon: '💼',
  },
];

export default function AccountTypePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<AccountType>(null);

  const handleContinue = () => {
    if (!selected) return;
    localStorage.setItem('kyros_account_type', selected);
    router.push(`/onboarding/config/${selected}`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">¿Cómo usarás Kyros?</h1>
        <p className="text-gray-400">
          Selecciona el tipo de cuenta que mejor se adapte a ti
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {accountTypes.map((type) => (
          <div
            key={type.id}
            onClick={() => setSelected(type.id)}
            className={`
              p-4 rounded-lg cursor-pointer transition-all duration-200
              border-2 ${
                selected === type.id
                  ? 'border-cyan-400 bg-gray-800'
                  : 'border-gray-700 bg-gray-900 hover:bg-gray-800'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <span className="text-3xl">{type.icon}</span>
                <div className="text-left">
                  <h3 className="text-lg font-semibold">{type.title}</h3>
                  <p className="text-sm text-gray-400">{type.description}</p>
                </div>
              </div>
              <div
                className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center
                  ${
                    selected === type.id
                      ? 'border-cyan-400 bg-cyan-400'
                      : 'border-gray-600'
                  }
                `}
              >
                {selected === type.id && (
                  <span className="text-gray-900 text-sm">✓</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Button */}
      <Button
        variant="primary"
        size="lg"
        onClick={handleContinue}
        disabled={!selected}
      >
        Continuar
      </Button>

      {/* Footer */}
      <p className="text-sm text-gray-600 text-center">
        Podrás cambiar el tipo de cuenta más adelante en la configuración
      </p>
    </div>
  );
}