/**
 * Traffic and Route Utilities
 * Handles real-time traffic data, ETA calculations, and route metrics
 */

interface Coordinates {
  lat: number;
  lng: number;
}

interface TrafficData {
  overall: 'light' | 'moderate' | 'heavy' | 'severe';
  incidents: Array<{
    location: string;
    type: string;
    delay: number;
  }>;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(point1: Coordinates, point2: Coordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate fuel consumption based on distance and conditions
 * @param distance Distance in km
 * @param trafficCondition Current traffic condition
 * @param baseEfficiency Base fuel efficiency in km/L (default: 4.5 for diesel bus)
 */
export function calculateFuelConsumption(
  distance: number,
  trafficCondition: TrafficData['overall'],
  baseEfficiency: number = 4.5
): number {
  // Adjust efficiency based on traffic
  const trafficMultiplier = {
    light: 1.0,
    moderate: 0.85,
    heavy: 0.7,
    severe: 0.6,
  };
  
  const adjustedEfficiency = baseEfficiency * trafficMultiplier[trafficCondition];
  return distance / adjustedEfficiency;
}

/**
 * Calculate carbon footprint from fuel consumption
 * @param fuelLiters Fuel consumption in liters
 * @param fuelType Type of fuel (diesel, petrol, cng)
 */
export function calculateCarbonFootprint(
  fuelLiters: number,
  fuelType: 'diesel' | 'petrol' | 'cng' = 'diesel'
): number {
  // CO2 emissions per liter (kg)
  const emissionFactors = {
    diesel: 2.68,
    petrol: 2.31,
    cng: 1.88,
  };
  
  return fuelLiters * emissionFactors[fuelType];
}

/**
 * Calculate ETA based on distance, traffic, and average speed
 */
export function calculateETA(
  distance: number,
  trafficCondition: TrafficData['overall'],
  baseSpeed: number = 30 // km/h in city
): Date {
  const speedMultiplier = {
    light: 1.2,
    moderate: 1.0,
    heavy: 0.7,
    severe: 0.5,
  };
  
  const adjustedSpeed = baseSpeed * speedMultiplier[trafficCondition];
  const timeInHours = distance / adjustedSpeed;
  const timeInMinutes = timeInHours * 60;
  
  return new Date(Date.now() + timeInMinutes * 60000);
}

/**
 * Calculate route efficiency score (0-100)
 */
export function calculateRouteEfficiency(
  actualDistance: number,
  optimalDistance: number,
  actualTime: number,
  optimalTime: number
): number {
  const distanceEfficiency = (optimalDistance / actualDistance) * 100;
  const timeEfficiency = (optimalTime / actualTime) * 100;
  
  // Weighted average: 60% distance, 40% time
  return Math.min(100, (distanceEfficiency * 0.6 + timeEfficiency * 0.4));
}

/**
 * Estimate fuel cost based on consumption and current prices
 */
export function calculateFuelCost(
  fuelLiters: number,
  fuelType: 'diesel' | 'petrol' | 'cng' = 'diesel'
): number {
  // Average fuel prices in INR (as of 2025)
  const fuelPrices = {
    diesel: 95,
    petrol: 105,
    cng: 75,
  };
  
  return fuelLiters * fuelPrices[fuelType];
}

/**
 * Analyze traffic and suggest re-routing
 */
export function analyzeTrafficConditions(traffic: TrafficData): {
  shouldReroute: boolean;
  reason: string;
  estimatedDelay: number;
} {
  const totalDelay = traffic.incidents?.reduce((sum, inc) => sum + inc.delay, 0) || 0;
  const shouldReroute = traffic.overall === 'severe' || totalDelay > 30;
  
  let reason = '';
  if (traffic.overall === 'severe') {
    reason = 'Severe traffic detected. Alternative routes recommended.';
  } else if (totalDelay > 30) {
    reason = `Major incidents causing ${totalDelay} minutes delay.`;
  } else if (traffic.overall === 'heavy') {
    reason = 'Heavy traffic. Monitor for potential delays.';
  } else {
    reason = 'Traffic conditions normal.';
  }
  
  return {
    shouldReroute,
    reason,
    estimatedDelay: totalDelay,
  };
}

/**
 * Compare two routes and determine which is better
 */
export function compareRoutes(
  route1: { distance: number; time: number; fuel: number },
  route2: { distance: number; time: number; fuel: number }
): {
  betterRoute: 1 | 2;
  timeSaved: number;
  fuelSaved: number;
  distanceSaved: number;
} {
  // Calculate savings
  const timeSaved = Math.abs(route1.time - route2.time);
  const fuelSaved = Math.abs(route1.fuel - route2.fuel);
  const distanceSaved = Math.abs(route1.distance - route2.distance);
  
  // Score each route (lower is better)
  const score1 = route1.time * 0.4 + route1.fuel * 0.3 + route1.distance * 0.3;
  const score2 = route2.time * 0.4 + route2.fuel * 0.3 + route2.distance * 0.3;
  
  return {
    betterRoute: score1 < score2 ? 1 : 2,
    timeSaved: route1.time > route2.time ? timeSaved : -timeSaved,
    fuelSaved: route1.fuel > route2.fuel ? fuelSaved : -fuelSaved,
    distanceSaved: route1.distance > route2.distance ? distanceSaved : -distanceSaved,
  };
}

/**
 * Calculate optimal departure time to arrive by target time
 */
export function calculateOptimalDepartureTime(
  targetArrivalTime: Date,
  estimatedTravelMinutes: number,
  bufferMinutes: number = 10
): Date {
  const totalMinutes = estimatedTravelMinutes + bufferMinutes;
  return new Date(targetArrivalTime.getTime() - totalMinutes * 60000);
}

/**
 * Get sustainability metrics for a route
 */
export function getSustainabilityMetrics(
  distance: number,
  fuelConsumption: number,
  carbonFootprint: number
) {
  // Compare to baseline (average inefficient route)
  const baselineDistance = distance * 1.2;
  const baselineFuel = fuelConsumption * 1.3;
  const baselineCarbon = carbonFootprint * 1.3;
  
  return {
    distanceSaved: baselineDistance - distance,
    fuelSaved: baselineFuel - fuelConsumption,
    carbonReduced: baselineCarbon - carbonFootprint,
    efficiencyScore: Math.round(((baselineFuel - fuelConsumption) / baselineFuel) * 100),
    treesEquivalent: Math.round(carbonFootprint / 21.77), // 1 tree absorbs ~21.77 kg CO2/year
  };
}
