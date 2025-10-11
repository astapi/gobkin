import type { Item } from '../../shared/types'
import type { IItemRepository } from '../../core/repositories'
import { db, auth } from '../../config/firebase'
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

const COLLECTION_NAME = 'items'

const getUserId = (): string => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('ユーザーが認証されていません')
  }
  return user.uid
}

const getUserItemsCollection = () => {
  const userId = getUserId()
  return collection(db, 'users', userId, COLLECTION_NAME)
}

const getUserItemDoc = (itemId: string) => {
  const userId = getUserId()
  return doc(db, 'users', userId, COLLECTION_NAME, itemId)
}

export class FirestoreItemRepositoryImpl {
  private getDefaultItems(): Item[] {
    return [
      {
        id: 'wooden_stick',
        name: '木の棒',
        description: '素朴な木の棒。攻撃力が少し上がる。',
        effect: { atk: 2 }
      }
    ]
  }

  async getItems(): Promise<Item[]> {
    try {
      const q = query(getUserItemsCollection(), orderBy('id'))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        // 初回時はデフォルトアイテムを作成
        const defaultItems = this.getDefaultItems()
        for (const item of defaultItems) {
          await this.saveItem(item)
        }
        return defaultItems
      }

      return querySnapshot.docs.map(doc => doc.data() as Item)
    } catch (error) {
      console.error('アイテム取得エラー:', error)
      return this.getDefaultItems()
    }
  }

  async getItem(id: string): Promise<Item | null> {
    try {
      const docRef = getUserItemDoc(id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return docSnap.data() as Item
      }
      return null
    } catch (error) {
      console.error('アイテム取得エラー:', error)
      return null
    }
  }

  async saveItem(item: Item): Promise<void> {
    try {
      const docRef = getUserItemDoc(item.id)
      await setDoc(docRef, item)
    } catch (error) {
      console.error('アイテム保存エラー:', error)
      throw error
    }
  }

  async deleteItem(id: string): Promise<void> {
    try {
      const docRef = getUserItemDoc(id)
      await deleteDoc(docRef)
    } catch (error) {
      console.error('アイテム削除エラー:', error)
      throw error
    }
  }
}

// 同期版インターフェースとの互換性のためのアダプター
export class FirestoreItemRepositoryAdapter implements IItemRepository {
  private firestoreRepo = new FirestoreItemRepositoryImpl()
  private cache: Item[] = []
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
      this.cache = await this.firestoreRepo.getItems()
      this.isInitialized = true
      this.notifyListeners()
    }
  }

  getItems(): Item[] {
    if (!this.isInitialized) {
      this.initialize()
      return []
    }
    return this.cache
  }

  getItem(id: string): Item | null {
    return this.cache.find(item => item.id === id) || null
  }

  saveItem(item: Item): void {
    this.firestoreRepo.saveItem(item).then(() => {
      const index = this.cache.findIndex(i => i.id === item.id)
      if (index >= 0) {
        this.cache[index] = item
      } else {
        this.cache.push(item)
      }
      this.notifyListeners()
    }).catch(error => {
      console.error('アイテム保存エラー:', error)
    })
  }

  deleteItem(id: string): void {
    this.firestoreRepo.deleteItem(id).then(() => {
      this.cache = this.cache.filter(item => item.id !== id)
      this.notifyListeners()
    }).catch(error => {
      console.error('アイテム削除エラー:', error)
    })
  }
}
