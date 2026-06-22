import { useEffect } from "react";
import { getApps, getApp, initializeApp } from "firebase/app";
import { getMessaging, getToken, deleteToken } from "firebase/messaging";
import { apiClient } from "@/lib/apiClient";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const isFirebaseConfigured = !!firebaseConfig.projectId;

export const useFCMToken = (): void => {
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    const registerToken = async (): Promise<void> => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.warn("[FCM] 通知権限が拒否されています");
          return;
        }

        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        const messaging = getMessaging(app);

        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );

        // 既存のサブスクリプションが有効かチェック
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          console.log("[FCM] 既存のプッシュサブスクリプションが有効です");
        } else {
          console.warn("[FCM] プッシュサブスクリプションが存在しません。再登録します");
          // 古いFCMトークンを削除して再取得を強制
          try {
            await deleteToken(messaging);
          } catch {
            // ignore
          }
        }

        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined,
          serviceWorkerRegistration: registration,
        });

        if (token) {
          console.log("[FCM] トークン取得成功:", token.slice(0, 20) + "...");
          await apiClient.post("/api/auth/fcm-token", { token });
        } else {
          console.warn("[FCM] トークンが取得できませんでした");
        }
      } catch (error) {
        console.warn("FCMトークンの登録に失敗しました:", error);
      }
    };

    void registerToken();
  }, []);
};
