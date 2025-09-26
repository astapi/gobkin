import React from 'react';
import { render } from 'ink';
import App from './app';

async function main(): Promise<void> {
  try {
    const { waitUntilExit } = render(<App />);
    await waitUntilExit();
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main().catch(console.error);