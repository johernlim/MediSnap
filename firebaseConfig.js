import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  inMemoryPersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/** @type {import('firebase/auth').Auth} */
let auth;

// Your Firebase config
const firebaseConfig = {
  apiKey: 'AIzaSyA0mfl8H9hXChJg3U-j4VvPSGnjd2mIiLo',
  authDomain: 'medisnap-8e1a9.firebaseapp.com',
  projectId: 'medisnap-8e1a9',
  storageBucket: 'medisnap-8e1a9.firebasestorage.app',
  messagingSenderId: '663413278453',
  appId: '1:663413278453:web:ceb55b88e3f13ac651a7bc',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

try {
  auth = initializeAuth(app, {
    persistence: inMemoryPersistence,
  });
} catch (error) {
  auth = getAuth(app);
}

const db = getFirestore(app);

export { auth, db };
export default app;
