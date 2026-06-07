// Firebase Cloud Messaging Service Worker
// Firebase Console のプロジェクト設定から取得した値で置き換えてください
importScripts("https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: self.VITE_FIREBASE_API_KEY || "",
  authDomain: self.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: self.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: self.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: self.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: self.VITE_FIREBASE_APP_ID || "",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "通知";
  const options = {
    body: payload.notification?.body ?? "",
    icon: "/vite.svg",
  };
  self.registration.showNotification(title, options);
});
