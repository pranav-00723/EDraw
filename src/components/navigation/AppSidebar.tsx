/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Home,
  Compass,
  Ruler,
  FileText,
  BookOpen,
  BarChart3,
  Settings,
  Camera,
  X,
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
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeSection,
  onSelectSection,
  onOpenScanModal,
  onOpenSettings,
  isMobileOpen,
  onCloseMobile,
}) => {
  const navItems: {
    id: SidebarSectionId;
    label: string;
    icon: React.ReactNode;
    route?: AppRoute;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home className="w-[18px] h-[18px] shrink-0" />,
      route: '/dashboard',
    },
    {
      id: 'points',
      label: 'Projection of Points',
      icon: <Compass className="w-[18px] h-[18px] shrink-0" />,
      route: '/projection-of-points',
    },
    {
      id: 'lines',
      label: 'Straight Lines',
      icon: <Ruler className="w-[18px] h-[18px] shrink-0" />,
      route: '/projection-of-lines',
    },
    {
      id: 'generator',
      label: 'Question Generator',
      icon: <FileText className="w-[18px] h-[18px] shrink-0" />,
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

  const sidebarContent = (
    <div
      className="h-full w-full flex flex-col justify-between p-4 text-white rounded-[24px] select-none"
      style={{
        background: 'linear-gradient(180deg, #7952D6 0%, #6035B5 100%)',
      }}
    >
      {/* Top Brand Logo Tile */}
      <div>
        <div className="flex items-center justify-between lg:justify-center pt-2 pb-5">
          <button
            type="button"
            onClick={() => {
              onSelectSection('dashboard', '/dashboard');
              onCloseMobile();
            }}
            className="flex flex-col items-center gap-2.5 group cursor-pointer focus-visible:outline-2 focus-visible:outline-white rounded-2xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8D68E8] to-[#572CA8] border border-white/25 shadow-[0_12px_28px_-6px_rgba(32,12,78,0.45)] flex items-center justify-center transition-transform duration-150 group-hover:scale-[1.03]">
              {/* Geometric Orthographic Planes & Compass Mark */}
              <svg
                viewBox="0 0 40 40"
                className="w-9 h-9 text-white"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 10L20 5L31 10V24L20 30L9 24V10Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeOpacity="0.9"
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
              <div className="text-lg font-extrabold tracking-tight text-white leading-none">
                EDRAW
              </div>
              <div className="text-[11px] text-white/75 font-medium mt-1">
                Engineering Graphics
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="mt-2 flex flex-col gap-1" aria-label="Main Navigation">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] transition-colors duration-150 cursor-pointer text-left ${
                  isActive
                    ? 'bg-white/16 text-white font-semibold shadow-xs'
                    : 'text-white/75 hover:text-white hover:bg-white/10 font-medium'
                }`}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-white"
                    aria-hidden="true"
                  />
                )}
                <span className={isActive ? 'text-white' : 'text-white/75'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Quick Problem Scan Card (matching reference sidebar widget) */}
      <div className="mt-6 rounded-2xl bg-white dark:bg-slate-900 text-[#202033] dark:text-slate-100 p-3.5 shadow-[0_12px_30px_-8px_rgba(32,12,78,0.35)]">
        <div className="text-xs font-bold text-[#202033] dark:text-slate-100 text-center">
          Quick Problem Scan
        </div>
        <p className="text-[11px] text-[#77758A] dark:text-slate-400 text-center mt-0.5 font-mono">
          BIS SP 46 · 1st Angle
        </p>

        {/* Minimal 3D Drafting Planes Mini Graphic */}
        <div className="my-2.5 py-2 rounded-xl bg-[#F8F7FC] dark:bg-slate-800/70 flex items-center justify-center">
          <svg viewBox="0 0 88 52" className="w-20 h-12" fill="none" aria-hidden="true">
            <path d="M18 10V36L44 44V18L18 10Z" fill="#7952D6" fillOpacity="0.18" stroke="#7952D6" strokeWidth="1.4" />
            <path d="M18 36L44 44L72 34L46 26L18 36Z" fill="#6035B5" fillOpacity="0.12" stroke="#6035B5" strokeWidth="1.4" />
            <line x1="32" y1="22" x2="54" y2="30" stroke="#7952D6" strokeWidth="2" strokeLinecap="round" />
            <circle cx="32" cy="22" r="2.5" fill="#7952D6" />
            <circle cx="54" cy="30" r="2.5" fill="#6035B5" />
          </svg>
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenScanModal();
            onCloseMobile();
          }}
          className="w-full py-2 px-3 rounded-xl bg-[#7952D6] hover:bg-[#6035B5] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Scan Question</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-[236px] xl:w-[250px] shrink-0 p-3 pr-0">
        <div className="sticky top-3 h-[calc(100vh-1.5rem)] max-h-[900px]">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile & Tablet Slide-over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#202033]/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[265px] max-w-[82vw] h-full p-3">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
