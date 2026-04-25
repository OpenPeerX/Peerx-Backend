import React, { useEffect, useState } from 'react';

interface InsuranceFund {
  id: number;
  balance: number;
  status: 'ACTIVE' | 'PAUSED' | 'DEPLETED';
  coverageRatio: number;
  totalPayouts: number;
  claimCount: number;
}

interface InsuranceClaim {
  id: number;
  claimAmount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  createdAt: string;
}

const InsuranceDashboard: React.FC = () => {
  const [fund, setFund] = useState<InsuranceFund | null>(null);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/insurance/fund/1').then((r) => r.json()),
      fetch('/api/insurance/claims?fundId=1').then((r) => r.json()),
    ])
      .then(([fundData, claimsData]) => {
        setFund(fundData);
        setClaims(claimsData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!fund) return <div>Fund not found</div>;

  return (
    <div className="insurance-dashboard">
      <h2>Insurance Fund</h2>
      <div className="fund-stats">
        <span>Balance: {fund.balance}</span>
        <span>Status: {fund.status}</span>
        <span>Coverage: {fund.coverageRatio}%</span>
        <span>Claims: {fund.claimCount}</span>
      </div>
      <h3>Recent Claims</h3>
      <ul>
        {claims.map((c) => (
          <li key={c.id}>
            #{c.id} — {c.claimAmount} — {c.status}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InsuranceDashboard;
