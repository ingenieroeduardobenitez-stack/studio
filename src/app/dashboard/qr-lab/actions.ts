
'use server';

import { createHash } from 'crypto';

/**
 * @fileOverview Acciones de servidor para el Laboratorio de QR.
 * Simula la interacción con una API de red de pagos (estilo Bancard/Pagopar).
 */

export type QrRequest = {
  amount: number;
  description: string;
  buyerName: string;
  buyerIdentity: string;
  orderId: string;
};

export type QrResponse = {
  success: boolean;
  qrString: string;
  token: string;
  error?: string;
};

// Clave privada de prueba (en producción esto iría en variables de entorno)
const PRIVATE_KEY = "SANTUARIO_SECRET_TEST_KEY";

/**
 * Simula la llamada a la API de un integrador de pagos.
 */
export async function generatePaymentQr(request: QrRequest): Promise<QrResponse> {
  try {
    // 1. Generar Token SHA-256 (Recomendación técnica)
    // Se combina la clave privada con el orderId y el monto para asegurar la integridad
    const rawString = `${PRIVATE_KEY}${request.orderId}${request.amount}`;
    const token = createHash('sha256').update(rawString).digest('hex');

    // 2. Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Generar la cadena del QR (Formato PY-QR estándar BCP)
    // Nota: Esto es un ejemplo del string dinámico que devolvería Bancard/Pagopar
    const qrString = `00020101021226520010py.com.bancard0112${request.orderId}520459995303600540${request.amount}5802PY5915SantuarioNSPS6008Asuncion62240120${request.description.slice(0, 20)}6304${token.slice(0, 4)}`;

    return {
      success: true,
      qrString,
      token
    };
  } catch (error: any) {
    return {
      success: false,
      qrString: "",
      token: "",
      error: error.message
    };
  }
}
