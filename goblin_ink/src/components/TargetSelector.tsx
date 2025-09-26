import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Character } from '../types';

interface TargetSelectorProps {
  targets: Character[];
  onTargetSelected: (target: Character | null) => void;
  title: string;
}

export function TargetSelector({ targets, onTargetSelected, title }: TargetSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < targets.length) {
      setSelectedIndex(selectedIndex + 1);
    } else if (key.return) {
      if (selectedIndex === targets.length) {
        onTargetSelected(null);
      } else {
        onTargetSelected(targets[selectedIndex]);
      }
    } else if (input === '0') {
      onTargetSelected(null);
    } else if (input >= '1' && input <= '9') {
      const index = parseInt(input) - 1;
      if (index >= 0 && index < targets.length) {
        setSelectedIndex(index);
        onTargetSelected(targets[index]);
      }
    }
  });

  if (targets.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="single" padding={1}>
        <Text color="red">対象がいません</Text>
        <Text color="gray">Enterでキャンセル</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" padding={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {title}
        </Text>
      </Box>
      
      {targets.map((target, index) => (
        <Box key={index}>
          <Text color={selectedIndex === index ? 'black' : 'white'}
                backgroundColor={selectedIndex === index ? 'cyan' : undefined}>
            {index + 1}. {target.name} (HP: {target.hp}/{target.maxHp})
          </Text>
        </Box>
      ))}
      
      <Box>
        <Text color={selectedIndex === targets.length ? 'black' : 'white'}
              backgroundColor={selectedIndex === targets.length ? 'cyan' : undefined}>
          0. キャンセル
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <Text color="gray">
          ↑↓キーで選択, Enterで決定, 数字キーで直接選択, 0でキャンセル
        </Text>
      </Box>
    </Box>
  );
}