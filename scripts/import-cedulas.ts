/**
 * SCRIPT DE IMPORTACIÓN MASIVA DE EXCEL A FIRESTORE
 * 
 * Este script lee todos los archivos Excel de la carpeta /scripts (cedula1.xlsx, etc.)
 * y los sube a la colección 'cedulas'.
 * 
 * SEGURIDAD CONTRA DUPLICADOS: 
 * El script usa el número de C.I. como ID del documento. Si vuelves a correr el script,
 * NO se crearán registros duplicados, solo se actualizarán los existentes.
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';

// Configuración de Firebase
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

function formatDate(val: any): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(val);
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');
      return `${date.y}-${month}-${day}`;
    } catch (e) {
      return String(val);
    }
  }
  return String(val).trim();
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function importExcel() {
  const scriptsDir = path.join(process.cwd(), 'scripts');
  
  if (!fs.existsSync(scriptsDir)) {
    console.error("❌ La carpeta /scripts no existe.");
    return;
  }

  const files = fs.readdirSync(scriptsDir).filter(f => 
    (f.toLowerCase().startsWith('cedula') && (f.endsWith('.xlsx') || f.endsWith('.xls')))
  ).sort();

  if (files.length === 0) {
    console.log("❌ No se encontraron archivos Excel.");
    return;
  }

  console.log(`📂 Procesando: ${files.join(', ')}`);
  console.log("💡 Nota: El sistema usa el N° de C.I. como clave única. NO se crearán duplicados si vuelves a subir un archivo.");

  let totalProcessed = 0;
  const startTime = Date.now();

  for (const file of files) {
    const filePath = path.join(scriptsDir, file);
    console.log(`\n📖 Leyendo: ${file}...`);

    try {
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      console.log(`✅ ${data.length} registros detectados. Iniciando subida segura...`);

      let count = 0;
      let batch = writeBatch(db);

      for (const row of data) {
        const cedulaNumber = String(row.NUMERO_CED || "").trim();
        if (!cedulaNumber || cedulaNumber === "" || cedulaNumber === "null") continue;

        // Al usar el número de cédula como ID, evitamos duplicados automáticamente
        const docRef = doc(db, 'cedulas', cedulaNumber);
        
        const cedulaData = {
          NUMERO_CED: cedulaNumber,
          APELLIDO: String(row.APELLIDO || "").trim(),
          NOMBRE: String(row.NOMBRE || "").trim(),
          SEXO: String(row.SEXO || "").trim(),
          NACIONAL: String(row.NACIONAL || "").trim(),
          NOM_PADRE: String(row.NOM_PADRE || "").trim(),
          NOM_MADRE: String(row.NOM_MADRE || "").trim(),
          DIRECCION: String(row.DIRECCION || "").trim(),
          NOM_CONJ: String(row.NOM_CONJ || "").trim(),
          FECHA_NACI: formatDate(row.FECHA_NACI),
          BARRIO_CIU: String(row.BARRIO_CIU || "").trim(),
          importedAt: serverTimestamp()
        };

        batch.set(docRef, cedulaData, { merge: true });
        count++;

        if (count % 500 === 0) {
          await batch.commit();
          totalProcessed += 500;
          batch = writeBatch(db);
          process.stdout.write(`\r🚀 Progreso: ${totalProcessed} registros guardados...`);
          if (totalProcessed % 2500 === 0) await sleep(200); 
        }
      }

      if (count % 500 !== 0) {
        await batch.commit();
        totalProcessed += (count % 500);
      }
      
      console.log(`\n🎉 Archivo ${file} completado.`);

    } catch (error) {
      console.error(`\n❌ Error crítico:`, error);
      break;
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\n✨ PROCESO FINALIZADO ✨`);
  console.log(`📊 Total global: ${totalProcessed} registros únicos en base de datos.`);
  console.log(`⏱️ Tiempo: ${totalTime.toFixed(1)} segundos`);
  process.exit(0);
}

importExcel().catch(err => {
  console.error(err);
  process.exit(1);
});