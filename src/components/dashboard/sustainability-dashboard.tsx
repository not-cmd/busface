'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Leaf, TrendingDown, TreePine, Droplets, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SustainabilityMetrics {
  totalDistance: number;
  fuelSaved: number;
  carbonReduced: number;
  treesEquivalent: number;
  efficiencyScore: number;
}

export function SustainabilityDashboard({ metrics }: { metrics?: SustainabilityMetrics }) {
  const defaultMetrics: SustainabilityMetrics = {
    totalDistance: 450,
    fuelSaved: 45.5,
    carbonReduced: 121.8,
    treesEquivalent: 6,
    efficiencyScore: 87,
  };

  const data = metrics || defaultMetrics;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <Leaf className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <CardTitle className="text-xl">Sustainability Impact</CardTitle>
            <CardDescription>Environmental metrics and carbon footprint tracking</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Efficiency Score */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                <span className="font-semibold">Route Efficiency Score</span>
              </div>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {data.efficiencyScore}%
              </span>
            </div>
            <Progress value={data.efficiencyScore} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {data.efficiencyScore >= 85 ? 'Excellent' : data.efficiencyScore >= 70 ? 'Good' : 'Needs Improvement'} - 
              {' '}Above industry average of 65%
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Fuel Saved */}
            <div className="p-4 rounded-lg border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Fuel Saved</span>
              </div>
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                {data.fuelSaved.toFixed(1)}L
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                ₹{(data.fuelSaved * 95).toFixed(0)} cost savings
              </p>
            </div>

            {/* Carbon Reduced */}
            <div className="p-4 rounded-lg border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-900 dark:text-green-100">CO₂ Reduced</span>
              </div>
              <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                {data.carbonReduced.toFixed(1)}kg
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                This month
              </p>
            </div>
          </div>

          {/* Trees Equivalent */}
          <div className="p-4 rounded-lg border bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 dark:from-green-950 dark:via-emerald-950 dark:to-teal-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TreePine className="h-8 w-8 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Carbon Offset Equivalent</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {data.treesEquivalent} Trees
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                Planted
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Your optimized routes have saved as much CO₂ as {data.treesEquivalent} trees absorb in a year
            </p>
          </div>

          {/* Monthly Comparison */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Monthly Performance</h4>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Distance Optimization</span>
                  <span className="font-semibold">92%</span>
                </div>
                <Progress value={92} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Fuel Efficiency</span>
                  <span className="font-semibold">88%</span>
                </div>
                <Progress value={88} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Carbon Reduction</span>
                  <span className="font-semibold">85%</span>
                </div>
                <Progress value={85} className="h-2" />
              </div>
            </div>
          </div>

          {/* Achievement Badge */}
          <div className="p-4 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950">
            <div className="flex items-center gap-3">
              <Award className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 dark:text-amber-100">Eco-Champion Status</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Top 10% in sustainability metrics
                </p>
              </div>
              <Badge className="bg-amber-500 text-white">🏆 Gold</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
