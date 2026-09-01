import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Droplets,
  ClipboardList,
  Package,
  Users,
  Activity,
  Bell,
  ShieldCheck,
  BarChart3,
  FileClock,
  LogOut,
  HeartHandshake,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export function Sidebar({ isOpen, onClose }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const getNavSections = () => {
    if (!user) {
      return [
        {
          title: 'Portal',
          links: [{ label: 'Sign In', path: '/login', icon: <Users className="sidebar-nav-icon" /> }],
        },
      ];
    }

    switch (user.role) {
      case 'HOSPITAL':
        return [
          {
            title: 'Coordination',
            links: [
              { label: 'Dashboard', path: '/hospital', icon: <LayoutDashboard className="sidebar-nav-icon" />, end: true },
              { label: 'Create Request', path: '/hospital/requests/new', icon: <Droplets className="sidebar-nav-icon" /> },
              { label: 'My Requests', path: '/hospital/requests', icon: <ClipboardList className="sidebar-nav-icon" /> },
            ],
          },
          {
            title: 'Facility Settings',
            links: [
              { label: 'Hospital Profile', path: '/hospital/profile', icon: <Building2 className="sidebar-nav-icon" /> },
            ],
          },
        ];

      case 'BLOOD_BANK':
        return [
          {
            title: 'Operations',
            links: [
              { label: 'Inventory', path: '/blood-bank/inventory', icon: <Package className="sidebar-nav-icon" /> },
              { label: 'Incoming Requests', path: '/blood-bank/requests', icon: <Droplets className="sidebar-nav-icon" /> },
              { label: 'My Allocations', path: '/blood-bank/allocations', icon: <ClipboardList className="sidebar-nav-icon" /> },
            ],
          },
          {
            title: 'Facility Settings',
            links: [
              { label: 'Blood Bank Profile', path: '/blood-bank/profile', icon: <Building2 className="sidebar-nav-icon" /> },
            ],
          },
        ];

      case 'DONOR':
        return [
          {
            title: 'Donor Portal',
            links: [
              { label: 'Dashboard', path: '/donor', icon: <LayoutDashboard className="sidebar-nav-icon" />, end: true },
              { label: 'Emergency Alerts', path: '/donor/alerts', icon: <Bell className="sidebar-nav-icon" /> },
              { label: 'My Pledges', path: '/donor/pledges', icon: <ShieldCheck className="sidebar-nav-icon" /> },
            ],
          },
          {
            title: 'Donor Profile',
            links: [
              { label: 'Availability', path: '/donor/availability', icon: <Activity className="sidebar-nav-icon" /> },
              { label: 'Profile Details', path: '/donor/profile', icon: <Users className="sidebar-nav-icon" /> },
            ],
          },
        ];

      case 'ADMIN':
        return [
          {
            title: 'Governance & Metrics',
            links: [
              { label: 'Organizations', path: '/admin/organizations', icon: <ShieldCheck className="sidebar-nav-icon" /> },
              { label: 'Operational Metrics', path: '/admin/metrics', icon: <BarChart3 className="sidebar-nav-icon" /> },
              { label: 'Audit Logs', path: '/admin/audit-logs', icon: <FileClock className="sidebar-nav-icon" /> },
              { label: 'Surge Surveillance', path: '/admin/surge', icon: <Activity className="sidebar-nav-icon" /> },
            ],
          },
        ];

      default:
        return [];
    }
  };

  const sections = getNavSections();
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'US';

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <Link to="/" className="sidebar-brand" onClick={onClose}>
          <div className="brand-icon-wrapper">
            <HeartHandshake size={20} />
          </div>
          <div className="brand-info">
            <span className="brand-name">BloodLink</span>
            <span className="brand-tagline">Emergency Sourcing</span>
          </div>
        </Link>

        <div className="sidebar-nav-container">
          {sections.map((section, idx) => (
            <div key={idx} className="sidebar-section">
              <div className="sidebar-section-title">{section.title}</div>
              <ul className="sidebar-nav-list">
                {section.links.map((link) => (
                  <li key={link.path}>
                    <NavLink
                      to={link.path}
                      end={link.end}
                      className={({ isActive }) =>
                        `sidebar-nav-item ${isActive ? 'active' : ''}`
                      }
                      onClick={onClose}
                    >
                      {link.icon}
                      <span>{link.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {isAuthenticated && user && (
          <div className="sidebar-footer">
            <div className="sidebar-user-card">
              <div className="user-avatar">{initials}</div>
              <div className="user-details">
                <span className="user-email" title={user.email}>
                  {user.email}
                </span>
                <span className="user-role-badge">{user.role}</span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                color: '#94A3B8',
                marginTop: 'var(--space-2)',
              }}
              onClick={handleSignOut}
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
