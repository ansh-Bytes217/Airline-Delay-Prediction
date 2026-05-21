import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDaosDY93AlbRfJrOZ04gHaQPoPOERka24",
  authDomain: "skypredict-c4532.firebaseapp.com",
  projectId: "skypredict-c4532",
  storageBucket: "skypredict-c4532.firebasestorage.app",
  messagingSenderId: "785553372551",
  appId: "1:785553372551:web:acd1c95dc8badaaa930f22",
  measurementId: "G-7BBFYB1YX2"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Messaging only works in browsers that support it (not Safari < 16)
export const getFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};

export const VAPID_KEY = "BKRk1QIJxp3jD6r4TjaMrU0GEXirPRyqwxTGDB8Zb7oBoEzc0d_8bU-uQGmKLcsBRDXCq66wHvGD0Iedy-tggGM";

export default app;
