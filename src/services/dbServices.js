import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
// IMPORTANTE: Ajusta esta importación para que apunte a donde tienes exportado tu "db" de Firebase
// Si aún no lo has separado, asegúrate de tener "export const db = getFirestore(app);" en tu archivo de config.
import { db } from '../firebaseConfig'; 

export async function transitionToFunded(userId, accountId, currentCycleId, initialBalance, newTargetProfit = 0) {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // 1. Cerrar ciclo actual como PASSED
  const currentCycleRef = doc(db, `users/${userId}/cycles/${currentCycleId}`);
  batch.update(currentCycleRef, { 
    status: 'passed', 
    endDate: now.split('T')[0], 
    updatedAt: serverTimestamp() 
  });

  // 2. Crear nuevo ciclo FUNDED
  const newCycleRef = doc(collection(db, `users/${userId}/cycles`));
  batch.set(newCycleRef, {
    cycleId: newCycleRef.id,
    accountId,
    type: 'funded',
    status: 'active',
    startDate: now.split('T')[0],
    endDate: null,
    initialBalance: Number(initialBalance),
    targetProfit: Number(newTargetProfit),
    createdAt: serverTimestamp()
  });

  // 3. Actualizar puntero de la cuenta
  const accountRef = doc(db, `users/${userId}/accounts/${accountId}`);
  batch.update(accountRef, { 
    status: 'funded', 
    activeCycleId: newCycleRef.id, 
    targetProfit: Number(newTargetProfit), 
    updatedAt: serverTimestamp() 
  });

  await batch.commit();
}

export async function resetAccountCycle(userId, accountId, currentCycleId, cycleType, initialBalance, targetProfit, reason = 'failed') {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // 1. Archivar el ciclo fallido / anterior
  const currentCycleRef = doc(db, `users/${userId}/cycles/${currentCycleId}`);
  batch.update(currentCycleRef, { 
    status: reason, 
    endDate: now.split('T')[0], 
    updatedAt: serverTimestamp() 
  });

  // 2. Generar el nuevo ciclo desde cero
  const newCycleRef = doc(collection(db, `users/${userId}/cycles`));
  batch.set(newCycleRef, {
    cycleId: newCycleRef.id,
    accountId,
    type: cycleType || 'eval',
    status: 'active',
    startDate: now.split('T')[0],
    endDate: null,
    initialBalance: Number(initialBalance),
    targetProfit: Number(targetProfit),
    createdAt: serverTimestamp()
  });

  // 3. Vincular la cuenta principal con el nuevo ciclo
  const accountRef = doc(db, `users/${userId}/accounts/${accountId}`);
  batch.update(accountRef, { 
    activeCycleId: newCycleRef.id, 
    updatedAt: serverTimestamp() 
  });

  await batch.commit();
}
