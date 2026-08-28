// React Native のグローバル `__DEV__` の型宣言。
// studio は goblin_native の ExpeditionEngine 等を直接型チェック/実行するため、
// RN ランタイム由来の `__DEV__` を参照する。studio(ブラウザ/Vite)側では
// `typeof __DEV__ !== 'undefined'` ガードで安全に false 扱いされるが、
// tsc の型解決のために宣言だけ用意する。
declare const __DEV__: boolean
