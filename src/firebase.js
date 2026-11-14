import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCs1kSas2vIL_JJauHFwmxEz0KFS2RcXMs",
  authDomain: "jdr-manager-bdd.firebaseapp.com",
  projectId: "jdr-manager-bdd",
  storageBucket: "jdr-manager-bdd.firebasestorage.app",
  messagingSenderId: "657303670946",
  appId: "1:657303670946:web:249edb4e717f203734c7fb"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// Instance secondaire dédiée aux opérations Admin
const secondaryApp = getApps().find(a => a.name === "SecondaryApp") || initializeApp(firebaseConfig, "SecondaryApp");
export const secondaryAuth = getAuth(secondaryApp);