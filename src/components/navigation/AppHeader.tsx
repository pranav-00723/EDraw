/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  Moon,
  Sun,
  Menu,
  ArrowLeft,
  ArrowRight,
  Compass,
  Ruler,
  FileText,
  BookOpen,
} from 'lucide-react';
import { PlaneColorPicker } from '../PlaneColorPicker';
import { AppRoute } from '../../types/modules';
import studentAvatarImg from '../../assets/images/edraw_student_avatar_1795028178386.jpg';

interface AppHeaderProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onSelectSection: (
    section: 'dashboard' | 'points' | 'lines' | 'generator' | 'roadmap' | 'progress',
    route?: AppRoute
  ) => void;
  studentName: string;
  hpColor: string;
  vpColor: string;
  onChangeHpColor: (c: string) => void;
  onChangeVpColor: (c: string) => void;
  onResetColors: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenScanModal: () => void;
  onOpenMobileSidebar: () => void;
  onOpenSettings: () => void;
}

interface SearchTopicItem {
  title: string;
  category: string;
  keywords: string;
  action: () => void;
  icon: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentRoute,
  onNavigate,
  onSelectSection,
  studentName,
  hpColor,
  vpColor,
  onChangeHpColor,
  onChangeVpColor,
  onResetColors,
  isDark,
  onToggleTheme,
  onOpenScanModal,
  onOpenMobileSidebar,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const topicIndex: SearchTopicItem[] = useMemo(
    () => [
      {
        title: 'Projection of Points (V1)',
        category: 'Active Module · 1st–4th Quadrants',
        keywords: 'points quadrants hp vp coordinates front view top view 3d',
        action: () => onNavigate('/projection-of-points'),
        icon: <Compass className="w-4 h-4 text-[#7138E8]" />,
      },
      {
        title: 'Projection of Straight Lines (V2)',
        category: 'Active Module · Rotating Line & Traces',
        keywords: 'lines straight true length theta phi inclinations traces ht vt dep loci',
        action: () => onNavigate('/projection-of-lines'),
        icon: <Ruler className="w-4 h-4 text-[#7138E8]" />,
      },
      {
        title: 'Question-to-Graphics Generator',
        category: 'Parser Lab · Text & OCR Constructions',
        keywords: 'question generator parser ocr text problem solver rotating line',
        action: () => onNavigate('/question-generator'),
        icon: <FileText className="w-4 h-4 text-[#7138E8]" />,
      },
      {
        title: 'Scan Textbook Question',
        category: 'OCR & Camera Input',
        keywords: 'scan camera upload photo textbook ocr',
        action: () => onOpenScanModal(),
        icon: <FileText className="w-4 h-4 text-[#7138E8]" />,
      },
      {
        title: 'Syllabus Roadmap (V1–V5)',
        category: 'Curriculum · Planes, Solids & Development',
        keywords: 'syllabus roadmap planes solids sections development v3 v4 v5',
        action: () => onSelectSection('roadmap', '/dashboard'),
        icon: <BookOpen className="w-4 h-4 text-[#7138E8]" />,
      },
    ],
    [onNavigate, onOpenScanModal, onSelectSection]
  );

  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return topicIndex;
    return topicIndex.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords.includes(q)
    );
  }, [searchQuery, topicIndex]);

  const initials = (studentName || 'S')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  const moduleHeaderMeta = useMemo(() => {
    if (currentRoute === '/projection-of-points') {
      return {
        title: 'Projection of Points',
        subtitle: 'Explore the spatial position of a point in 3D space',
      };
    }
    if (currentRoute === '/projection-of-lines') {
      return {
        title: 'Projection of Straight Lines',
        subtitle: '3D locus planes, rotating line method & trace evaluation',
      };
    }
    if (currentRoute === '/question-generator') {
      return {
        title: 'Question-to-Graphics Generator',
        subtitle: 'Parse engineering word problems into orthographic projections',
      };
    }
    return null;
  }, [currentRoute]);

  return (
    <header className="px-4 sm:px-6 py-3.5 border-b border-[#E8E2F5] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
      {/* Left: Mobile Drawer Button + Contextual Module Title OR Dashboard Welcome */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden w-9 h-9 rounded-xl bg-[#F1EBFF] dark:bg-slate-800 text-[#7138E8] dark:text-purple-300 flex items-center justify-center cursor-pointer shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {moduleHeaderMeta ? (
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="w-9 h-9 rounded-xl bg-[#F1EBFF] dark:bg-slate-800 hover:bg-[#E6DAFF] dark:hover:bg-slate-700 text-[#7138E8] dark:text-purple-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Back to Home Dashboard"
              aria-label="Back to Home Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-[#202044] dark:text-slate-100 truncate leading-tight">
                {moduleHeaderMeta.title}
              </h1>
              <p className="text-xs text-[#77758F] dark:text-slate-400 truncate leading-tight mt-0.5">
                {moduleHeaderMeta.subtitle}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#E8E2F5] dark:border-purple-900 bg-[#F1EBFF] dark:bg-slate-800 flex items-center justify-center shrink-0">
              {!avatarError ? (
                <img
                  src={studentAvatarImg}
                  alt={`${studentName} avatar`}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-[#7138E8] dark:text-purple-300">
                  {initials}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#77758F] dark:text-slate-400 leading-tight">
                Welcome
              </div>
              <div className="text-base sm:text-lg font-bold text-[#202044] dark:text-slate-100 truncate leading-tight mt-0.5">
                {studentName}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Search Bar, Plane Colors, Notifications, Theme Toggle & Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-1 justify-end max-w-xl">
        {/* Topic Search Input */}
        <div className="relative flex-1 max-w-xs sm:max-w-sm hidden sm:block" ref={searchRef}>
          <Search className="w-4 h-4 text-[#77758F] dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            placeholder="Search topics..."
            aria-label="Search engineering graphics topics"
            className="w-full h-9 pl-9 pr-4 rounded-xl bg-[#F8F7FC] dark:bg-slate-800/80 border border-[#E8E2F5] dark:border-slate-700 text-xs sm:text-[13px] text-[#202044] dark:text-slate-100 placeholder:text-[#77758F] dark:placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#7138E8] focus:ring-2 focus:ring-[#7138E8]/15 transition-all"
          />

          {isSearchOpen && (
            <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-xl py-2 z-50">
              {filteredTopics.length > 0 ? (
                filteredTopics.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      item.action();
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[#F1EBFF]/70 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#F1EBFF] dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#202044] dark:text-slate-100 truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[#77758F] dark:text-slate-400 truncate">
                          {item.category}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#77758F] shrink-0" />
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-xs text-[#77758F] dark:text-slate-400">
                  No matching topics found.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Plane Color Picker */}
        <PlaneColorPicker
          hpColor={hpColor}
          vpColor={vpColor}
          onChangeHpColor={onChangeHpColor}
          onChangeVpColor={onChangeVpColor}
          onResetColors={onResetColors}
          isDark={isDark}
        />

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className="relative w-9 h-9 rounded-xl bg-[#F1EBFF] dark:bg-slate-800 hover:bg-[#E6DAFF] dark:hover:bg-slate-700 text-[#7138E8] dark:text-purple-300 flex items-center justify-center transition-colors cursor-pointer"
            title="Platform updates and quick shortcuts"
            aria-label="Notifications"
          >
            <Bell className="w-[17px] h-[17px]" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#7138E8]" />
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-[#E8E2F5] dark:border-slate-800 shadow-xl p-4 z-50">
              <div className="text-xs font-bold text-[#202044] dark:text-slate-100 pb-2.5 border-b border-[#E8E2F5] dark:border-slate-800">
                EDRAW Platform Notes
              </div>
              <div className="divide-y divide-[#F0ECF9] dark:divide-slate-800 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/projection-of-lines');
                    setIsNotificationsOpen(false);
                  }}
                  className="w-full py-2.5 text-left hover:bg-[#F8F7FC] dark:hover:bg-slate-800/60 rounded-lg px-2 transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-[#202044] dark:text-slate-100">
                    V2 Straight Lines &amp; Rotating Method
                  </div>
                  <div className="text-[11px] text-[#77758F] dark:text-slate-400 mt-0.5">
                    Includes 3D locus planes, true inclinations (θ, φ), and HT/VT traces.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/question-generator');
                    setIsNotificationsOpen(false);
                  }}
                  className="w-full py-2.5 text-left hover:bg-[#F8F7FC] dark:hover:bg-slate-800/60 rounded-lg px-2 transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-[#202044] dark:text-slate-100">
                    Question-to-Graphics Generator
                  </div>
                  <div className="text-[11px] text-[#77758F] dark:text-slate-400 mt-0.5">
                    Parse textbook word problems into step-by-step orthographic views.
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-9 h-9 rounded-xl bg-[#F1EBFF] dark:bg-slate-800 hover:bg-[#E6DAFF] dark:hover:bg-slate-700 text-[#7138E8] dark:text-amber-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title={isDark ? 'Switch to Light Lavender Studio' : 'Switch to CAD Dark Mode'}
          aria-label="Toggle color theme"
        >
          {isDark ? <Sun className="w-[17px] h-[17px]" /> : <Moon className="w-[17px] h-[17px]" />}
        </button>

        {/* Compact Profile Avatar Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          title={`${studentName} · Workspace Settings`}
          aria-label="Profile and workspace settings"
          className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7138E8] to-[#9565F5] text-white text-xs font-bold flex items-center justify-center shadow-xs hover:opacity-90 transition-opacity cursor-pointer shrink-0"
        >
          {initials}
        </button>
      </div>
    </header>
  );
};
