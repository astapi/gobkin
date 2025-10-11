import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import { Character, BattleState, BattleCommand, CommandType, Skill } from '../types';
import { skills } from '../data';
import { TargetSelector } from './TargetSelector';

interface CommandMenuProps {
  character: Character;
  battleState: BattleState;
  onCommandSelected: (command: BattleCommand) => void;
}

type MenuState = 
  | { type: 'main' }
  | { type: 'skill' }
  | { type: 'target', commandType: CommandType, skill?: Skill }
  | { type: 'heal_target', skill: Skill };

const mainCommands: { key: string; label: string; type: CommandType }[] = [
  { key: '1', label: 'たたかう', type: 'attack' },
  { key: '2', label: 'スキル/まほう', type: 'skill' },
  { key: '3', label: 'ぼうぎょ', type: 'defend' },
  { key: '4', label: 'どうぐ', type: 'item' },
  { key: '5', label: 'にげる', type: 'escape' },
];

export function CommandMenu({ character, battleState, onCommandSelected }: CommandMenuProps) {
  const [menuState, setMenuState] = useState<MenuState>({ type: 'main' });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const availableSkills = character.skills.filter(s => s.id !== 'attack');

  useEffect(() => {
    setMenuState({ type: 'main' });
    setSelectedIndex(0);
  }, [character.id]);

  useInput((input: string, key: Key) => {
    if (menuState.type === 'main') {
      if (key.upArrow && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      } else if (key.downArrow && selectedIndex < mainCommands.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      } else if (key.return) {
        const command = mainCommands[selectedIndex];
        handleMainCommandSelection(command.type);
      } else if (input >= '1' && input <= '5') {
        const index = parseInt(input) - 1;
        if (index >= 0 && index < mainCommands.length) {
          setSelectedIndex(index);
          handleMainCommandSelection(mainCommands[index].type);
        }
      }
    } else if (menuState.type === 'skill') {
      if (key.upArrow && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      } else if (key.downArrow && selectedIndex < availableSkills.length) {
        setSelectedIndex(selectedIndex + 1);
      } else if (key.return) {
        if (selectedIndex === availableSkills.length) {
          setMenuState({ type: 'main' });
          setSelectedIndex(2);
        } else {
          const skill = availableSkills[selectedIndex];
          if (character.mp >= skill.mpCost) {
            if (skill.type === 'heal') {
              setMenuState({ type: 'heal_target', skill });
            } else {
              setMenuState({ type: 'target', commandType: 'skill', skill });
            }
          }
        }
      } else if (input === '0') {
        setMenuState({ type: 'main' });
        setSelectedIndex(2);
      }
    }
  });

  const handleMainCommandSelection = (commandType: CommandType) => {
    switch (commandType) {
      case 'attack':
        setMenuState({ type: 'target', commandType: 'attack' });
        setSelectedIndex(0);
        break;
      case 'skill':
        if (availableSkills.length === 0) {
          return;
        }
        setMenuState({ type: 'skill' });
        setSelectedIndex(0);
        break;
      case 'defend':
        onCommandSelected({
          actor: character,
          type: 'defend',
          priority: character.agi,
        });
        break;
      case 'item':
        break;
      case 'escape':
        onCommandSelected({
          actor: character,
          type: 'escape',
          priority: character.agi,
        });
        break;
    }
  };

  const handleTargetSelected = (target: Character | null) => {
    if (!target) {
      setMenuState({ type: 'main' });
      setSelectedIndex(0);
      return;
    }

    if (menuState.type === 'target') {
      const command: BattleCommand = {
        actor: character,
        type: menuState.commandType,
        skill: menuState.skill || skills.attack,
        target,
        priority: character.agi,
      };
      onCommandSelected(command);
    } else if (menuState.type === 'heal_target') {
      const command: BattleCommand = {
        actor: character,
        type: 'skill',
        skill: menuState.skill,
        target,
        priority: character.agi,
      };
      onCommandSelected(command);
    }
  };

  if (menuState.type === 'target') {
    return (
      <TargetSelector
        targets={battleState.enemyParty.filter(c => c.hp > 0)}
        onTargetSelected={handleTargetSelected}
        title="ターゲットを選択してください"
      />
    );
  }

  if (menuState.type === 'heal_target') {
    return (
      <TargetSelector
        targets={battleState.playerParty.filter(c => c.hp > 0)}
        onTargetSelected={handleTargetSelected}
        title="回復対象を選択してください"
      />
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" padding={1}>
      <Text color="cyan" bold>
        {character.name}の行動を選択してください:
      </Text>
      
      {menuState.type === 'main' && (
        <Box flexDirection="column" marginTop={1}>
          {mainCommands.map((command, index) => (
            <Box key={command.key}>
              <Text color={selectedIndex === index ? 'black' : 'white'}
                    backgroundColor={selectedIndex === index ? 'cyan' : undefined}>
                {command.key}. {command.label}
              </Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text color="gray">
              ↑↓キーで選択, Enterで決定, 数字キーで直接選択
            </Text>
          </Box>
        </Box>
      )}

      {menuState.type === 'skill' && (
        <Box flexDirection="column" marginTop={1}>
          <Box marginBottom={1}>
            <Text color="yellow" bold>スキルを選択してください:</Text>
          </Box>
          {availableSkills.map((skill, index) => {
            const canUse = character.mp >= skill.mpCost;
            return (
              <Box key={skill.id}>
                <Text color={selectedIndex === index ? 'black' : (canUse ? 'white' : 'gray')}
                      backgroundColor={selectedIndex === index ? 'cyan' : undefined}>
                  {index + 1}. {skill.name} (MP: {skill.mpCost})
                  {!canUse && ' (MP不足)'}
                </Text>
              </Box>
            );
          })}
          <Box>
            <Text color={selectedIndex === availableSkills.length ? 'black' : 'white'}
                  backgroundColor={selectedIndex === availableSkills.length ? 'cyan' : undefined}>
              0. キャンセル
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">
              ↑↓キーで選択, Enterで決定, 0でキャンセル
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
