import type { BaseState } from '../../shared/types'
import type { IBaseStateRepository } from '../../core/repositories/IBaseStateRepository'
import { db, auth } from '../../config/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const getUserId = (): string => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('ユーザーが認証されていません')
  }
  return user.uid
}

const getUserDoc = () => {
  const userId = getUserId()
  return doc(db, 'users', userId)
}

const createDefaultBaseState = (): BaseState => {
  const now = Date.now()
  return {
    capacity: 8,
    rank: 1,
    lastSpawnTime: now,
    slimeCaveCleared: false,
    firstBonusGranted: false,
  }
}

export class FirestoreBaseStateRepositoryImpl implements IBaseStateRepository {
  private cache: BaseState | null = null

  async initialize(): Promise<void> {
    await this.refreshCache()
  }

  private async refreshCache(): Promise<void> {
    const docRef = getUserDoc()
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      if (data.baseState) {
        this.cache = data.baseState as BaseState
      } else {
        // baseStateフィールドがない場合はデフォルト値を作成
        const defaultState = createDefaultBaseState()
        await this.saveBaseState(defaultState)
        this.cache = defaultState
      }
    } else {
      // ドキュメントが存在しない場合はデフォルト値を作成
      const defaultState = createDefaultBaseState()
      await this.saveBaseState(defaultState)
      this.cache = defaultState
    }
  }

  getBaseState(): BaseState | null {
    return this.cache ? { ...this.cache } : null
  }

  async saveBaseState(state: BaseState): Promise<void> {
    const docRef = getUserDoc()
    await setDoc(docRef, { baseState: state }, { merge: true })
    this.cache = { ...state }
  }

  async updateLastSpawnTime(timestamp: number): Promise<void> {
    if (!this.cache) {
      throw new Error('BaseStateが初期化されていません')
    }
    const updatedState = { ...this.cache, lastSpawnTime: timestamp }
    await this.saveBaseState(updatedState)
  }

  // 同期版のインターフェース実装（非同期版を内部で呼び出す）
  saveBaseStateSync(state: BaseState): void {
    this.saveBaseState(state).catch(err => {
      console.error('Failed to save base state:', err)
    })
  }

  updateLastSpawnTimeSync(timestamp: number): void {
    this.updateLastSpawnTime(timestamp).catch(err => {
      console.error('Failed to update last spawn time:', err)
    })
  }
}

// アダプターパターン：同期版インターフェースを提供
export class FirestoreBaseStateRepositoryAdapter implements IBaseStateRepository {
  private impl: FirestoreBaseStateRepositoryImpl
  private isInitialized = false

  constructor() {
    this.impl = new FirestoreBaseStateRepositoryImpl()
  }

  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.impl.initialize()
      this.isInitialized = true
    }
  }

  getBaseState(): BaseState | null {
    return this.impl.getBaseState()
  }

  saveBaseState(state: BaseState): void {
    this.impl.saveBaseStateSync(state)
  }

  updateLastSpawnTime(timestamp: number): void {
    this.impl.updateLastSpawnTimeSync(timestamp)
  }
}
