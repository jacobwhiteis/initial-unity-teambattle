import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, query, orderBy, limit, where, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, writeBatch, Timestamp, arrayUnion } from 'firebase/firestore';
import { getAuth, signInWithPopup, OAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA7kGIAULwsycGbcJa95RKwiLiEjQmFOSA",
  authDomain: "iur-teambattle.firebaseapp.com",
  projectId: "iur-teambattle",
  storageBucket: "iur-teambattle.firebasestorage.app",
  messagingSenderId: "835376362147",
  appId: "1:835376362147:web:a56478d5d516a35b278516"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const discordProvider = new OAuthProvider('oidc.discord');

export {
  db, auth, discordProvider,
  collection, doc, getDoc, getDocs, query, orderBy, limit, where, onSnapshot,
  setDoc, updateDoc, deleteDoc, addDoc, writeBatch, Timestamp, arrayUnion,
  signInWithPopup, onAuthStateChanged, signOut
};
