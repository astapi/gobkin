# Firebase / Firestore 設定ガイド

このプロジェクトではFirestoreを使用してパーティデータの永続化を行うことができます。

## 1. Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. Cloud Firestoreを有効化
4. Authenticationを有効化し、匿名認証を有効にする:
   - Authentication > 開始
   - Sign-in methodタブ > 匿名 > 有効にする

## 2. 環境変数の設定

1. `.env.local` ファイルを編集
2. Firebase Console > プロジェクト設定 > マイアプリ から設定値を取得
3. 以下の環境変数を設定:

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Firestoreを有効化
VITE_USE_FIRESTORE=true
```

## 3. Firestoreルールの設定

Firebase Console > Firestore Database > ルール で以下を設定:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザー固有のパーティデータへの読み書きを許可
    match /users/{userId}/parties/{partyId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**重要**: この設定により、認証されたユーザーは自分のデータのみアクセス可能になります。匿名認証により自動的にユーザーIDが割り当てられ、ユーザー毎にデータが分離されます。

## 4. 動作確認

1. 開発サーバーを再起動: `npm run dev`
2. アプリケーション起動時に「認証中...」表示が一瞬出ることを確認
3. アプリケーションでパーティの編成・保存を試行
4. Firebase Console で以下を確認:
   - Authentication > ユーザー に匿名ユーザーが作成されていること
   - Firestore Database で `users/{user-id}/parties` の形式でデータが保存されていること

## 5. localStorageとの切り替え

`VITE_USE_FIRESTORE=false` に設定することで、従来のlocalStorageベースの保存に戻すことができます。

## トラブルシューティング

### Firebase設定エラー
- 環境変数が正しく設定されているか確認
- Firebaseプロジェクトの設定値が正確か確認

### Firestoreアクセスエラー
- Firestoreのルールが適切に設定されているか確認
- プロジェクトIDが正しいか確認

### 初期データが表示されない
- アプリケーション初回起動時は自動的にデフォルトパーティが作成されます
- Firebase Console でデータが作成されているか確認してください