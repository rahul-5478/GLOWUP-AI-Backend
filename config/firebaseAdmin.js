// backend/config/firebaseAdmin.js
const admin = require("firebase-admin");

let initialized = false;

const initFirebase = () => {
  if (initialized) return admin;

  // Option 1: Using environment variables (recommended for Render)
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace \n in private key (Render adds literal \n)
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
    initialized = true;
    console.log("✅ Firebase Admin initialized");
  } else {
    console.warn("⚠️ Firebase env vars missing — mobile OTP disabled");
  }

  return admin;
};

const verifyFirebaseToken = async (idToken) => {
  const firebaseAdmin = initFirebase();
  if (!initialized) throw new Error("Firebase not configured");
  const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
  return decoded;
};

module.exports = { verifyFirebaseToken, initFirebase };