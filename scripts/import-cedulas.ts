
/**
 * SCRIPT DE IMPORTACIÓN MASIVA DE EXCEL A FIRESTORE
 * 
 * Este script lee archivos Excel de la carpeta /scripts y los sube a la colección 'cedulas'
 * utilizando batches de 500 registros para máxima eficiencia.
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';

// Configuración de Firebase (debe coincidir con src/firebase/config.ts)
const firebaseConfig = {
  apiKey: "AIzaSyAEWzl6-aPy1mpPHRJOFaQh_0Dw2VHd-Fk",
  authDomain: "studio-8931863599-6d45c.firebaseapp.com",
  projectId: "studio-8931863599-6d45c",
  storageBucket: "studio-8931863599-6d45c.firebasestorage.app",
  messagingSenderId: "618645486004",
  appId: "1:618645486004:web:199dbf50db4987171e1ae1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function importExcel() {
  const scriptsDir = path.join(process.cwd(), 'scripts');
  const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));

  if (files.length === 0) {
    console.log("❌ No se encontraron archivos Excel en la carpeta /scripts");
    return;
  }

  console.log(`📂 Encontrados ${files.length} archivos. Iniciando proceso...`);

  for (const file of files) {
    const filePath = path.join(scriptsDir, file);
    console.log(`📖 Procesando: ${file}...`);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`✅ ${data.length} registros leídos. Subiendo a Firestore...`);

    let count = 0;
    let batch = writeBatch(db);

    for (const row of data) {
      // Ajustar nombres de columnas según tu Excel
      const cedulaNumber = String(row.number || row.CEDULA || row.cedula || "");
      const fullName = String(row.name || row.NOMBRE || row.nombre || "Sin nombre");

      if (!cedulaNumber) continue;

      const docRef = doc(db, 'cedulas', cedulaNumber);
      batch.set(docRef, {
        number: cedulaNumber,
        name: fullName,
        importedAt: serverTimestamp()
      }, { merge: true });

      count++;

      // Firestore limita batches a 500 operaciones
      if (count % 500 === 0) {
        await batch.commit();
        batch = writeBatch(db);
        console.log(`🚀 Progresado: ${count} registros...`);
      }
    }

    // Subir el remanente
    if (count % 500 !== 0) {
      await batch.commit();
    }

    console.log(`🎉 Importación finalizada para ${file}. Total: ${count} registros.`);
  }

  console.log("✨ Proceso completo.");
  process.exit(0);
}

importExcel().catch(err => {
  console.error("💥 Error crítico:", err);
  process.exit(1);
});
