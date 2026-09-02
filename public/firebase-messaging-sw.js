/* eslint-disable no-undef */
/**
 * FCM バックグラウンド受信用の Service Worker。
 *
 * Service Worker は静的ファイルとして配信されるためビルド時の環境変数を読めない。
 * そのため、登録時にクエリパラメータで Firebase の設定値を渡している
 * （lib/firebase/messaging.ts の registerServiceWorker を参照）。
 * Firebase の Web 設定値は公開前提の値であり、アクセス制御はセキュリティルールで担保する。
 */
importScripts(
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js",
);

const params = new URL(self.location).searchParams;

const firebaseConfig = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (firebaseConfig.apiKey && firebaseConfig.messagingSenderId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // ⚠️ 重要:
  // サーバー側は webpush.notification を含むペイロードを送っているため、
  // FCM SDK がバックグラウンド通知を**自動的に表示**する。
  // ここで showNotification() を呼ぶと通知が二重に表示されるので呼ばないこと。
  // クリック時の遷移は webpush.fcmOptions.link が処理する。
  messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw] バックグラウンド受信", payload);
  });
} else {
  console.warn(
    "[firebase-messaging-sw] Firebase の設定値が渡されていません。通知は動作しません。",
  );
}
