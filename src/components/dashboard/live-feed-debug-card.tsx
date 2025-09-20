
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal } from "lucide-react";

interface LiveFeedDebugCardProps {
    logs: string[];
}

export function LiveFeedDebugCard({ logs }: LiveFeedDebugCardProps) {
    return (
        <Card className="lg:col-span-3">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>Live Dataflow</CardTitle>
                </div>
                <CardDescription>
                    Real-time log of the face detection process.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-48 w-full rounded-md border bg-muted/20 p-4 font-mono text-xs">
                    {logs.length > 0 ? (
                        logs.map((log, index) => <p key={index}>{log}</p>)
                    ) : (
                        <p className="text-muted-foreground">Waiting for logs...</p>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
