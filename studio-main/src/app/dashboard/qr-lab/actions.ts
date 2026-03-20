
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
  merchantAlias?: string; // El alias de ueno/SIPAP
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
 * Simula la llamada a la API de un integrador de pagos (Bancard/Pagopar).
 * Construye un string basado en el estándar EMVCo para Paraguay (PY-QR).
 */
export async function generatePaymentQr(request: QrRequest): Promise<QrResponse> {
  try {
    // 1. Generar Token SHA-256 para validación de integridad
    const rawString = `${PRIVATE_KEY}${request.orderId}${request.amount}`;
    const token = createHash('sha256').update(rawString).digest('hex');

    // 2. Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 800));

    /**
     * ESTRUCTURA PY-QR (Simplificada para simulación):
     * 00: Payload Format Indicator (01)
     * 01: Point of Initiation Method (12 - Dinámico)
     * 26: Merchant Account Information (Red Bancard / ueno)
     * 52: Merchant Category Code
     * 53: Transaction Currency (600 - PYG)
     * 54: Transaction Amount
     * 58: Country Code (PY)
     * 59: Merchant Name (Santuario NSPS)
     * 60: Merchant City (Asuncion)
     * 62: Additional Data (Order ID)
     * 63: CRC (Checksum)
     */
    
    // En una integración real, Bancard te devuelve este string exacto.
    // Aquí simulamos cómo se vería incluyendo el Alias del usuario.
    const aliasTag = request.merchantAlias ? `02${request.merchantAlias.length}${request.merchantAlias}` : '';
    const bancardMerchantInfo = `0010py.com.bancard0112${request.orderId}${aliasTag}`;
    
    const qrString = [
      "000201",
      "010212",
      `26${bancardMerchantInfo.length}${bancardMerchantInfo}`,
      "52045999",
      "5303600",
      `54${String(request.amount).length}${request.amount}`,
      "5802PY",
      "5915Santuario NSPS",
      "6008Asuncion",
      `62${String(request.orderId).length + 4}01${String(request.orderId).length}${request.orderId}`,
      `6304${token.slice(0, 4).toUpperCase()}`
    ].join('');

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
