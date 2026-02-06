'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    CalendarEvent,
    downloadICSFile,
    generateGoogleCalendarUrl
} from '../utils/calendar';

interface AddToCalendarButtonProps {
    event: CalendarEvent;
    className?: string;
    size?: 'sm' | 'md';
}

/**
 * Add to Calendar button with dropdown for different calendar options
 */
export function AddToCalendarButton({
    event,
    className = '',
    size = 'sm'
}: AddToCalendarButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleDownloadICS = () => {
        downloadICSFile(event);
        setIsOpen(false);
    };

    const handleGoogleCalendar = () => {
        const url = generateGoogleCalendarUrl(event);
        window.open(url, '_blank', 'noopener,noreferrer');
        setIsOpen(false);
    };

    const sizeClasses = size === 'sm'
        ? 'px-2 py-1 text-xs min-h-[32px]'
        : 'px-3 py-1.5 text-sm min-h-[40px]';

    return (
        <div className={`relative inline-block ${className}`} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
          ${sizeClasses}
          bg-blue-50 text-blue-700 hover:bg-blue-100 
          rounded font-medium
          flex items-center gap-1
          transition-colors
        `}
                title="Add to Calendar"
            >
                <span>📅</span>
                <span className="hidden sm:inline">Add to Calendar</span>
                <span className="sm:hidden">Calendar</span>
                <svg
                    className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    <button
                        onClick={handleGoogleCalendar}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                        <span className="text-lg">📆</span>
                        <span>Google Calendar</span>
                    </button>
                    <button
                        onClick={handleDownloadICS}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
                    >
                        <span className="text-lg">📥</span>
                        <span>Download .ics file</span>
                    </button>
                    <div className="px-3 py-1.5 text-xs text-slate-700 bg-slate-50 border-t border-slate-100">
                        .ics works with Apple, Outlook, etc.
                    </div>
                </div>
            )}
        </div>
    );
}

