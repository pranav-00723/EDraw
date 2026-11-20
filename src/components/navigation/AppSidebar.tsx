/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Home,
  LayoutGrid,
  TrendingUp,
  Sparkles,
  BookOpen,
  BarChart3,
  Settings,
  Camera,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { AppRoute } from '../../types/modules';

export type SidebarSectionId =
  | 'dashboard'
  | 'points'
  | 'lines'
  | 'generator'
  | 'roadmap'
  | 'progress'
  | 'settings';

interface AppSidebarProps {
  activeSection: SidebarSectionId;
  onSelectSection: (section: SidebarSectionId, route?: AppRoute) => void;
  onOpenScanModal: () => void;
  onOpenSettings: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeSection,
  onSelectSection,
  onOpenScanModal,
  onOpenSettings,
  isMobileOpen,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const navItems: {
    id: SidebarSectionId;
    label: string;
    icon: React.ReactNode;
    route?: AppRoute;
  }[] = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: <Home className="w-[18px] h-[18px] shrink-0" />,
      route: '/dashboard',
    },
    {
      id: 'points',
      label: 'Projection of Points',
      icon: <LayoutGrid className="w-[18px] h-[18px] shrink-0" />,
      route: '/projection-of-points',
    },
    {
      id: 'lines',
      label: 'Projection of Straight Lines',
      icon: <TrendingUp className="w-[18px] h-[18px] shrink-0" />,
      route: '/projection-of-lines',
    },
    {
      id: 'generator',
      label: 'Question-to-Graphics Generator',
      icon: <Sparkles className="w-[18px] h-[18px] shrink-0" />,
      route: '/question-generator',
    },
    {
      id: 'roadmap',
      label: 'Syllabus Roadmap',
      icon: <BookOpen className="w-[18px] h-[18px] shrink-0" />,
      route: '/dashboard',
    },
    {
      id: 'progress',
      label: 'Learning Progress',
      icon: <BarChart3 className="w-[18px] h-[18px] shrink-0" />,
      route: '/dashboard',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-[18px] h-[18px] shrink-0" />,
    },
  ];

  const handleItemClick = (item: (typeof navItems)[number]) => {
    if (item.id === 'settings') {
      onOpenSettings();
      onCloseMobile();
      return;
    }
    onSelectSection(item.id, item.route);
    onCloseMobile();
  };

  const renderSidebarContent = (collapsed: boolean) => (
    <div
      className={`relative h-full w-full flex flex-col justify-between text-white rounded-[24px] select-none overflow-hidden shadow-[0_18px_40px_-14px_rgba(74,27,174,0.45)] transition-all duration-200 ${
        collapsed ? 'p-2.5' : 'p-4'
      }`}
      style={{
        background: 'linear-gradient(180deg, #7138E8 0%, #612AD6 58%, #4F1EC0 100%)',
      }}
    >
      {/* Subtle Wireframe Cube Watermark at Bottom */}
      <svg
        viewBox="0 0 180 180"
        className="pointer-events-none absolute -bottom-6 -left-4 w-48 h-48 text-white/[0.08]"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M90 18L154 54V126L90 162L26 126V54L90 18Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M90 18V90M90 90L154 126M90 90L26 126M26 54L90 90L154 54"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <circle cx="90" cy="90" r="4" fill="currentColor" />
      </svg>

      {/* Top Brand Logo Tile + Desktop Minimize/Expand Control */}
      <div className="relative z-10">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 pt-1 pb-4">
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Expand sidebar"
                aria-label="Expand sidebar"
                className="hidden lg:flex w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white items-center justify-center transition-colors cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onSelectSection('dashboard', '/dashboard');
                onCloseMobile();
              }}
              title="EDRAW Home"
              aria-label="EDRAW Home"
              className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#9565F5] to-[#5722C9] border border-white/25 shadow-[0_12px_28px_-6px_rgba(32,12,78,0.45)] flex items-center justify-center transition-transform duration-150 hover:scale-[1.04] cursor-pointer"
            >
              <svg
                viewBox="0 0 40 40"
                className="w-6 h-6 text-white"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 10L20 5L31 10V24L20 30L9 24V10Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeOpacity="0.95"
                />
                <path
                  d="M20 5V18M20 18L31 24M20 18L9 24"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeDasharray="2.5 2.5"
                />
                <circle cx="20" cy="18" r="3" fill="currentColor" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="relative flex items-center justify-between lg:justify-center pt-2 pb-5">
            <button
              type="button"
              onClick={() => {
                onSelectSection('dashboard', '/dashboard');
                onCloseMobile();
              }}
              className="flex flex-col items-center gap-2.5 group cursor-pointer focus-visible:outline-2 focus-visible:outline-white rounded-2xl px-2"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#9565F5] to-[#5722C9] border border-white/25 shadow-[0_12px_28px_-6px_rgba(32,12,78,0.45)] flex items-center justify-center transition-transform duration-150 group-hover:scale-[1.03]">
                <svg
                  viewBox="0 0 40 40"
                  className="w-8 h-8 text-white"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M9 10L20 5L31 10V24L20 30L9 24V10Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeOpacity="0.95"
                  />
                  <path
                    d="M20 5V18M20 18L31 24M20 18L9 24"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeDasharray="2.5 2.5"
                  />
                  <circle cx="20" cy="18" r="3" fill="currentColor" />
                </svg>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold tracking-wider text-white leading-none">
                  EDRAW
                </div>
                <div className="text-[11px] text-white/80 font-medium mt-1 leading-tight">
                  Engineering Graphics
                </div>
              </div>
            </button>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Minimize sidebar"
                aria-label="Minimize sidebar"
                className="hidden lg:flex absolute top-0 right-0 w-8 h-8 rounded-xl bg-white/12 hover:bg-white/24 text-white/90 hover:text-white items-center justify-center transition-colors cursor-pointer"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="mt-1 flex flex-col gap-1" aria-label="Main Navigation">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
                className={`relative w-full flex items-center transition-all duration-150 cursor-pointer rounded-xl ${
                  collapsed
                    ? 'justify-center px-0 py-2.5'
                    : 'gap-3 px-3.5 py-2.5 text-[13px] leading-snug text-left'
                } ${
                  isActive
                    ? 'bg-white/20 text-white font-semibold shadow-xs backdrop-blur-xs'
                    : 'text-white/80 hover:text-white hover:bg-white/10 font-medium'
                }`}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-white"
                    aria-hidden="true"
                  />
                )}
                <span className={isActive ? 'text-white' : 'text-white/80'}>
                  {item.icon}
                </span>
                {!collapsed && <span className="leading-tight">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Quick Problem Scan Action Card */}
      {collapsed ? (
        <div className="relative z-10 mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => {
              onOpenScanModal();
              onCloseMobile();
            }}
            title="Quick Problem Scan"
            aria-label="Quick Problem Scan"
            className="w-11 h-11 rounded-2xl bg-white hover:bg-[#F1EBFF] text-[#7138E8] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative z-10 mt-5 rounded-2xl bg-white/14 border border-white/20 backdrop-blur-md p-3.5">
          <div className="text-xs font-bold text-white text-center">
            Quick Problem Scan
          </div>
          <p className="text-[11px] text-white/75 text-center mt-0.5 font-mono">
            BIS SP 46 · 1st Angle
          </p>

          <button
            type="button"
            onClick={() => {
              onOpenScanModal();
              onCloseMobile();
            }}
            className="mt-2.5 w-full py-2 px-3 rounded-xl bg-white hover:bg-[#F1EBFF] text-[#7138E8] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan Question</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 p-3 pr-0 transition-[width] duration-200 ${
          isCollapsed ? 'w-[80px]' : 'w-[232px] xl:w-[244px]'
        }`}
      >
        <div className="sticky top-3 h-[calc(100vh-1.5rem)] max-h-[920px]">
          {renderSidebarContent(isCollapsed)}
        </div>
      </aside>

      {/* Mobile & Tablet Slide-over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#202044]/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[265px] max-w-[82vw] h-full p-3">
            {renderSidebarContent(false)}
          </div>
        </div>
      )}
    </>
  );
};
