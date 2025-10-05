import type { Party, PartyStatus, ExpeditionRequest } from '../types/index.ts'
import type { PartyRepository } from './PartyRepository.ts'
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

const COLLECTION_NAME = 'parties'

const getUserId = (): string => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('ユーザーが認証されていません')
  }
  return user.uid
}

const getUserPartiesCollection = () => {
  const userId = getUserId()
  return collection(db, 'users', userId, COLLECTION_NAME)
}

const getUserPartyDoc = (partyId: number) => {
  const userId = getUserId()
  return doc(db, 'users', userId, COLLECTION_NAME, partyId.toString())
}

export class FirestorePartyRepositoryImpl {
  private getDefaultParties(): Party[] {
    return [
      { id: 1, name: 'PT1', memberIds: [], status: 'idle' },
      { id: 2, name: 'PT2', memberIds: [], status: 'idle' },
      { id: 3, name: 'PT3', memberIds: [], status: 'idle' }
    ]
  }

  async getParties(): Promise<Party[]> {
    try {
      const q = query(getUserPartiesCollection(), orderBy('id'))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        // 初回時はデフォルトパーティを作成
        const defaultParties = this.getDefaultParties()
        for (const party of defaultParties) {
          await this.saveParty(party)
        }
        return defaultParties
      }

      return querySnapshot.docs.map(doc => doc.data() as Party)
    } catch (error) {
      console.error('パーティ取得エラー:', error)
      return this.getDefaultParties()
    }
  }

  async getParty(id: number): Promise<Party | null> {
    try {
      const docRef = getUserPartyDoc(id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return docSnap.data() as Party
      }
      return null
    } catch (error) {
      console.error('パーティ取得エラー:', error)
      return null
    }
  }

  async saveParty(party: Party): Promise<void> {
    try {
      const docRef = getUserPartyDoc(party.id)
      await setDoc(docRef, party)
    } catch (error) {
      console.error('パーティ保存エラー:', error)
      throw error
    }
  }

  async deleteParty(id: number): Promise<void> {
    try {
      const docRef = getUserPartyDoc(id)
      await deleteDoc(docRef)
    } catch (error) {
      console.error('パーティ削除エラー:', error)
      throw error
    }
  }
}

// 同期版インターフェースとの互換性のためのアダプター
export class FirestorePartyRepositoryAdapter implements PartyRepository {
  private firestoreRepo = new FirestorePartyRepositoryImpl()
  private cache: Party[] = []
  private isInitialized = false
  private onDataChange?: () => void

  setOnDataChange(callback: () => void) {
    this.onDataChange = callback
  }

  private async initialize() {
    if (!this.isInitialized) {
      this.cache = await this.firestoreRepo.getParties()
      this.isInitialized = true
      this.onDataChange?.()
    }
  }

  getParties(): Party[] {
    if (!this.isInitialized) {
      this.initialize()
      return []
    }
    return this.cache
  }

  getParty(id: number): Party | null {
    return this.cache.find(party => party.id === id) || null
  }

  saveParty(party: Party): void {
    this.firestoreRepo.saveParty(party).then(() => {
      const index = this.cache.findIndex(p => p.id === party.id)
      if (index >= 0) {
        this.cache[index] = party
      } else {
        this.cache.push(party)
      }
    }).catch(error => {
      console.error('パーティ保存エラー:', error)
    })
  }

  deleteParty(id: number): void {
    this.firestoreRepo.deleteParty(id).then(() => {
      this.cache = this.cache.filter(party => party.id !== id)
    }).catch(error => {
      console.error('パーティ削除エラー:', error)
    })
  }

  updatePartyStatus(id: number, status: PartyStatus): void {
    const party = this.getParty(id)
    if (party) {
      party.status = status
      this.saveParty(party)
    }
  }

  getPartiesByStatus(status: PartyStatus): Party[] {
    return this.cache.filter(party => party.status === status)
  }

  updateDungeonSettings(id: number, dungeonId: number): void {
    const party = this.getParty(id)
    if (party) {
      party.dungeonId = dungeonId
      this.saveParty(party)
    }
  }

  updateFloorTarget(id: number, targetFloor: number | null): void {
    const party = this.getParty(id)
    if (party) {
      party.targetFloor = targetFloor
      this.saveParty(party)
    }
  }

  updateReturnPolicy(id: number, returnPolicy: ExpeditionRequest["returnPolicy"]): void {
    const party = this.getParty(id)
    if (party) {
      party.returnPolicy = returnPolicy
      this.saveParty(party)
    }
  }
}