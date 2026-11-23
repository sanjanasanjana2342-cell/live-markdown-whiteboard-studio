import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let db = null;
if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

export async function saveCloudSnippet(id, title, content) {
  if (!db) throw new Error('Firebase environment variables are not configured.');
  await setDoc(doc(db, 'notebooks', id), {
    title,
    content,
    updatedAt: new Date().toISOString()
  });
}

export async function loadCloudSnippet(id) {
  if (!db) throw new Error('Firebase environment variables are not configured.');
  const snap = await getDoc(doc(db, 'notebooks', id));
  return snap.exists() ? snap.data() : null;
}
