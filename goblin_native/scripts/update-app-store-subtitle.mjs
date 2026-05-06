#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const TARGET_LOCALE = 'ja';
const TARGET_SUBTITLE = '戦略放置xモンスター育成';
const BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

function loadEnv() {
  const envPath = path.join(projectRoot, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    if (!key || valueParts.length === 0) continue;
    env[key.trim()] = valueParts.join('=').trim();
  }

  return env;
}

function validateConfig(config) {
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  if (!fs.existsSync(config.privateKeyPath)) {
    throw new Error(`Private key file not found: ${config.privateKeyPath}`);
  }

  if ([...TARGET_SUBTITLE].length > 30) {
    throw new Error(`App Store subtitle exceeds 30 characters: ${TARGET_SUBTITLE}`);
  }
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createJwt(config) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'ES256',
    kid: config.keyId,
    typ: 'JWT',
  };
  const payload = {
    iss: config.issuerId,
    iat: now,
    exp: now + 20 * 60,
    aud: 'appstoreconnect-v1',
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload)
  )}`;
  const privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  return `${signingInput}.${base64url(signature)}`;
}

async function apiRequest(config, endpoint, options = {}) {
  const token = createJwt(config);
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function main() {
  const env = loadEnv();
  const config = {
    issuerId: env.APP_STORE_CONNECT_ISSUER_ID,
    keyId: env.APP_STORE_CONNECT_KEY_ID,
    privateKeyPath: env.APP_STORE_CONNECT_PRIVATE_KEY_PATH,
    appId: env.APP_STORE_CONNECT_APP_ID,
  };

  validateConfig(config);

  console.log('App Store Connect サブタイトル更新');
  console.log(`対象ロケール: ${TARGET_LOCALE}`);
  console.log(`更新後サブタイトル: ${TARGET_SUBTITLE}`);
  console.log(`文字数: ${[...TARGET_SUBTITLE].length}/30\n`);

  const app = await apiRequest(config, `/apps/${config.appId}`);
  console.log(`対象アプリ: ${app.data.attributes.name}`);
  console.log(`Bundle ID: ${app.data.attributes.bundleId}\n`);

  const appInfos = await apiRequest(config, `/apps/${config.appId}/appInfos`);
  const appInfo = appInfos.data.find(
    (info) => info.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION'
  );

  if (!appInfo) {
    const states = appInfos.data
      .map((info) => info.attributes.appStoreState)
      .join(', ');
    throw new Error(`PREPARE_FOR_SUBMISSION の App Info が見つかりません: ${states}`);
  }

  console.log(`App Info ID: ${appInfo.id}`);
  console.log(`State: ${appInfo.attributes.appStoreState}\n`);

  const localizations = await apiRequest(
    config,
    `/appInfos/${appInfo.id}/appInfoLocalizations`
  );
  const target = localizations.data.find(
    (loc) => loc.attributes.locale === TARGET_LOCALE
  );

  if (!target) {
    const locales = localizations.data
      .map((loc) => loc.attributes.locale)
      .join(', ');
    throw new Error(`${TARGET_LOCALE} ローカライゼーションが見つかりません: ${locales}`);
  }

  const currentSubtitle = target.attributes.subtitle ?? '';
  if (currentSubtitle === TARGET_SUBTITLE) {
    console.log('既に目的のサブタイトルです。更新は不要です。');
    return;
  }

  await apiRequest(config, `/appInfoLocalizations/${target.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'appInfoLocalizations',
        id: target.id,
        attributes: {
          subtitle: TARGET_SUBTITLE,
        },
      },
    }),
  });

  console.log('更新完了');
  console.log(`変更前: ${currentSubtitle || '(なし)'}`);
  console.log(`変更後: ${TARGET_SUBTITLE}`);
}

main().catch((error) => {
  console.error('エラー:', error.message);
  process.exit(1);
});
