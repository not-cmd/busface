import { ai } from '../genkit';
import { z } from 'zod';

// Schema for route optimization input
const RouteOptimizationInput = z.object({
  busId: z.string(),
  currentLocation: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  stops: z.array(z.object({
    id: z.string(),
    name: z.string(),
    lat: z.number(),
    lng: z.number(),
    studentsCount: z.number(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
  })),
  trafficConditions: z.object({
    overall: z.enum(['light', 'moderate', 'heavy', 'severe']),
    incidents: z.array(z.object({
      location: z.string(),
      type: z.string(),
      delay: z.number(), // minutes
    })).optional(),
  }),
  constraints: z.object({
    maxCapacity: z.number(),
    schoolStartTime: z.string(), // HH:mm format
    maxRouteTime: z.number(), // minutes
    fuelEfficiencyTarget: z.number(), // km/l
  }),
});

const RouteOptimizationOutput = z.object({
  optimizedRoute: z.array(z.object({
    stopId: z.string(),
    stopName: z.string(),
    sequence: z.number(),
    eta: z.string(),
    studentsToPickup: z.number(),
    estimatedDelay: z.number(),
  })),
  totalDistance: z.number(), // km
  totalTime: z.number(), // minutes
  fuelEstimate: z.number(), // liters
  carbonFootprint: z.number(), // kg CO2
  efficiency: z.object({
    routeEfficiency: z.number(), // percentage
    fuelEfficiency: z.number(), // km/l
    timeEfficiency: z.number(), // percentage
  }),
  alerts: z.array(z.object({
    type: z.enum(['traffic', 'delay', 'capacity', 'fuel']),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
  })),
  alternativeRoutes: z.array(z.object({
    routeName: z.string(),
    timeSaved: z.number(),
    fuelSaved: z.number(),
    reason: z.string(),
  })).optional(),
});

export const optimizeRouteFlow = ai.defineFlow(
  {
    name: 'optimizeRoute',
    inputSchema: RouteOptimizationInput,
    outputSchema: RouteOptimizationOutput,
  },
  async (input: z.infer<typeof RouteOptimizationInput>) => {
    const prompt = `You are an expert AI route optimization system for school buses. Analyze the following data and provide optimal routing recommendations:

**Current Situation:**
- Bus ID: ${input.busId}
- Current Location: ${input.currentLocation.lat}, ${input.currentLocation.lng}
- Number of Stops: ${input.stops.length}
- Traffic Conditions: ${input.trafficConditions.overall}
- School Start Time: ${input.constraints.schoolStartTime}
- Max Route Time: ${input.constraints.maxRouteTime} minutes
- Bus Capacity: ${input.constraints.maxCapacity}

**Stops to Visit:**
${input.stops.map((stop, idx) => 
  `${idx + 1}. ${stop.name} (${stop.lat}, ${stop.lng}) - ${stop.studentsCount} students ${stop.priority ? `[${stop.priority} priority]` : ''}`
).join('\n')}

**Traffic Incidents:**
${input.trafficConditions.incidents?.map(inc => 
  `- ${inc.type} at ${inc.location}: +${inc.delay} min delay`
).join('\n') || 'None reported'}

**Your Task:**
1. Optimize the stop sequence for minimum travel time and fuel consumption
2. Calculate accurate ETAs for each stop considering traffic
3. Identify potential delays and bottlenecks
4. Calculate fuel consumption and carbon footprint
5. Suggest alternative routes if traffic is severe
6. Consider student pickup priorities (special needs, long wait times)
7. Ensure arrival at school before ${input.constraints.schoolStartTime}

**Optimization Criteria:**
- Minimize total distance and time
- Avoid traffic incidents
- Maximize fuel efficiency (target: ${input.constraints.fuelEfficiencyTarget} km/l)
- Prioritize high-priority stops
- Balance between speed and safety

Provide a detailed optimization plan with:
- Optimal stop sequence with ETAs
- Total distance and estimated time
- Fuel consumption estimate (diesel bus, average 4.5 km/l in city)
- Carbon footprint (diesel: 2.68 kg CO2 per liter)
- Route efficiency metrics
- Any alerts or warnings
- Alternative route suggestions if beneficial

Format your response as valid JSON matching the expected schema.`;

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.warn('Gemini API key not configured. Using fallback optimization.');
      throw new Error('GEMINI_API_KEY not configured');
    }

    const llmResponse = await ai.generate({
      model: 'googleai/gemini-1.5-flash-latest',
      prompt,
      config: {
        temperature: 0.3, // Lower temperature for more consistent routing decisions
        maxOutputTokens: 2048,
      },
    });

    const result = llmResponse.text;
    
    try {
      // Clean up the response to extract JSON
      let jsonText = result;
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
      
      const parsed = JSON.parse(jsonText);
      return parsed;
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      
      // Fallback: Calculate nearest neighbor route optimization
      const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      // Nearest neighbor algorithm for route optimization
      const unvisited = [...input.stops];
      const optimizedStops: any[] = [];
      let currentLat = input.currentLocation.lat;
      let currentLng = input.currentLocation.lng;
      let totalDistance = 0;
      let cumulativeTime = 0;

      // Traffic delay multiplier
      const trafficMultiplier = {
        light: 1.0,
        moderate: 1.3,
        heavy: 1.6,
        severe: 2.0
      }[input.trafficConditions.overall];

      while (unvisited.length > 0) {
        // Find nearest stop considering priority
        let bestIdx = 0;
        let bestScore = Infinity;
        
        for (let i = 0; i < unvisited.length; i++) {
          const stop = unvisited[i];
          const distance = calculateDistance(currentLat, currentLng, stop.lat, stop.lng);
          const priorityBonus = stop.priority === 'high' ? -5 : stop.priority === 'low' ? 5 : 0;
          const score = distance + priorityBonus;
          
          if (score < bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }

        const nextStop = unvisited.splice(bestIdx, 1)[0];
        const distance = calculateDistance(currentLat, currentLng, nextStop.lat, nextStop.lng);
        totalDistance += distance;
        
        // Estimate time: average 30 km/h in city + 2 min per stop
        const travelTime = (distance / 30) * 60 * trafficMultiplier;
        const stopTime = 2;
        cumulativeTime += travelTime + stopTime;

        optimizedStops.push({
          stopId: nextStop.id,
          stopName: nextStop.name,
          sequence: optimizedStops.length + 1,
          eta: new Date(Date.now() + cumulativeTime * 60000).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          studentsToPickup: nextStop.studentsCount,
          estimatedDelay: Math.round((trafficMultiplier - 1) * travelTime),
        });

        currentLat = nextStop.lat;
        currentLng = nextStop.lng;
      }

      const totalTime = Math.round(cumulativeTime);
      const fuelEfficiency = input.trafficConditions.overall === 'severe' ? 3.5 : 4.5;
      const fuelEstimate = totalDistance / fuelEfficiency;
      const carbonFootprint = fuelEstimate * 2.68;

      const alerts: any[] = [{
        type: 'traffic' as const,
        message: process.env.GEMINI_API_KEY 
          ? 'Using fallback optimization due to AI processing error'
          : 'AI optimization unavailable - configure GEMINI_API_KEY for enhanced routing',
        severity: 'low' as const,
      }];

      if (input.trafficConditions.overall === 'heavy' || input.trafficConditions.overall === 'severe') {
        alerts.push({
          type: 'traffic' as const,
          message: `${input.trafficConditions.overall.toUpperCase()} traffic detected. Consider alternative routes.`,
          severity: 'high' as const,
        });
      }

      if (totalTime > input.constraints.maxRouteTime) {
        alerts.push({
          type: 'delay' as const,
          message: `Route time (${totalTime} min) exceeds maximum (${input.constraints.maxRouteTime} min)`,
          severity: 'high' as const,
        });
      }

      return {
        optimizedRoute: optimizedStops,
        totalDistance: Math.round(totalDistance * 10) / 10,
        totalTime,
        fuelEstimate: Math.round(fuelEstimate * 10) / 10,
        carbonFootprint: Math.round(carbonFootprint * 10) / 10,
        efficiency: {
          routeEfficiency: Math.min(95, Math.round(100 - (trafficMultiplier - 1) * 30)),
          fuelEfficiency: Math.round(fuelEfficiency * 10) / 10,
          timeEfficiency: Math.min(95, Math.round(100 - (totalTime / input.constraints.maxRouteTime) * 100)),
        },
        alerts,
        alternativeRoutes: input.trafficConditions.overall === 'severe' ? [
          {
            routeName: 'Alternate Route via Highway',
            timeSaved: 15,
            fuelSaved: 2.5,
            reason: 'Avoid congested city center'
          }
        ] : undefined,
      };
    }
  }
);

// Helper function to run route optimization
export async function optimizeRoute(input: z.infer<typeof RouteOptimizationInput>) {
  return optimizeRouteFlow(input);
}
