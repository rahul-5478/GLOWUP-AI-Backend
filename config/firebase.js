// frontend123/src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBi0AfprL9aB9cSqeU1KgckNKAvKXciuYg",
  authDomain: "glowup-ai-21863.firebaseapp.com",
  projectId: "glowup-ai-21863",
  storageBucket: "glowup-ai-21863.firebasestorage.app",
  messagingSenderId: "982095533743",
  appId: "REPLACE_WITH_YOUR_APP_ID", // scroll karke appId copy karo
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;