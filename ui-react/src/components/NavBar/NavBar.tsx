import React from 'react';

const NAV_TABS = ['dashboard', 'search', 'debug', 'settings'] as const;
type NavTab = (typeof NAV_TABS)[number];

interface NavBarProps {
  logo?: React.ReactNode;
  activeTab: NavTab;
}

const tabLabel = (tab: NavTab): string => {
  if (tab === 'dashboard') return 'Dashboard';
  if (tab === 'search') return 'Search';
  if (tab === 'debug') return 'Debug';
  return 'Settings';
};

export const NavBar: React.FC<NavBarProps> = ({logo, activeTab}) => {
  // CSS variables from variables.css
  const textColor = '#0f172a';
  const textMuted = '#64748b';
  const borderColor = '#e2e8f0';

  return (
    <header style={{
      height: 50,
      background: '#ffffff',
      borderBottom: `1px solid ${borderColor}`,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: '0 24px',
      gap: 12,
      flexShrink: 0,
    }}>
      {logo}
      <span style={{fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: textColor}}>
        qrec
      </span>
      <nav style={{marginLeft: 'auto', display: 'flex', gap: 4}}>
        {NAV_TABS.map((tab) => (
          <button
            key={tab}
            data-nav-search={tab === 'search' ? '' : undefined}
            style={{
              color: activeTab === tab ? textColor : textMuted,
              background: 'none',
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              padding: '5px 10px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </nav>
    </header>
  );
};
