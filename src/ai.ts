import { Character, BattleCommand, BattleState } from './types';
import { skills } from './data';
import { getRandomTarget, getAliveCharacters } from './battle';

export function generateEnemyCommand(
  enemy: Character,
  state: BattleState
): BattleCommand | null {
  if (enemy.hp <= 0) return null;
  
  const target = getRandomTarget(state.playerParty);
  if (!target) return null;
  
  const hpPercent = enemy.hp / enemy.maxHp;
  
  if (enemy.name.includes('戦士')) {
    return generateWarriorCommand(enemy, target, hpPercent);
  } else if (enemy.name.includes('魔法使い')) {
    return generateMageCommand(enemy, target);
  }
  
  return {
    actor: enemy,
    type: 'attack',
    skill: skills.attack,
    target,
    priority: enemy.agi,
  };
}

function generateWarriorCommand(
  warrior: Character,
  target: Character,
  hpPercent: number
): BattleCommand {
  if (hpPercent < 0.3 && Math.random() < 0.25) {
    return {
      actor: warrior,
      type: 'defend',
      priority: warrior.agi,
    };
  }
  
  const canUseSlash = warrior.mp >= skills.slash.mpCost;
  const useSlash = canUseSlash && Math.random() < 0.5;
  
  if (useSlash) {
    return {
      actor: warrior,
      type: 'skill',
      skill: skills.slash,
      target,
      priority: warrior.agi,
    };
  }
  
  return {
    actor: warrior,
    type: 'attack',
    skill: skills.attack,
    target,
    priority: warrior.agi,
  };
}

function generateMageCommand(
  mage: Character,
  target: Character
): BattleCommand {
  const canUseFire = mage.mp >= skills.fire.mpCost;
  
  if (canUseFire) {
    return {
      actor: mage,
      type: 'skill',
      skill: skills.fire,
      target,
      priority: mage.agi,
    };
  }
  
  return {
    actor: mage,
    type: 'attack',
    skill: skills.attack,
    target,
    priority: mage.agi,
  };
}

export function generateAllEnemyCommands(state: BattleState): BattleCommand[] {
  const commands: BattleCommand[] = [];
  
  for (const enemy of state.enemyParty) {
    const command = generateEnemyCommand(enemy, state);
    if (command) {
      commands.push(command);
    }
  }
  
  return commands;
}