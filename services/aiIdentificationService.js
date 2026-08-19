import {
    addDoc,
    collection,
    onSnapshot,
    query,
    serverTimestamp,
    where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const aiIdentificationCollection = collection(db, 'ai_identifications');

// This mock function keeps the AI logic separate, so you can replace it later
// with a real model or external API without changing the screen UI.
export async function identifyMedicineFromImage(imageAsset) {
  const imageName = imageAsset?.fileName?.toLowerCase?.() || '';
  const imageUri = imageAsset?.uri?.toLowerCase?.() || '';

  // Simulate a short delay so the loading state is visible.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (imageName.includes('panadol') || imageUri.includes('panadol')) {
    return 'Panadol 500mg';
  }

  if (imageName.includes('paracetamol') || imageUri.includes('paracetamol')) {
    return 'Paracetamol';
  }

  if (imageName.includes('vitamin') || imageUri.includes('vitamin')) {
    return 'Vitamin C Supplement';
  }

  return 'Sample Prediction: Paracetamol 500mg Tablet';
}

export async function saveIdentificationResult(data) {
  return addDoc(aiIdentificationCollection, {
    ...data,
    created_at: serverTimestamp(),
  });
}

export function subscribeToUserIdentificationHistory(userId, onSuccess, onError) {
  const historyQuery = query(
    aiIdentificationCollection,
    where('user_id', '==', userId)
  );

  return onSnapshot(
    historyQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }))
        .sort((a, b) => {
          const aSeconds = a.created_at?.seconds || 0;
          const bSeconds = b.created_at?.seconds || 0;
          return bSeconds - aSeconds;
        });

      onSuccess(items);
    },
    onError
  );
}
