import React from 'react';
import { Box, Text } from 'ink';

interface BattleLogProps {
  messages: string[];
  maxLines?: number;
}

export function BattleLog({ messages, maxLines = 15 }: BattleLogProps) {
  const displayMessages = messages.slice(-maxLines);

  return (
    <Box flexDirection="column" borderStyle="single" padding={1} height={20}>
      <Box borderStyle="single" paddingX={1} marginBottom={1}>
        <Text color="yellow" bold>
          バトルログ
        </Text>
      </Box>
      
      <Box flexDirection="column" flexGrow={1}>
        {displayMessages.length === 0 ? (
          <Text color="gray">バトル開始...</Text>
        ) : (
          displayMessages.map((message, index) => (
            <Text key={index} wrap="wrap">
              {message}
            </Text>
          ))
        )}
      </Box>
      
      {messages.length > maxLines && (
        <Text color="gray" italic>
          ...({messages.length - maxLines}行省略)
        </Text>
      )}
    </Box>
  );
}