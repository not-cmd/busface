import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { alerts } from "@/lib/data"
import { cn } from "@/lib/utils"

export function AlertsCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <CardTitle>Recent Alerts</CardTitle>
        </div>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-4">
                <div className={cn("p-2 bg-muted rounded-full")}>
                    <alert.icon className={cn("h-4 w-4", alert.color)} />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.time}</p>
                </div>
            </div>
        ))}
      </CardContent>
    </Card>
  )
}

    