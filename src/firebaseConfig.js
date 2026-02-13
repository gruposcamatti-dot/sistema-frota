// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, disableNetwork, enableNetwork } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBiwpJy2mMV9MZZqueXoZepUoSseFHlBTA",
  authDomain: "gestao-frotas-36b82.firebaseapp.com",
  projectId: "gestao-frotas-36b82",
  storageBucket: "gestao-frotas-36b82.firebasestorage.app",
  messagingSenderId: "759359119410",
  appId: "1:759359119410:web:bca636ad4bed9bf808dc2b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Desabilitar cache/persistência para evitar dados fantasma
const db = getFirestore(app);

// Importante: NÃO habilitar persistência para evitar cache de documentos excluídos
// enableIndexedDbPersistence(db); // DESABILITADO PROPOSITALMENTE

export { db };

// Nova função de Login com Email e Senha
export const loginComEmailSenha = (email, senha) => {
  return signInWithEmailAndPassword(auth, email, senha);
};

export const fazerLogout = () => {
  return signOut(auth);
};