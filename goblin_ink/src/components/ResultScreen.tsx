import React from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import { BattleState } from '../types';

interface ResultScreenProps {
  battleState: BattleState;
  onExit?: () => void;
}

export function ResultScreen({ battleState, onExit }: ResultScreenProps) {
  useInput((input: string, key: Key) => {
    if (key.return || input === 'q' || input === 'Q') {
      if (onExit) {
        onExit();
      } else {
        process.exit(0);
      }
    }
  });

  const getResultColor = () => {
    if (battleState.playerWon === true) return 'green';
    if (battleState.playerWon === false) return 'red';
    return 'yellow';
  };

  const getResultText = () => {
    if (battleState.playerWon === true) return '勝利！';
    if (battleState.playerWon === false) return '全滅してしまった...';
    return '逃走成功！';
  };

  const renderRewards = () => {
    if (battleState.playerWon !== true) return null;

    const gold = Math.floor(Math.random() * 16) + 30;
    const hasItem = Math.random() < 0.2;

    return (
      <Box flexDirection="column" marginTop={2}>
        <Text color="yellow" bold>【報酬】</Text>
        <Text color="cyan">EXP: 54</Text>
        <Text color="yellow">GOLD: {gold}</Text>
        {hasItem && (
          <Text color="green">アイテム: 回復薬(小) を手に入れた！</Text>
        )}
      </Box>
    );
  };

  return (
    <Box 
      flexDirection="column" 
      alignItems="center" 
      justifyContent="center" 
      height="100%"
      borderStyle="double"
      padding={2}
    >
      <Box borderStyle="double" padding={2} marginBottom={2}>
        <Text color="cyan" bold>
          バトル終了
        </Text>
      </Box>

      <Box marginBottom={2}>
        <Text color={getResultColor()} bold>
          {getResultText()}
        </Text>
      </Box>

      {renderRewards()}

      <Box marginTop={3} borderStyle="single" padding={1}>
        <Text color="gray">
          Enterキーまたは Q キーでゲーム終了
        </Text>
      </Box>

      <Box marginTop={2} flexDirection="column" alignItems="center">
        <Text color="cyan" bold>最終ターン数: {battleState.turn}</Text>
        
        {battleState.playerWon === true && (
          <Box flexDirection="column" marginTop={1} alignItems="center">
            <Text color="green">素晴らしい戦いでした！</Text>
            <Text color="cyan">ゴブリンたちの勇気が勝利を導きました。</Text>
          </Box>
        )}

        {battleState.playerWon === false && (
          <Box flexDirection="column" marginTop={1} alignItems="center">
            <Text color="red">力及ばず...</Text>
            <Text color="yellow">次回はより慎重に戦いましょう。</Text>
          </Box>
        )}

        {battleState.playerWon === undefined && (
          <Box flexDirection="column" marginTop={1} alignItems="center">
            <Text color="yellow">時には撤退も大切な判断です。</Text>
            <Text color="cyan">ゴブリンたちは無事に逃げ延びました。</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
