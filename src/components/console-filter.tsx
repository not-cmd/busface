'use client';

import { useEffect } from 'react';

/**
 * Client-side console warning suppressor
 * Filters out known non-critical development warnings
 */
export function ConsoleFilter() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const originalError = console.error;

      // Patterns of errors to suppress (known development-only issues)
      const suppressPatterns = [
        /ERR_BLOCKED_BY_CLIENT/,
        /events\.mapbox\.com.*Failed to load/,
        /ERR_NAME_NOT_RESOLVED.*camera\.local/,
      ];

      console.error = (...args: any[]) => {
        const message = args.join(' ');
        
        // Don't suppress if it doesn't match any pattern
        if (!suppressPatterns.some(pattern => pattern.test(message))) {
          originalError.apply(console, args);
        }
      };

      return () => {
        console.error = originalError;
      };
    }
  }, []);

  return null;
}
