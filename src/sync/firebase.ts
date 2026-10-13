import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyBkYPcZrO7Bh72eAT3APDGIwjBRzN86i8Q',
  authDomain: 'car-tracker-rc.firebaseapp.com',
  projectId: 'car-tracker-rc',
  storageBucket: 'car-tracker-rc.firebasestorage.app',
  messagingSenderId: '190531345231',
  appId: '1:190531345231:web:d66e9a025ae67daac7433a',
});

export const auth = getAuth(app);

// The persistent cache keeps writes made offline queued across reloads.
export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  ignoreUndefinedProperties: true,
});
