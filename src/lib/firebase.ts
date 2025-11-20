import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from './firebase-config';

let app: FirebaseApp;
let db: Database;
let storage: FirebaseStorage;

try {
  // Initialize Firebase
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getDatabase(app, firebaseConfig.databaseURL);
  storage = getStorage(app);

  // Log successful initialization
  console.log('Firebase initialized successfully with database URL:', firebaseConfig.databaseURL);
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error; // Re-throw to handle it at a higher level if needed
}

export { app, db, storage };
