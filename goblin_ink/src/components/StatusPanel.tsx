import React from 'react';
import { Box, Text } from 'ink';
import { Character } from '../types';

interface StatusPanelProps {
  playerParty: Character[];
  enemyParty: Character[];
}

interface CharacterStatusProps {
  character: Character;
  isEnemy?: boolean;
}

function CharacterStatus({ character, isEnemy = false }: CharacterStatusProps) {
  const hpPercentage = (character.hp / character.maxHp) * 100;
  const mpPercentage = (character.mp / character.maxMp) * 100;
  
  const getHpColor = (percentage: number) => {
    if (percentage > 70) return 'green';
    if (percentage > 30) return 'yellow';
    return 'red';
  };

  const getMpColor = (percentage: number) => {
    if (percentage > 50) return 'blue';
    if (percentage > 20) return 'magenta';
    return 'red';
  };

  const createBar = (current: number, max: number, length: number = 10) => {
    const filled = Math.floor((current / max) * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
  };

  const status = character.hp <= 0 ? 
    (isEnemy ? '(撃破)' : '(戦闘不能)') : 
    (character.isDefending ? '[防御中]' : '');

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={character.hp <= 0 ? 'gray' : 'white'} bold>
          {character.name}
        </Text>
        {status && (
          <Box marginLeft={1}>
            <Text color={character.hp <= 0 ? 'red' : 'cyan'}>
              {status}
            </Text>
          </Box>
        )}
      </Box>
      
      <Box>
        <Text color={getHpColor(hpPercentage)}>
          HP: {character.hp}/{character.maxHp} 
        </Text>
        <Box marginLeft={1}>
          <Text color={getHpColor(hpPercentage)}>
            {createBar(character.hp, character.maxHp)}
          </Text>
        </Box>
      </Box>
      
      <Box>
        <Text color={getMpColor(mpPercentage)}>
          MP: {character.mp}/{character.maxMp} 
        </Text>
        <Box marginLeft={1}>
          <Text color={getMpColor(mpPercentage)}>
            {createBar(character.mp, character.maxMp)}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

export function StatusPanel({ playerParty, enemyParty }: StatusPanelProps) {
  return (
    <Box flexDirection="row" marginBottom={1}>
      <Box flexDirection="column" flexGrow={1} marginRight={2}>
        <Box borderStyle="single" paddingX={1} marginBottom={1}>
          <Text color="green" bold>味方パーティ</Text>
        </Box>
        {playerParty.map((character, index) => (
          <CharacterStatus key={index} character={character} />
        ))}
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        <Box borderStyle="single" paddingX={1} marginBottom={1}>
          <Text color="red" bold>敵パーティ</Text>
        </Box>
        {enemyParty.map((character, index) => (
          <CharacterStatus key={index} character={character} isEnemy />
        ))}
      </Box>
    </Box>
  );
}