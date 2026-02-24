/**
 * SCRIPT DE IMPORTACIÓN MASIVA DE EXCEL A FIRESTORE
 * 
 * Este script lee todos los archivos Excel de la carpeta /scripts (cedula1.xlsx, cedula2.xlsx, etc.)
 * y los sube a la colección 'cedulas' mapeando los campos específicos proporcionados por el usuario.
 * Optimizado para manejar cientos de miles de registros mediante batches y esperas controladas.
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
    try {
      const date = XLSX.SSF.parse_date_code(val);
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');
      return `${date.y}-${month}-${day}`;
    } catch (e) {
      return String(val);
    }
  }
  
  // Si es un string, intentamos limpiar espacios
  return String(val).trim();
}

/**
 * Espera controlada para evitar saturar el flujo de escritura de Firestore
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function importExcel() {
  const scriptsDir = path.join(process.cwd(), 'scripts');
  
  if (!fs.existsSync(scriptsDir)) {
    console.error("❌ La carpeta /scripts no existe en la raíz del proyecto.");
    return;
  }

  // Filtramos archivos que empiecen con 'cedula' y terminen en excel
  const files = fs.readdirSync(scriptsDir).filter(f => 
    (f.toLowerCase().startsWith('cedula') && (f.endsWith('.xlsx') || f.endsWith('.xls')))
  ).sort((a, b) => {
    // Ordenamos numéricamente para procesar en orden: cedula1, cedula2...
    const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
    const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
    return numA - numB;
  });

  if (files.length === 0) {
    console.log("❌ No se encontraron archivos Excel (cedula1.xlsx, etc.) en la carpeta /scripts");
    console.log("💡 Instrucciones: Sube tus archivos a la carpeta 'scripts' y vuelve a ejecutar.");
    return;
  }

  console.log(`📂 Encontrados ${files.length} archivos para procesar: ${files.join(', ')}`);
  console.log("🚀 Iniciando proceso de importación masiva (Bloques de 500)...");

  let totalProcessed = 0;
  const startTime = Date.now();

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
        
        if (!cedulaNumber || cedulaNumber === "undefined" || cedulaNumber === "" || cedulaNumber === "null") continue;

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

        // Firestore limita batches a 500 operaciones
        if (count % 500 === 0) {
          await batch.commit();
          totalProcessed += 500;
          batch = writeBatch(db);
          
          const elapsed = (Date.now() - startTime) / 1000;
          process.stdout.write(`\r🚀 Progreso Global: ${totalProcessed} registros | Tiempo: ${elapsed.toFixed(1)}s`);
          
          // Pequeña pausa cada 2500 registros para no saturar los límites de Firestore en ráfagas grandes
          if (totalProcessed % 2500 === 0) {
            await sleep(200); 
          }
        }
      }

      // Subir el remanente del archivo actual
      if (count % 500 !== 0) {
        await batch.commit();
        totalProcessed += (count % 500);
      }
      
      console.log(`\n🎉 Finalizado archivo ${file}. Registros subidos en este archivo: ${count}.`);

    } catch (error) {
      console.error(`\n❌ Error crítico procesando el archivo ${file}:`, error);
      console.log("💡 Verificando si las reglas de Firestore permiten escritura en la colección 'cedulas'...");
      break; // Detener si hay un error de permisos
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\n✨ PROCESO FINALIZADO ✨`);
  console.log(`📊 Total global de registros procesados con éxito: ${totalProcessed}`);
  console.log(`⏱️ Tiempo total de ejecución: ${totalTime.toFixed(1)} segundos`);
  process.exit(0);
}

importExcel().catch(err => {
  console.error("\n💥 Error fatal durante la importación:", err);
  process.exit(1);
});