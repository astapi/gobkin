import * as readline from 'readline';
import { Character, BattleCommand, BattleState, CommandType, Skill } from './types';
import { skills, items } from './data';
import { getAliveCharacters, getRandomTarget } from './battle';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export function clearScreen(): void {
  console.clear();
}

export function displayBattleStatus(state: BattleState): void {
  console.log('\n========== バトル状況 ==========');
  console.log(`ターン: ${state.turn}`);
  console.log('\n【味方パーティ】');
  state.playerParty.forEach((char) => {
    const status = char.hp > 0 ? '' : '(戦闘不能)';
    const defending = char.isDefending ? '[防御中]' : '';
    console.log(
      `  ${char.name}: HP ${char.hp}/${char.maxHp} | MP ${char.mp}/${char.maxMp} ${defending}${status}`
    );
  });
  
  console.log('\n【敵パーティ】');
  state.enemyParty.forEach((char) => {
    const status = char.hp > 0 ? '' : '(倒した)';
    const defending = char.isDefending ? '[防御中]' : '';
    console.log(
      `  ${char.name}: HP ${char.hp}/${char.maxHp} | MP ${char.mp}/${char.maxMp} ${defending}${status}`
    );
  });
  console.log('================================\n');
}

export function displayBattleLog(messages: string[]): void {
  if (messages.length > 0) {
    console.log('--- バトルログ ---');
    messages.forEach(msg => console.log(msg));
    console.log('------------------\n');
  }
}

export async function displayBattleLogWithDelay(messages: string[], delayMs: number = 800): Promise<void> {
  if (messages.length > 0) {
    console.log('--- バトルログ ---');
    for (const msg of messages) {
      console.log(msg);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    console.log('------------------\n');
  }
}

async function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

export async function selectCommand(character: Character): Promise<CommandType> {
  console.log(`\n${character.name}の行動を選択してください：`);
  console.log('1. たたかう');
  console.log('2. スキル/まほう');
  console.log('3. ぼうぎょ');
  console.log('4. どうぐ');
  console.log('5. にげる');
  
  while (true) {
    const choice = await askQuestion('選択 (1-5): ');
    switch (choice) {
      case '1': return 'attack';
      case '2': return 'skill';
      case '3': return 'defend';
      case '4': return 'item';
      case '5': return 'escape';
      default:
        console.log('無効な選択です。1-5の数字を入力してください。');
    }
  }
}

export async function selectSkill(character: Character): Promise<Skill | null> {
  const availableSkills = character.skills.filter(s => s.id !== 'attack');
  
  if (availableSkills.length === 0) {
    console.log('使用可能なスキルがありません。');
    return null;
  }
  
  console.log('\nスキルを選択してください：');
  availableSkills.forEach((skill, index) => {
    const canUse = character.mp >= skill.mpCost ? '' : '(MP不足)';
    console.log(`${index + 1}. ${skill.name} (MP: ${skill.mpCost}) ${canUse}`);
  });
  console.log('0. キャンセル');
  
  while (true) {
    const choice = await askQuestion('選択: ');
    const index = parseInt(choice) - 1;
    
    if (choice === '0') return null;
    
    if (index >= 0 && index < availableSkills.length) {
      const skill = availableSkills[index];
      if (character.mp >= skill.mpCost) {
        return skill;
      } else {
        console.log('MPが足りません！');
      }
    } else {
      console.log('無効な選択です。');
    }
  }
}

export async function selectTarget(
  enemies: Character[],
  skill?: Skill
): Promise<Character | null> {
  const aliveEnemies = getAliveCharacters(enemies);
  
  if (aliveEnemies.length === 0) return null;
  
  console.log('\nターゲットを選択してください：');
  aliveEnemies.forEach((enemy, index) => {
    console.log(`${index + 1}. ${enemy.name} (HP: ${enemy.hp}/${enemy.maxHp})`);
  });
  console.log('0. キャンセル');
  
  while (true) {
    const choice = await askQuestion('選択: ');
    const index = parseInt(choice) - 1;
    
    if (choice === '0') return null;
    
    if (index >= 0 && index < aliveEnemies.length) {
      return aliveEnemies[index];
    } else {
      console.log('無効な選択です。');
    }
  }
}

export async function selectHealTarget(
  allies: Character[]
): Promise<Character | null> {
  const aliveAllies = getAliveCharacters(allies);
  
  if (aliveAllies.length === 0) return null;
  
  console.log('\n回復対象を選択してください：');
  aliveAllies.forEach((ally, index) => {
    console.log(`${index + 1}. ${ally.name} (HP: ${ally.hp}/${ally.maxHp})`);
  });
  console.log('0. キャンセル');
  
  while (true) {
    const choice = await askQuestion('選択: ');
    const index = parseInt(choice) - 1;
    
    if (choice === '0') return null;
    
    if (index >= 0 && index < aliveAllies.length) {
      return aliveAllies[index];
    } else {
      console.log('無効な選択です。');
    }
  }
}

export async function getPlayerCommands(state: BattleState): Promise<BattleCommand[]> {
  const commands: BattleCommand[] = [];
  
  for (const character of state.playerParty) {
    if (character.hp <= 0) continue;
    
    displayBattleStatus(state);
    
    let command: BattleCommand | null = null;
    
    while (!command) {
      const commandType = await selectCommand(character);
      
      switch (commandType) {
        case 'attack': {
          const target = await selectTarget(state.enemyParty);
          if (target) {
            command = {
              actor: character,
              type: 'attack',
              skill: skills.attack,
              target,
              priority: character.agi,
            };
          }
          break;
        }
        
        case 'skill': {
          const skill = await selectSkill(character);
          if (skill) {
            let target: Character | null = null;
            
            if (skill.type === 'heal') {
              target = await selectHealTarget(state.playerParty);
            } else {
              target = await selectTarget(state.enemyParty);
            }
            
            if (target) {
              command = {
                actor: character,
                type: 'skill',
                skill,
                target,
                priority: character.agi,
              };
            }
          }
          break;
        }
        
        case 'defend': {
          command = {
            actor: character,
            type: 'defend',
            priority: character.agi,
          };
          break;
        }
        
        case 'item': {
          console.log('\nアイテム機能は未実装です。');
          break;
        }
        
        case 'escape': {
          command = {
            actor: character,
            type: 'escape',
            priority: character.agi,
          };
          break;
        }
      }
    }
    
    commands.push(command);
    
    if (command.type === 'escape') {
      break;
    }
  }
  
  return commands;
}

export function displayBattleResult(state: BattleState): void {
  console.log('\n========== バトル終了 ==========');
  
  if (state.playerWon === true) {
    console.log('勝利！');
    console.log('\n【報酬】');
    console.log(`EXP: 54`);
    const gold = Math.floor(Math.random() * 16) + 30;
    console.log(`GOLD: ${gold}`);
    
    if (Math.random() < 0.2) {
      console.log(`アイテム: 回復薬(小) を手に入れた！`);
    }
  } else if (state.playerWon === false) {
    console.log('全滅してしまった...');
  } else {
    console.log('逃走成功！');
  }
  
  console.log('================================\n');
}

export function closeUI(): void {
  rl.close();
}