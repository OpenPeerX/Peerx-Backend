import React, { useEffect, useState } from 'react';

interface MobileDashboard {
  generatedAt: string;
  governance: { activeProposalCount: number; recent: unknown[] };
  options: { positions: unknown[] };
  liquidity: unknown;
}

interface PrivacyProfile {
  userId: number;
  pseudonymousMode: boolean;
  encryptedOrdersEnabled: boolean;
}

const MobileApp: React.FC<{ userId: number }> = ({ userId }) => {
  const [dashboard, setDashboard] = useState<MobileDashboard | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/mobile/dashboard/${userId}`, {
        headers: { 'Accept-Encoding': 'gzip' },
      }).then((r) => r.json()),
      fetch(`/privacy/profile/${userId}`).then((r) => r.json()),
    ])
      .then(([d, p]) => {
        setDashboard(d);
        setPrivacy(p);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (!dashboard) return <div>No data</div>;

  return (
    <div className="mobile-app">
      <h2>Mobile Dashboard</h2>
      <p>Active Proposals: {dashboard.governance.activeProposalCount}</p>
      <p>Options Positions: {(dashboard.options.positions as unknown[]).length}</p>
      {privacy && (
        <div className="privacy-status">
          <h3>Privacy</h3>
          <p>Pseudonymous: {privacy.pseudonymousMode ? 'On' : 'Off'}</p>
          <p>Encrypted Orders: {privacy.encryptedOrdersEnabled ? 'On' : 'Off'}</p>
        </div>
      )}
      <p className="timestamp">Updated: {dashboard.generatedAt}</p>
    </div>
  );
};

export default MobileApp;
