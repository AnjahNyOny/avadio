import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

// Initialize Firebase only if config is provided
let app, db, storage, auth;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    storage = getStorage(app);
    auth = getAuth(app);

    // Authenticate anonymously for easy room joining
    signInAnonymously(auth).catch((error) => {
      console.error("Erreur d'authentification anonyme:", error);
    });
  } else {
    console.warn("Firebase config is missing. Please set VITE_FIREBASE_* in .env file.");
  }
} catch (error) {
  console.error("Erreur d'initialisation Firebase:", error);
}

export { db, storage, auth };
