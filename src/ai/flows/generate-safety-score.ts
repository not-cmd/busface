
'use server';

/**
 * @fileOverview AI agent that generates a safety score for a bus driver based on driving events.
 *
 * - generateSafetyScore - A function that generates the safety score.
 * - GenerateSafetyScoreInput - The input type for the generateSafetyScore function.
 * - GenerateSafetyScoreOutput - The return type for the generateSafetyScore function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSafetyScoreInputSchema = z.object({
  driverName: z.string().describe('The name of the driver being evaluated.'),
  drivingEvents: z.string().describe('JSON array string of driving events, including event type, timestamp, and impact on score.'),
});
export type GenerateSafetyScoreInput = z.infer<typeof GenerateSafetyScoreInputSchema>;

const GenerateSafetyScoreOutputSchema = z.object({
  dailyScore: z.number().describe('The calculated daily safety score for the driver, out of 100.'),
  summary: z.string().describe('A brief summary explaining the score, highlighting positive and negative events.'),
});
export type GenerateSafetyScoreOutput = z.infer<typeof GenerateSafetyScoreOutputSchema>;

export async function generateSafetyScore(input: GenerateSafetyScoreInput): Promise<GenerateSafetyScoreOutput> {
  return generateSafetyScoreFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSafetyScorePrompt',
  input: {schema: GenerateSafetyScoreInputSchema},
  output: {schema: GenerateSafetyScoreOutputSchema},
  prompt: `You are a driving safety analyst AI. Your task is to calculate a daily safety score for a school bus driver out of a maximum of 100.

  Start with a perfect score of 100.
  Analyze the provided driving events and deduct points based on their severity.
  - Minor infractions (e.g., harsh braking) might deduct 1-2 points.
  - Major infractions (e.g., speeding over 65 km/h) should deduct more, like 5-10 points.

  After calculating the final score, provide a brief, constructive summary. Mention the key events that impacted the score. Do not be overly harsh. The goal is to encourage safer driving.

  Driver Name: {{{driverName}}}
  Driving Events: {{{drivingEvents}}}
  `,
});

const generateSafetyScoreFlow = ai.defineFlow(
  {
    name: 'generateSafetyScoreFlow',
    inputSchema: GenerateSafetyScoreInputSchema,
    outputSchema: GenerateSafetyScoreOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

    