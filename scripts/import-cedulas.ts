
/**
 * SCRIPT DE IMPORTACIÓN MASIVA DE EXCEL A FIRESTORE
 * 
 * Este script lee todos los archivos Excel de la carpeta /scripts (cedula1.xlsx, cedula2.xlsx, etc.)
 * y los sube a la colección 'cedulas' mapeando los campos específicos proporcionados por el usuario.
 * Optimizado para manejar cientos de miles de registros mediante batches.
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';

// Configuración de Firebase (se toma de src/firebase/config.ts)
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

/**
 * Convierte una fecha de Excel a formato YYYY-MM-DD string.
 */
function formatDate(val: any): string {
  if (!val) return "";
  
  // Si ya es un objeto Date de JS
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  
  // Si es un número (formato serial de Excel)
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    const month = String(date.m).padStart(2, '0');
    const day = String(date.d).padStart(2, '0');
    return `${date.y}-${month}-${day}`;
  }
  
  // Si es un string, intentamos limpiar espacios
  return String(val).trim();
}

async function importExcel() {
  const scriptsDir = path.join(process.cwd(), 'scripts');
  // Filtramos archivos que empiecen con 'cedula' y terminen en excel
  const files = fs.readdirSync(scriptsDir).filter(f => 
    (f.startsWith('cedula') && (f.endsWith('.xlsx') || f.endsWith('.xls')))
  ).sort((a, b) => {
    // Ordenamos numéricamente para procesar en orden: cedula1, cedula2...
    const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
    const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
    return numA - numB;
  });

  if (files.length === 0) {
    console.log("❌ No se encontraron archivos Excel (cedulaX.xlsx) en la carpeta /scripts");
    return;
  }

  console.log(`📂 Encontrados ${files.length} archivos para procesar: ${files.join(', ')}`);
  console.log("🚀 Iniciando proceso de importación masiva...");

  let totalProcessed = 0;

  for (const file of files) {
    const filePath = path.join(scriptsDir, file);
    console.log(`\n📖 Leyendo archivo: ${file}...`);

    try {
      // Leemos con cellDates: true para que XLSX intente parsear las fechas automáticamente
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      console.log(`✅ ${data.length} registros detectados en ${file}. Iniciando subida...`);

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
          birthDate: formatDate(row.FECHA_NACI),
          neighborhoodCity: String(row.BARRIO_CIU || "").trim(),
          importedAt: serverTimestamp()
        };

        batch.set(docRef, cedulaData, { merge: true });

        count++;
        totalProcessed++;

        // Firestore limita batches a 500 operaciones
        if (count % 500 === 0) {
          await batch.commit();
          batch = writeBatch(db);
          process.stdout.write(`\r🚀 Progreso de ${file}: ${count} / ${data.length} | Total global: ${totalProcessed}`);
        }
      }

      // Subir el remanente del archivo actual
      await batch.commit();
      console.log(`\n🎉 Finalizado archivo ${file}. Subidos: ${count} registros.`);

    } catch (error) {
      console.error(`\n❌ Error procesando el archivo ${file}:`, error);
    }
  }

  console.log(`\n✨ PROCESO COMPLETO ✨`);
  console.log(`📊 Total global de registros procesados: ${totalProcessed}`);
  process.exit(0);
}

importExcel().catch(err => {
  console.error("\n💥 Error crítico durante la importación:", err);
  process.exit(1);
});
