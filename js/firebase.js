import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, collection, deleteDoc, doc, getDocs, orderBy, query, runTransaction, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'PASTE_FIREBASE_API_KEY_HERE',
  authDomain: 'PASTE_FIREBASE_AUTH_DOMAIN_HERE',
  projectId: 'PASTE_FIREBASE_PROJECT_ID_HERE',
  storageBucket: 'PASTE_FIREBASE_STORAGE_BUCKET_HERE',
  messagingSenderId: 'PASTE_FIREBASE_MESSAGING_SENDER_ID_HERE',
  appId: 'PASTE_FIREBASE_APP_ID_HERE'
};

const firebaseConfigured = Object.values(firebaseConfig).every((value) => value && !value.startsWith('PASTE_'));
const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const googleProvider = app ? new GoogleAuthProvider() : null;

export { auth, collection, db, deleteDoc, doc, firebaseConfigured, getDocs, googleProvider, onAuthStateChanged, orderBy, query, runTransaction, serverTimestamp, signInWithPopup, signOut, writeBatch };
