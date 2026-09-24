// src/services/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const projectFirebaseConfig = {
  apiKey: "AIzaSyD1ULw8t4rIbyOjcGdjXPWt560Vb0fS5-M",
  authDomain: "dashboard-calendar-86678.firebaseapp.com",
  projectId: "dashboard-calendar-86678",
  storageBucket: "dashboard-calendar-86678.firebasestorage.app",
  messagingSenderId: "508631874357",
  appId: "1:508631874357:web:de5805c75985b563c1ea7c",
  measurementId: "G-R2PY7YEL19"
};

const storedCustomConfig = typeof window !== 'undefined' ? window.localStorage?.getItem('custom_firebase_config') : null;
const activeFirebaseConfig = storedCustomConfig ? JSON.parse(storedCustomConfig) : projectFirebaseConfig;

const app = initializeApp(activeFirebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Sanitize appId
const rawAppId = typeof __app_id !== 'undefined' && __app_id ? __app_id : 'trading-journal-prod';
export const appId = String(rawAppId).replace(/[^a-zA-Z0-9_-]/g, '_');
