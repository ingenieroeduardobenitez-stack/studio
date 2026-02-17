'use server';
/**
 * @fileOverview A GenAI flow for automatically confirming NSPS status based on user registration details.
 *
 * - confirmNspsStatus - A function that handles the NSPS status confirmation process.
 * - ConfirmNspsStatusInput - The input type for the confirmNspsStatus function.
 * - ConfirmNspsStatusOutput - The return type for the confirmNspsStatus function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ConfirmNspsStatusInputSchema = z.object({
  applicantName: z.string().describe('The full name of the applicant.'),
  citizenship: z.string().describe('The declared citizenship of the applicant.'),
  educationLevel: z.string().describe('The highest education level attained by the applicant.'),
  employmentStatus: z.string().describe('The current employment status of the applicant.'),
  declarationText: z.string().describe('A self-declaration provided by the applicant regarding their eligibility for NSPS status.'),
});
export type ConfirmNspsStatusInput = z.infer<typeof ConfirmNspsStatusInputSchema>;

const ConfirmNspsStatusOutputSchema = z.object({
  isNspsConfirmed: z.boolean().describe('True if the applicant\'s NSPS status is confirmed based on the provided information, false otherwise.'),
  confirmationReason: z.string().describe('A detailed explanation for the confirmation decision (whether it\'s confirmed or not).'),
  nextSteps: z.string().describe('Suggestions for the applicant\'s next steps based on the confirmation outcome.'),
});
export type ConfirmNspsStatusOutput = z.infer<typeof ConfirmNspsStatusOutputSchema>;

export async function confirmNspsStatus(input: ConfirmNspsStatusInput): Promise<ConfirmNspsStatusOutput> {
  return confirmNspsStatusFlow(input);
}

const confirmNspsStatusPrompt = ai.definePrompt({
  name: 'confirmNspsStatusPrompt',
  input: {schema: ConfirmNspsStatusInputSchema},
  output: {schema: ConfirmNspsStatusOutputSchema},
  prompt: `You are an expert system designed to automatically confirm NSPS (National Security Personnel System) status based on provided applicant details. Your task is to analyze the given information and determine if the applicant's NSPS status can be confirmed. Provide a clear reason for your decision and suggest appropriate next steps for the applicant.\n\nConsider the following applicant details:\nApplicant Name: {{{applicantName}}}\nCitizenship: {{{citizenship}}}\nEducation Level: {{{educationLevel}}}\nEmployment Status: {{{employmentStatus}}}\nApplicant's Declaration: {{{declarationText}}}\n\nBased on these details, evaluate the NSPS status. If specific details are missing or unclear, assume they are not met unless explicitly stated.\n\nOutput should be a JSON object with 'isNspsConfirmed' (boolean), 'confirmationReason' (string), and 'nextSteps' (string).`
});

const confirmNspsStatusFlow = ai.defineFlow(
  {
    name: 'confirmNspsStatusFlow',
    inputSchema: ConfirmNspsStatusInputSchema,
    outputSchema: ConfirmNspsStatusOutputSchema,
  },
  async (input) => {
    const {output} = await confirmNspsStatusPrompt(input);
    if (!output) {
      throw new Error('Failed to get output from NSPS status confirmation prompt.');
    }
    return output;
  }
);
