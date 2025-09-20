'use server';

/**
 * @fileOverview AI agent that generates a summary of student attendance for a given day or week.
 *
 * - generateAttendanceSummary - A function that generates the attendance summary.
 * - GenerateAttendanceSummaryInput - The input type for the generateAttendanceSummary function.
 * - GenerateAttendanceSummaryOutput - The return type for the generateAttendanceSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAttendanceSummaryInputSchema = z.object({
  dateRange: z.string().describe('The date or date range for which to generate the attendance summary. Example: 2024-07-04 or 2024-07-01 - 2024-07-07'),
  attendanceRecords: z.string().describe('JSON array string of student attendance records, including student name and attendance status.'),
});
export type GenerateAttendanceSummaryInput = z.infer<typeof GenerateAttendanceSummaryInputSchema>;

const GenerateAttendanceSummaryOutputSchema = z.object({
  summary: z.string().describe('A summary of student attendance for the given date range, highlighting any trends or issues.'),
});
export type GenerateAttendanceSummaryOutput = z.infer<typeof GenerateAttendanceSummaryOutputSchema>;

export async function generateAttendanceSummary(input: GenerateAttendanceSummaryInput): Promise<GenerateAttendanceSummaryOutput> {
  return generateAttendanceSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAttendanceSummaryPrompt',
  input: {schema: GenerateAttendanceSummaryInputSchema},
  output: {schema: GenerateAttendanceSummaryOutputSchema},
  prompt: `You are an AI assistant that generates summaries of student attendance.

  Given the following attendance records and date range, generate a summary of the student attendance, highlighting any trends or issues.

  Date Range: {{{dateRange}}}
  Attendance Records: {{{attendanceRecords}}}
  Summary: `,
});

const generateAttendanceSummaryFlow = ai.defineFlow(
  {
    name: 'generateAttendanceSummaryFlow',
    inputSchema: GenerateAttendanceSummaryInputSchema,
    outputSchema: GenerateAttendanceSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
