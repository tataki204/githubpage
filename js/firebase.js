import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, collection, deleteDoc, doc, getDocs, orderBy, query, runTransaction, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBjKdbmRjAqNMb_t3Dl4kIOqmkTloDF8L8',
  authDomain: 'my-finance-db-93977.firebaseapp.com',
  projectId: 'my-finance-db-93977',
  storageBucket: 'my-finance-db-93977.firebasestorage.app',
  messagingSenderId: '731700153480',
  appId: '1:731700153480:web:dc5d6e4cb730c31c96233d'
};

const firebaseConfigured = Object.values(firebaseConfig).every((value) => value && !value.startsWith('PASTE_'));
const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const googleProvider = app ? new GoogleAuthProvider() : null;

export { auth, collection, db, deleteDoc, doc, firebaseConfigured, getDocs, googleProvider, onAuthStateChanged, orderBy, query, runTransaction, serverTimestamp, signInWithPopup, signOut, writeBatch };
