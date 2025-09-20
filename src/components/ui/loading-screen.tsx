
'use client';

import { GuardianTrackLogo } from '@/components/icons';
import { Progress } from '@/components/ui/progress';

interface LoadingScreenProps {
    message: string;
    progress: number;
}

export function LoadingScreen({ message, progress }: LoadingScreenProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40">
            <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-background shadow-lg">
                <GuardianTrackLogo className="h-16 w-16" />
                <h1 className="text-2xl font-bold text-foreground">GuardianRoute</h1>
                <p className="text-muted-foreground">{message}</p>
                <Progress value={progress} className="w-64" />
            </div>
        </div>
    )
}
