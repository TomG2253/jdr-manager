import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Colle ici l'objet de configuration fourni par Firebase
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "votre-projet.firebaseapp.com",
  projectId: "votre-projet",
  storageBucket: "votre-projet.appspot.com",
  messagingSenderId: "123456789",
  appId: "VOTRE_APP_ID"
};

// Initialisation
const app = initializeApp(firebaseConfig);

// Export des outils pour les utiliser dans tes composants React
export const db = getFirestore(app);
export const auth = getAuth(app);