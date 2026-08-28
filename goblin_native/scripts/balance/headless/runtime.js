'use strict'

/**
 * ヘッドレス・バランスシミュレータ用の Node ランタイム設定。
 *
 * src/ 配下は React Native / Expo 非依存の純 TypeScript だが、`.ts` のままでは
 * Node から読めないため、`typescript` の transpileModule でオンザフライ変換する。
 * あわせて以下を行う:
 *   - パスエイリアス `@/* -> src/*` の解決
 *   - RN / Expo 専用モジュールの最小モック
 *   - `__DEV__` の定義（ExpeditionEngine が参照するため。false = 本番相当の時間で実行）
 *
 * このファイルは副作用目的。エントリ (index.js) の先頭で一度だけ require すること。
 * src プロダクションコードは一切変更していない（読み取り専用で import するのみ）。
 */

const fs = require('fs')
const path = require('path')
const Module = require('module')
const ts = require('typescript')

const projectRoot = path.resolve(__dirname, '..', '..', '..')
const srcRoot = path.join(projectRoot, 'src')

// ExpeditionEngine は `typeof __DEV__ !== 'undefined' ? __DEV__ : false` を見る。
// false にすることで durationSec が短縮されず、エリア規定時間で実行される。
global.__DEV__ = false
process.env.NODE_ENV = process.env.NODE_ENV || 'test'

// --- RN / Expo 専用モジュールのモック ------------------------------------
const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') {
    return {
      getItem: async () => null,
      setItem: async () => undefined,
    }
  }
  if (request === 'expo-localization') {
    return { getLocales: () => [{ languageCode: 'ja' }] }
  }
  return originalLoad.call(this, request, parent, isMain)
}

// --- `@/` エイリアス解決 ---------------------------------------------------
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(
      this,
      path.join(srcRoot, request.slice(2)),
      parent,
      isMain,
      options,
    )
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

// --- `.ts` オンザフライ変換 ------------------------------------------------
require.extensions['.ts'] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  }).outputText
  module._compile(output, filename)
}

// --- import 時に出る i18next の案内ログを抑制 -----------------------------
const bootConsole = { log: console.log, info: console.info, warn: console.warn, error: console.error }
function isI18nNoise(args) {
  return typeof args[0] === 'string' && args[0].includes('i18next')
}
console.log = (...args) => { if (!isI18nNoise(args)) bootConsole.log(...args) }
console.info = (...args) => { if (!isI18nNoise(args)) bootConsole.info(...args) }
console.warn = (...args) => { if (!isI18nNoise(args)) bootConsole.warn(...args) }

/** エンジンの内部ログ（console.log/warn/error）を一時的に無音化して callback を実行する */
function suppressEngineLogs(callback) {
  const saved = { log: console.log, warn: console.warn, error: console.error }
  console.log = () => undefined
  console.warn = () => undefined
  console.error = () => undefined
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      console.log = saved.log
      console.warn = saved.warn
      console.error = saved.error
    })
}

module.exports = { projectRoot, srcRoot, suppressEngineLogs }
