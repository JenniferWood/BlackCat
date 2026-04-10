import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { path: '/', label: '首页', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { path: '/gallery', label: '素材库', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { path: '/compose', label: '创作', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          className={`tab-bar-item${location.pathname === tab.path ? ' active' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d={tab.icon} />
          </svg>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
