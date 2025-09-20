
'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Bus } from "@/lib/data"
import { User, Phone, FileText, Gauge } from "lucide-react"
import Image from "next/image"
import { db } from "@/lib/firebase"
import { ref, onValue } from "firebase/database"
import { useEffect, useState } from "react"

interface BusInfoCardProps {
    bus: Bus;
}

export function BusInfoCard({ bus }: BusInfoCardProps) {
  const [liveSpeed, setLiveSpeed] = useState<number | null>(null);

  useEffect(() => {
    if (!bus?.busId) return;

    const busDocRef = ref(db, `busLocations/${bus.busId}`);
    const unsubscribe = onValue(busDocRef, (snapshot) => {
        const data = snapshot.val();
        if (data && typeof data.speed === 'number') {
            setLiveSpeed(data.speed);
        }
    });

    return () => unsubscribe();
  }, [bus?.busId]);

  if (!bus) {
    return (
        <Card className="bg-yellow-50 border-yellow-200">
            <CardHeader>
                <CardTitle className="text-yellow-800">Bus Details</CardTitle>
            </CardHeader>
            <CardContent>
                <p>No bus information available.</p>
            </CardContent>
        </Card>
    )
  }
  return (
    <div className="flex-1">
        <Card className="bg-yellow-50 border-yellow-200 h-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-yellow-700" />
                    <CardTitle className="text-yellow-800">Bus Details</CardTitle>
                </div>
                {liveSpeed !== null && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-white/50">
                        <Gauge className="h-5 w-5 text-yellow-800"/>
                        <span className="font-bold text-lg text-yellow-900">{liveSpeed.toFixed(0)}</span>
                        <span className="text-sm text-yellow-800">km/h</span>
                    </div>
                )}
                </div>
            </CardHeader>
            <CardContent>
                <p className="mb-4"><strong>Registration:</strong> {bus.registrationNumber}</p>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="driver">
                        <AccordionTrigger className="text-yellow-700 font-semibold">
                            <div className="flex items-center gap-2">
                            <User className="h-4 w-4"/> Driver Details
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="flex items-center gap-4 pt-2">
                                <Image 
                                    src={bus.driver.photoUrl} 
                                    alt="Driver photo" 
                                    width={80} 
                                    height={80} 
                                    className="rounded-full border-2 border-yellow-200"
                                    data-ai-hint="person driver"
                                />
                                <div>
                                    <p className="font-bold text-lg">{bus.driver.name}</p>
                                    <p className="text-sm text-muted-foreground">Experience: {bus.driver.experience}</p>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="rc">
                        <AccordionTrigger className="text-yellow-700 font-semibold">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4"/> Vehicle RC
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="pt-2">
                                <Image 
                                    src={bus.driver.rcUrl} 
                                    alt="Driver RC" 
                                    width={400} 
                                    height={250} 
                                    className="rounded-md border-2 border-yellow-200"
                                    data-ai-hint="document certificate"
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="contact" className="border-b-0">
                        <AccordionTrigger className="text-yellow-700 font-semibold">
                            <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4"/> Bus Service Contact
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <p className="font-semibold text-lg pt-2">{bus.driver.contact}</p>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
        </Card>
    </div>
  )
}
