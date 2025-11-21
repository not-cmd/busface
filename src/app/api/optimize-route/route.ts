import { NextRequest, NextResponse } from 'next/server';
import { optimizeRoute } from '@/ai/flows/optimize-route';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.busId || !body.currentLocation || !body.stops || !body.trafficConditions || !body.constraints) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Run the AI optimization flow
    const result = await optimizeRoute(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Route optimization error:', error);
    return NextResponse.json(
      { error: 'Failed to optimize route' },
      { status: 500 }
    );
  }
}
