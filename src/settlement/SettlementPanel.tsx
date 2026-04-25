import React, { useEffect, useState } from 'react';

interface Settlement {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

interface FXRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
}

const SettlementPanel: React.FC = () => {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [rates, setRates] = useState<FXRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/settlement?limit=10').then((r) => r.json()),
      fetch('/api/settlement/fx-rates/active').then((r) => r.json()),
    ])
      .then(([s, r]) => {
        setSettlements(s);
        setRates(r);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="settlement-panel">
      <h2>Settlement Engine</h2>
      <h3>FX Rates</h3>
      <ul>
        {rates.map((r) => (
          <li key={`${r.fromCurrency}-${r.toCurrency}`}>
            {r.fromCurrency}/{r.toCurrency}: {r.rate}
          </li>
        ))}
      </ul>
      <h3>Recent Settlements</h3>
      <ul>
        {settlements.map((s) => (
          <li key={s.id}>
            {s.amount} {s.fromCurrency} → {s.convertedAmount} {s.toCurrency} [{s.status}]
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SettlementPanel;
