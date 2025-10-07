import type { Goblin } from '../types/index.ts'
import type { GoblinRepository } from './GoblinRepository.ts'
import { db, auth } from '../config/firebase.ts'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore'

const COLLECTION_NAME = 'goblins'

const getUserId = (): string => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('ユーザーが認証されていません')
  }
  return user.uid
}

const getUserGoblinsCollection = () => {
  const userId = getUserId()
  return collection(db, 'users', userId, COLLECTION_NAME)
}

const getUserGoblinDoc = (goblinId: number) => {
  const userId = getUserId()
  return doc(db, 'users', userId, COLLECTION_NAME, goblinId.toString())
}

export class FirestoreGoblinRepositoryImpl {
  private getDefaultGoblins(): Goblin[] {
    return [
      {
        id: 0,
        name: 'グラッシュ',
        race: 'ゴブリン',
        level: 15,
        avatar: '/src/assets/goblin/goblin.png',
        stats: { hp: 120, atk: 85, sp: 45, spd: 60, def: 75 },
        equipment: [
          { slotIndex: 0, itemId: null },
          { slotIndex: 1, itemId: null },
          { slotIndex: 2, itemId: null },
          { slotIndex: 3, itemId: null },
          { slotIndex: 4, itemId: null }
        ]
      },
      {
        id: 1,
        name: 'ズィーク',
        race: 'ゴブリン',
        level: 12,
        avatar: '/src/assets/goblin/goblin.png',
        stats: { hp: 80, atk: 95, sp: 90, spd: 70, def: 45 },
        equipment: [
          { slotIndex: 0, itemId: null },
          { slotIndex: 1, itemId: null },
          { slotIndex: 2, itemId: null },
          { slotIndex: 3, itemId: null },
          { slotIndex: 4, itemId: null }
        ]
      },
      {
        id: 2,
        name: 'シャープ',
        race: 'ゴブリン',
        level: 13,
        avatar: '/src/assets/goblin/goblin.png',
        stats: { hp: 90, atk: 80, sp: 65, spd: 85, def: 55 },
        equipment: [
          { slotIndex: 0, itemId: null },
          { slotIndex: 1, itemId: null },
          { slotIndex: 2, itemId: null },
          { slotIndex: 3, itemId: null },
          { slotIndex: 4, itemId: null }
        ]
      },
      {
        id: 3,
        name: 'ガード',
        race: 'ゴブリン',
        level: 11,
        avatar: '/src/assets/goblin/goblin.png',
        stats: { hp: 130, atk: 50, sp: 40, spd: 45, def: 95 },
        equipment: [
          { slotIndex: 0, itemId: null },
          { slotIndex: 1, itemId: null },
          { slotIndex: 2, itemId: null },
          { slotIndex: 3, itemId: null },
          { slotIndex: 4, itemId: null }
        ]
      },
      {
        id: 4,
        name: 'スピード',
        race: 'ゴブリン',
        level: 14,
        avatar: '/src/assets/goblin/goblin.png',
        stats: { hp: 85, atk: 75, sp: 70, spd: 95, def: 50 },
        equipment: [
          { slotIndex: 0, itemId: null },
          { slotIndex: 1, itemId: null },
          { slotIndex: 2, itemId: null },
          { slotIndex: 3, itemId: null },
          { slotIndex: 4, itemId: null }
        ]
      }
    ]
  }

  async getGoblins(): Promise<Goblin[]> {
    try {
      const q = query(getUserGoblinsCollection(), orderBy('id'))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        // 初回時はデフォルトゴブリンを作成
        const defaultGoblins = this.getDefaultGoblins()
        for (const goblin of defaultGoblins) {
          await this.saveGoblin(goblin)
        }
        return defaultGoblins
      }

      return querySnapshot.docs.map(doc => doc.data() as Goblin)
    } catch (error) {
      console.error('ゴブリン取得エラー:', error)
      return this.getDefaultGoblins()
    }
  }

  async getGoblin(id: number): Promise<Goblin | null> {
    try {
      const docRef = getUserGoblinDoc(id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return docSnap.data() as Goblin
      }
      return null
    } catch (error) {
      console.error('ゴブリン取得エラー:', error)
      return null
    }
  }

  async saveGoblin(goblin: Goblin): Promise<void> {
    try {
      const docRef = getUserGoblinDoc(goblin.id)
      await setDoc(docRef, goblin)
    } catch (error) {
      console.error('ゴブリン保存エラー:', error)
      throw error
    }
  }

  async deleteGoblin(id: number): Promise<void> {
    try {
      const docRef = getUserGoblinDoc(id)
      await deleteDoc(docRef)
    } catch (error) {
      console.error('ゴブリン削除エラー:', error)
      throw error
    }
  }
}

// 同期版インターフェースとの互換性のためのアダプター
export class FirestoreGoblinRepositoryAdapter implements GoblinRepository {
  private firestoreRepo = new FirestoreGoblinRepositoryImpl()
  private cache: Goblin[] = []
  private isInitialized = false
  private listeners: (() => void)[] = []

  setOnDataChange(callback: () => void) {
    this.listeners.push(callback)
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener())
  }

  private async initialize() {
    if (!this.isInitialized) {
      this.cache = await this.firestoreRepo.getGoblins()
      this.isInitialized = true
      this.notifyListeners()
    }
  }

  getGoblins(): Goblin[] {
    if (!this.isInitialized) {
      this.initialize()
      return []
    }
    return this.cache
  }

  getGoblin(id: number): Goblin | null {
    return this.cache.find(goblin => goblin.id === id) || null
  }

  saveGoblin(goblin: Goblin): void {
    this.firestoreRepo.saveGoblin(goblin).then(() => {
      const index = this.cache.findIndex(g => g.id === goblin.id)
      if (index >= 0) {
        this.cache[index] = goblin
      } else {
        this.cache.push(goblin)
      }
      this.notifyListeners()
    }).catch(error => {
      console.error('ゴブリン保存エラー:', error)
    })
  }

  deleteGoblin(id: number): void {
    this.firestoreRepo.deleteGoblin(id).then(() => {
      this.cache = this.cache.filter(goblin => goblin.id !== id)
      this.notifyListeners()
    }).catch(error => {
      console.error('ゴブリン削除エラー:', error)
    })
  }

  updateGoblinStats(id: number, stats: Goblin['stats']): void {
    const goblin = this.getGoblin(id)
    if (goblin) {
      goblin.stats = stats
      this.saveGoblin(goblin)
    }
  }

  updateGoblinLevel(id: number, level: number): void {
    const goblin = this.getGoblin(id)
    if (goblin) {
      goblin.level = level
      this.saveGoblin(goblin)
    }
  }

  equipItem(goblinId: number, slotIndex: number, itemId: string): void {
    const goblin = this.getGoblin(goblinId)
    if (goblin && slotIndex >= 0 && slotIndex < 5) {
      if (goblin.equipment) {
        goblin.equipment[slotIndex].itemId = itemId
      } else {
        goblin.equipment = [
          { slotIndex: 0, itemId: null },
          { slotIndex: 1, itemId: null },
          { slotIndex: 2, itemId: null },
          { slotIndex: 3, itemId: null },
          { slotIndex: 4, itemId: null }
        ]
        goblin.equipment[slotIndex].itemId = itemId
      }
      this.saveGoblin(goblin)
    }
  }

  unequipItem(goblinId: number, slotIndex: number): void {
    const goblin = this.getGoblin(goblinId)
    if (goblin && slotIndex >= 0 && slotIndex < 5) {
      goblin.equipment[slotIndex].itemId = null
      this.saveGoblin(goblin)
    }
  }
}
