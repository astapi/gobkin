import React from 'react';
import { Box, Text } from 'ink';
import { BattleScreen } from './components';

export default function App() {
  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="double" paddingX={2} paddingY={1} marginBottom={1}>
        <Text color="cyan" bold>
          ゴブリンキングダム RPGバトルシステム
        </Text>
      </Box>
      
      <BattleScreen />
    </Box>
  );
}