
/**
 * SCRIPT DE IMPORTACIÓN MASIVA DE EXCEL A FIRESTORE
 * 
 * Este script lee archivos Excel de la carpeta /scripts y los sube a la colección 'cedulas'
 * mapeando los campos específicos proporcionados por el usuario.
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

  console.log(`📂 Encontrados ${files.length} archivos. Iniciando proceso de importación masiva...`);

  for (const file of files) {
    const filePath = path.join(scriptsDir, file);
    console.log(`📖 Procesando: ${file}...`);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`✅ ${data.length} registros leídos. Iniciando subida en bloques...`);

    let count = 0;
    let batch = writeBatch(db);

    for (const row of data) {
      // Mapeo exacto según los campos del usuario
      const cedulaNumber = String(row.NUMERO_CED || "").trim();
      
      if (!cedulaNumber) continue;

      const docRef = doc(db, 'cedulas', cedulaNumber);
      
      const cedulaData = {
        number: cedulaNumber,
        lastName: String(row.APELLIDO || "").trim(),
        firstName: String(row.NOMBRE || "").trim(),
        sex: String(row.SEXO || "").trim(),
        nationality: String(row.NACIONAL || "").trim(),
        fatherName: String(row.NOM_PADRE || "").trim(),
        motherName: String(row.NOM_MADRE || "").trim(),
        address: String(row.DIRECCION || "").trim(),
        spouseName: String(row.NOM_CONJ || "").trim(),
        birthDate: String(row.FECHA_NACI || "").trim(),
        neighborhoodCity: String(row.BARRIO_CIU || "").trim(),
        importedAt: serverTimestamp()
      };

      batch.set(docRef, cedulaData, { merge: true });

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

    console.log(`🎉 Importación finalizada para ${file}. Total: ${count} registros procesados.`);
  }

  console.log("✨ Proceso completo.");
  process.exit(0);
}

importExcel().catch(err => {
  console.error("💥 Error crítico durante la importación:", err);
  process.exit(1);
});
