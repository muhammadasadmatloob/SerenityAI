import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCQE1edP7aquOKmt__HI6ig7Ipnoy3neEM",
  authDomain: "serenityfirebaseauthapp.firebaseapp.com",
  projectId: "serenityfirebaseauthapp",
  storageBucket: "serenityfirebaseauthapp.firebasestorage.app",
  messagingSenderId: "912212577475",
  appId: "1:912212577475:web:aa446b15dd579af3aba676",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
