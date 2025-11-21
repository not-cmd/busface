'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export function AppInstallCard() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if can be installed
    const handler = () => setCanInstall(true);
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isInstalled) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg text-green-900">App Installed</CardTitle>
          </div>
          <CardDescription className="text-green-700">
            You're using the installed version of GuardianTrack
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Smartphone className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Install as App</CardTitle>
            <CardDescription>Get quick access and offline features</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-blue-600" />
            <span>Launch from home screen</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-blue-600" />
            <span>Works offline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-blue-600" />
            <span>Faster performance</span>
          </div>
        </div>
        <Button 
          className="w-full" 
          size="sm"
          onClick={() => {
            // Trigger the install prompt
            window.dispatchEvent(new Event('show-install-prompt'));
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Install Now
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Available on all devices • Free forever
        </p>
      </CardContent>
    </Card>
  );
}
