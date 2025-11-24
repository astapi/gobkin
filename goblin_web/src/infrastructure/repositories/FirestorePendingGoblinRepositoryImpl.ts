import type { Goblin } from '../../shared/types'
import type { IPendingGoblinRepository } from '../../core/repositories/IPendingGoblinRepository'
import { db, auth } from '../../config/firebase'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore'

const COLLECTION_NAME = 'pendingGoblins'

const getUserId = (): string => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('ユーザーが認証されていません')
  }
  return user.uid
}

const getUserPendingGoblinsCollection = () => {
  const userId = getUserId()
  return collection(db, 'users', userId, COLLECTION_NAME)
}

const getUserPendingGoblinDoc = (goblinId: number) => {
  const userId = getUserId()
  return doc(db, 'users', userId, COLLECTION_NAME, goblinId.toString())
}

export class FirestorePendingGoblinRepositoryImpl implements IPendingGoblinRepository {
  private cache: Goblin[] | null = null

  async initialize(): Promise<void> {
    await this.refreshCache()
  }

  private async refreshCache(): Promise<void> {
    const q = query(getUserPendingGoblinsCollection(), orderBy('id'))
    const snapshot = await getDocs(q)
    this.cache = snapshot.docs.map(doc => doc.data() as Goblin)
  }

  getPendingGoblins(): Goblin[] {
    if (this.cache === null) {
      return []
    }
    return [...this.cache]
  }

  async addPendingGoblin(goblin: Goblin): Promise<void> {
    const docRef = getUserPendingGoblinDoc(goblin.id)
    await setDoc(docRef, goblin)
    await this.refreshCache()
  }

  async removePendingGoblin(id: number): Promise<void> {
    const docRef = getUserPendingGoblinDoc(id)
    await deleteDoc(docRef)
    await this.refreshCache()
  }

  async clearPendingGoblins(): Promise<void> {
    const goblins = this.getPendingGoblins()
    await Promise.all(goblins.map(goblin => this.removePendingGoblin(goblin.id)))
    await this.refreshCache()
  }

  // 同期版のインターフェース実装（非同期版を内部で呼び出す）
  addPendingGoblinSync(goblin: Goblin): void {
    this.addPendingGoblin(goblin).catch(err => {
      console.error('Failed to add pending goblin:', err)
    })
  }

  removePendingGoblinSync(id: number): void {
    this.removePendingGoblin(id).catch(err => {
      console.error('Failed to remove pending goblin:', err)
    })
  }

  clearPendingGoblinsSync(): void {
    this.clearPendingGoblins().catch(err => {
      console.error('Failed to clear pending goblins:', err)
    })
  }
}

// アダプターパターン：同期版インターフェースを提供
export class FirestorePendingGoblinRepositoryAdapter implements IPendingGoblinRepository {
  private impl: FirestorePendingGoblinRepositoryImpl
  private isInitialized = false

  constructor() {
    this.impl = new FirestorePendingGoblinRepositoryImpl()
  }

  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.impl.initialize()
      this.isInitialized = true
    }
  }

  getPendingGoblins(): Goblin[] {
    return this.impl.getPendingGoblins()
  }

  addPendingGoblin(goblin: Goblin): void {
    this.impl.addPendingGoblinSync(goblin)
  }

  removePendingGoblin(id: number): void {
    this.impl.removePendingGoblinSync(id)
  }

  clearPendingGoblins(): void {
    this.impl.clearPendingGoblinsSync()
  }
}
