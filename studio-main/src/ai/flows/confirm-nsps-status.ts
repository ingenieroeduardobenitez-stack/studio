
'use server';
/**
 * @fileOverview Un flujo de GenAI para confirmar automáticamente el estado NSPS basado en los detalles de registro del usuario.
 *
 * - confirmNspsStatus - Una función que maneja el proceso de confirmación del estado NSPS.
 * - ConfirmNspsStatusInput - El tipo de entrada para la función confirmNspsStatus.
 * - ConfirmNspsStatusOutput - El tipo de retorno para la función confirmNspsStatus.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ConfirmNspsStatusInputSchema = z.object({
  applicantName: z.string().describe('El nombre completo del solicitante.'),
  citizenship: z.string().describe('La ciudadanía declarada del solicitante.'),
  educationLevel: z.string().describe('El nivel de educación más alto alcanzado.'),
  employmentStatus: z.string().describe('El estado laboral actual del solicitante.'),
  declarationText: z.string().describe('Una autodeclaración proporcionada por el solicitante sobre su elegibilidad para el estado NSPS.'),
});
export type ConfirmNspsStatusInput = z.infer<typeof ConfirmNspsStatusInputSchema>;

const ConfirmNspsStatusOutputSchema = z.object({
  isNspsConfirmed: z.boolean().describe('Verdadero si el estado NSPS del solicitante se confirma basándose en la información proporcionada, falso de lo contrario.'),
  confirmationReason: z.string().describe('Una explicación detallada de la decisión de confirmación (sea confirmada o no). Debe estar en español.'),
  nextSteps: z.string().describe('Sugerencias para los próximos pasos del solicitante basándose en el resultado de la confirmación. Debe estar en español.'),
});
export type ConfirmNspsStatusOutput = z.infer<typeof ConfirmNspsStatusOutputSchema>;

export async function confirmNspsStatus(input: ConfirmNspsStatusInput): Promise<ConfirmNspsStatusOutput> {
  return confirmNspsStatusFlow(input);
}

const confirmNspsStatusPrompt = ai.definePrompt({
  name: 'confirmNspsStatusPrompt',
  input: {schema: ConfirmNspsStatusInputSchema},
  output: {schema: ConfirmNspsStatusOutputSchema},
  prompt: `Eres un sistema experto diseñado para confirmar automáticamente el estado NSPS (Sistema de Personal de Seguridad Nacional) basándote en los detalles proporcionados por el solicitante. Tu tarea es analizar la información dada y determinar si el estado NSPS del solicitante puede ser confirmado. Proporciona una razón clara para tu decisión y sugiere los pasos a seguir apropiados.

Analiza los siguientes detalles del solicitante:
Nombre del Solicitante: {{{applicantName}}}
Ciudadanía: {{{citizenship}}}
Nivel de Educación: {{{educationLevel}}}
Estado Laboral: {{{employmentStatus}}}
Declaración del Solicitante: {{{declarationText}}}

Basándote en estos detalles, evalúa el estado NSPS. Si faltan detalles específicos o no están claros, asume que no se cumplen a menos que se indique explícitamente. Responde siempre en ESPAÑOL.

La salida debe ser un objeto JSON con 'isNspsConfirmed' (boolean), 'confirmationReason' (string en español) y 'nextSteps' (string en español).`
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
      throw new Error('No se pudo obtener la respuesta del sistema de confirmación NSPS.');
    }
    return output;
  }
);
