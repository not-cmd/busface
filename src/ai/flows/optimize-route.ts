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

    const llmResponse = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
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
      
      // Fallback: Basic route optimization without AI
      const optimizedStops = input.stops
        .sort((a, b) => {
          // Simple priority-based sorting
          const priorityWeight = { high: 3, medium: 2, low: 1 };
          const aPriority = priorityWeight[a.priority || 'medium'];
          const bPriority = priorityWeight[b.priority || 'medium'];
          return bPriority - aPriority;
        })
        .map((stop, idx) => ({
          stopId: stop.id,
          stopName: stop.name,
          sequence: idx + 1,
          eta: new Date(Date.now() + (idx + 1) * 10 * 60000).toISOString(),
          studentsToPickup: stop.studentsCount,
          estimatedDelay: 0,
        }));

      const totalDistance = input.stops.length * 3; // Rough estimate
      const totalTime = input.stops.length * 10;
      const fuelEstimate = totalDistance / 4.5;
      const carbonFootprint = fuelEstimate * 2.68;

      return {
        optimizedRoute: optimizedStops,
        totalDistance,
        totalTime,
        fuelEstimate,
        carbonFootprint,
        efficiency: {
          routeEfficiency: 75,
          fuelEfficiency: 4.5,
          timeEfficiency: 80,
        },
        alerts: [{
          type: 'traffic' as const,
          message: 'Using fallback optimization due to AI processing error',
          severity: 'low' as const,
        }],
      };
    }
  }
);

// Helper function to run route optimization
export async function optimizeRoute(input: z.infer<typeof RouteOptimizationInput>) {
  return optimizeRouteFlow(input);
}
