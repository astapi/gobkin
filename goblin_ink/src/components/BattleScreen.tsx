import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import { BattleState, BattleCommand, Character, CommandType } from '../types';
import { createPlayerParty, createEnemyParty } from '../data';
import {
  determineActionOrder,
  executeCommand,
  checkBattleEnd,
  resetDefendingState,
} from '../battle';
import { generateAllEnemyCommands } from '../ai';
import { StatusPanel } from './StatusPanel';
import { CommandMenu } from './CommandMenu';
import { BattleLog } from './BattleLog';
import { ResultScreen } from './ResultScreen';

interface GamePhase {
  type: 'command_selection' | 'action_execution' | 'battle_result';
  currentCharacterIndex?: number;
}

export function BattleScreen() {
  const [battleState, setBattleState] = useState<BattleState>(() => ({
    playerParty: createPlayerParty(),
    enemyParty: createEnemyParty(),
    turn: 1,
    isPlayerTurn: true,
    battleLog: [],
    isFinished: false,
    playerWon: undefined,
  }));

  const [gamePhase, setGamePhase] = useState<GamePhase>({ 
    type: 'command_selection',
    currentCharacterIndex: 0
  });

  const [playerCommands, setPlayerCommands] = useState<BattleCommand[]>([]);
  const [actionQueue, setActionQueue] = useState<BattleCommand[]>([]);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);

  useEffect(() => {
    if (battleState.isFinished) {
      setGamePhase({ type: 'battle_result' });
    }
  }, [battleState.isFinished]);

  const handleCommandSelected = (command: BattleCommand) => {
    const newCommands = [...playerCommands, command];
    setPlayerCommands(newCommands);
    
    if (command.type === 'escape') {
      const results = executeCommand(command, battleState);
      setBattleState(prev => ({
        ...prev,
        battleLog: [...prev.battleLog, ...results.map(r => r.message)]
      }));
      
      if (results.some(r => r.escapeSuccess)) {
        setBattleState(prev => ({ ...prev, isFinished: true, playerWon: undefined }));
        return;
      }
    }

    const nextCharacterIndex = (gamePhase.currentCharacterIndex || 0) + 1;
    const alivePlayerCharacters = battleState.playerParty.filter(c => c.hp > 0);
    
    if (nextCharacterIndex >= alivePlayerCharacters.length || command.type === 'escape') {
      const enemyCommands = generateAllEnemyCommands(battleState);
      const allCommands = [...newCommands, ...enemyCommands].filter(cmd => cmd.type !== 'escape');
      const orderedCommands = determineActionOrder(allCommands);
      
      setActionQueue(orderedCommands);
      setCurrentActionIndex(0);
      setGamePhase({ type: 'action_execution' });
    } else {
      setGamePhase({ 
        type: 'command_selection',
        currentCharacterIndex: nextCharacterIndex 
      });
    }
  };

  const executeNextAction = () => {
    if (currentActionIndex < actionQueue.length) {
      const command = actionQueue[currentActionIndex];
      const results = executeCommand(command, battleState);
      
      setBattleState(prev => {
        const newState = { ...prev };
        checkBattleEnd(newState);
        return {
          ...newState,
          battleLog: [...prev.battleLog, ...results.map(r => r.message)]
        };
      });
      
      setCurrentActionIndex(prev => prev + 1);
    } else {
      resetDefendingState([...battleState.playerParty, ...battleState.enemyParty]);
      setPlayerCommands([]);
      setActionQueue([]);
      setCurrentActionIndex(0);
      setBattleState(prev => ({ ...prev, turn: prev.turn + 1 }));
      setGamePhase({ 
        type: 'command_selection',
        currentCharacterIndex: 0 
      });
    }
  };

  useInput((input: string, key: Key) => {
    if (gamePhase.type === 'action_execution' && key.return) {
      executeNextAction();
    }
  });

  const getCurrentCharacter = () => {
    const aliveCharacters = battleState.playerParty.filter(c => c.hp > 0);
    return aliveCharacters[gamePhase.currentCharacterIndex || 0];
  };

  if (gamePhase.type === 'battle_result') {
    return <ResultScreen battleState={battleState} />;
  }

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="double" padding={1}>
        <Text color="cyan" bold>
          ゴブリンキングダム RPGバトル - ターン {battleState.turn}
        </Text>
      </Box>

      <Box flexGrow={1} flexDirection="row">
        <Box flexGrow={1} flexDirection="column">
          <StatusPanel 
            playerParty={battleState.playerParty}
            enemyParty={battleState.enemyParty}
          />
          
          {gamePhase.type === 'command_selection' && (
            <CommandMenu
              character={getCurrentCharacter()}
              battleState={battleState}
              onCommandSelected={handleCommandSelected}
            />
          )}
          
          {gamePhase.type === 'action_execution' && (
            <Box borderStyle="single" padding={1}>
              <Text>
                アクション実行中... (Enterキーで次の行動へ)
                {currentActionIndex < actionQueue.length && 
                  ` - ${actionQueue[currentActionIndex].actor.name}の行動`}
              </Text>
            </Box>
          )}
        </Box>

        <Box width={40} flexDirection="column">
          <BattleLog messages={battleState.battleLog} />
        </Box>
      </Box>
    </Box>
  );
}
