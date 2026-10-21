import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCs1kSas2vIL_JJauHFwmxEz0KFS2RcXMs",
  authDomain: "jdr-manager-bdd.firebaseapp.com",
  projectId: "jdr-manager-bdd",
  storageBucket: "jdr-manager-bdd.firebasestorage.app",
  messagingSenderId: "657303670946",
  appId: "1:657303670946:web:249edb4e717f203734c7fb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export des outils pour les utiliser dans tes composants React
export const db = getFirestore(app);
export const auth = getAuth(app);