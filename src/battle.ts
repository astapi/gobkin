import { Character, Skill, BattleCommand, BattleResult, BattleState } from './types';

export function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculatePhysicalDamage(
  attacker: Character,
  defender: Character,
  skill: Skill
): number {
  const baseDamage = Math.max(1, attacker.atk - defender.def / 2);
  const randomMod = getRandomFloat(0.95, 1.05);
  const defenseMod = defender.isDefending ? 0.7 : 1.0;
  const skillPower = skill.power;
  
  return Math.floor(baseDamage * randomMod * defenseMod * skillPower);
}

export function calculateMagicalDamage(
  attacker: Character,
  defender: Character,
  skill: Skill
): number {
  const baseDamage = Math.max(1, attacker.mag * 1.2 - defender.res);
  const randomMod = getRandomFloat(0.98, 1.02);
  const defenseMod = defender.isDefending ? 0.85 : 1.0;
  const skillPower = skill.power;
  
  return Math.floor(baseDamage * randomMod * defenseMod * skillPower);
}

export function calculateHealing(healer: Character): number {
  const baseHeal = healer.mag * 1.0 + 20;
  const randomMod = getRandomFloat(0.98, 1.02);
  
  return Math.floor(baseHeal * randomMod);
}

export function calculateEscapeChance(playerParty: Character[], enemyParty: Character[]): number {
  const playerAgiTotal = playerParty.reduce((sum, char) => sum + (char.hp > 0 ? char.agi : 0), 0);
  const enemyAgiTotal = enemyParty.reduce((sum, char) => sum + (char.hp > 0 ? char.agi : 0), 0);
  
  const ratio = playerAgiTotal / Math.max(1, enemyAgiTotal);
  return clamp(0.35 + 0.15 * ratio, 0.35, 0.85);
}

export function determineActionOrder(commands: BattleCommand[]): BattleCommand[] {
  return commands.sort((a, b) => {
    const aSpeed = a.actor.agi + getRandomFloat(0, a.actor.agi * 0.1);
    const bSpeed = b.actor.agi + getRandomFloat(0, b.actor.agi * 0.1);
    return bSpeed - aSpeed;
  });
}

export function executeCommand(
  command: BattleCommand,
  state: BattleState
): BattleResult[] {
  const results: BattleResult[] = [];
  const { actor, type, skill, target } = command;
  
  if (actor.hp <= 0) {
    return [];
  }
  
  switch (type) {
    case 'attack':
    case 'skill': {
      if (!skill || !target) break;
      
      if (skill.mpCost > actor.mp) {
        results.push({
          message: `${actor.name}はMPが足りない！`,
        });
        break;
      }
      
      actor.mp -= skill.mpCost;
      
      const targets = Array.isArray(target) ? target : [target];
      const hitCount = skill.hitCount || 1;
      
      for (const t of targets) {
        if (t.hp <= 0) continue;
        
        if (skill.type === 'heal') {
          const healing = calculateHealing(actor);
          const actualHeal = Math.min(healing, t.maxHp - t.hp);
          t.hp += actualHeal;
          results.push({
            healing: actualHeal,
            message: `${actor.name}の${skill.name}！ ${t.name}のHPが${actualHeal}回復！`,
          });
        } else {
          for (let hit = 0; hit < hitCount; hit++) {
            const damage = skill.type === 'physical'
              ? calculatePhysicalDamage(actor, t, skill)
              : calculateMagicalDamage(actor, t, skill);
            
            t.hp = Math.max(0, t.hp - damage);
            
            if (hitCount > 1) {
              results.push({
                damage,
                message: `${actor.name}の${skill.name}！ ${damage}ダメージ！`,
              });
            } else {
              results.push({
                damage,
                message: `${actor.name}の${skill.name}！ ${t.name}に${damage}ダメージ！`,
              });
            }
            
            if (t.hp <= 0) {
              results.push({
                message: `${t.name}を倒した！`,
              });
              break;
            }
          }
        }
      }
      break;
    }
    
    case 'defend': {
      actor.isDefending = true;
      results.push({
        message: `${actor.name}は身を守っている`,
      });
      break;
    }
    
    case 'escape': {
      const escapeChance = calculateEscapeChance(state.playerParty, state.enemyParty);
      const success = Math.random() < escapeChance;
      
      results.push({
        isEscape: true,
        escapeSuccess: success,
        message: success ? '逃げ出した！' : '逃げられなかった！',
      });
      
      if (success) {
        state.isFinished = true;
      }
      break;
    }
    
    case 'item': {
      results.push({
        message: `${actor.name}はアイテムを使った（未実装）`,
      });
      break;
    }
  }
  
  return results;
}

export function checkBattleEnd(state: BattleState): void {
  const alivePlayerCount = state.playerParty.filter(c => c.hp > 0).length;
  const aliveEnemyCount = state.enemyParty.filter(c => c.hp > 0).length;
  
  if (alivePlayerCount === 0) {
    state.isFinished = true;
    state.playerWon = false;
  } else if (aliveEnemyCount === 0) {
    state.isFinished = true;
    state.playerWon = true;
  }
}

export function resetDefendingState(characters: Character[]): void {
  characters.forEach(char => {
    char.isDefending = false;
  });
}

export function getAliveCharacters(characters: Character[]): Character[] {
  return characters.filter(c => c.hp > 0);
}

export function getRandomTarget(characters: Character[]): Character | null {
  const alive = getAliveCharacters(characters);
  if (alive.length === 0) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}