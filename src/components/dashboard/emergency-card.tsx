"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Siren } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function EmergencyCard() {
    const { toast } = useToast();

    const handleEmergency = () => {
        toast({
            title: "Emergency Alert Sent",
            description: "All relevant parties have been notified.",
            variant: "destructive",
        })
    }
  return (
    <Card className="border-destructive/50 bg-destructive/10">
      <CardHeader>
        <div className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Emergency System</CardTitle>
        </div>
        <CardDescription className="text-destructive/80">
            For immediate assistance, press the panic button.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="lg" className="w-full h-16 text-lg animate-pulse">
                <Siren className="mr-2 h-6 w-6"/> Panic Button
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Emergency Alert</AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately notify school administration and parents.
                Are you sure you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleEmergency}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
