'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/lib/pwa';

interface InstallPromptProps {
  onDismiss?: () => void;
  className?: string;
}

export function InstallPrompt({ onDismiss, className }: InstallPromptProps) {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [isInstalling, setIsInstalling] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const success = await install();
      if (success) {
        setIsDismissed(true);
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Don't show if already installed, can't install, or has been dismissed
  if (isInstalled || !canInstall || isDismissed) {
    return null;
  }

  return (
    <Card className={`border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <Smartphone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg text-blue-900">
                Install Spark App
              </CardTitle>
              <CardDescription className="text-blue-700">
                Get the full experience with offline access and faster loading
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleInstall}
            disabled={isInstalling}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            {isInstalling ? 'Installing...' : 'Install App'}
          </Button>
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            Maybe Later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Standalone install banner component
export function InstallBanner() {
  const [isVisible, setIsVisible] = useState(true);
  
  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm">
      <InstallPrompt onDismiss={() => setIsVisible(false)} />
    </div>
  );
}

// Hook for programmatic install prompts
export function useInstallPrompt() {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [showPrompt, setShowPrompt] = useState(false);

  const triggerInstall = async () => {
    if (canInstall) {
      return await install();
    }
    return false;
  };

  const showInstallPrompt = () => {
    if (canInstall && !isInstalled) {
      setShowPrompt(true);
    }
  };

  const hideInstallPrompt = () => {
    setShowPrompt(false);
  };

  return {
    canInstall,
    isInstalled,
    showPrompt,
    triggerInstall,
    showInstallPrompt,
    hideInstallPrompt,
  };
}