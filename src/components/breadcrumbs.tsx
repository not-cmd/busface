'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { Fragment } from 'react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  className?: string;
  customItems?: BreadcrumbItem[];
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  parent: 'Parent View',
  'bus-staff': 'Bus Staff',
  students: 'Students',
  buses: 'Buses',
  attendance: 'Attendance',
  login: 'Login',
  about: 'About',
};

export function Breadcrumbs({ className, customItems }: BreadcrumbsProps) {
  const pathname = usePathname();

  // Generate breadcrumb items from pathname
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (customItems) return customItems;

    const paths = pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [
      { label: 'Home', href: '/' }
    ];

    let currentPath = '';
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const label = ROUTE_LABELS[path] || path.charAt(0).toUpperCase() + path.slice(1);
      items.push({
        label,
        href: currentPath
      });
    });

    return items;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Don't show breadcrumbs on home or login page
  if (pathname === '/' || pathname === '/login') {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center space-x-1 text-sm text-muted-foreground", className)}>
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isHome = index === 0;

        return (
          <Fragment key={item.href}>
            {index > 0 && (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )}
            {isLast ? (
              <span className="font-medium text-foreground flex items-center gap-1.5">
                {isHome && <Home className="h-4 w-4" />}
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                {isHome && <Home className="h-4 w-4" />}
                {item.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

// Compact breadcrumb for mobile
export function BreadcrumbsCompact({ className }: { className?: string }) {
  const pathname = usePathname();
  
  const getCurrentPage = () => {
    const paths = pathname.split('/').filter(Boolean);
    const lastPath = paths[paths.length - 1];
    return ROUTE_LABELS[lastPath] || lastPath.charAt(0).toUpperCase() + lastPath.slice(1);
  };

  const getParentPath = () => {
    const paths = pathname.split('/').filter(Boolean);
    if (paths.length <= 1) return '/';
    paths.pop();
    return '/' + paths.join('/');
  };

  if (pathname === '/' || pathname === '/login') {
    return null;
  }

  return (
    <nav className={cn("flex items-center gap-2 text-sm", className)}>
      <Link
        href={getParentPath()}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
      </Link>
      <span className="font-medium text-foreground">{getCurrentPage()}</span>
    </nav>
  );
}
