import type { ExpeditionRecord, ExpeditionReplay, ExpeditionRequest } from '../../shared/types'
import { db, auth } from '../../config/firebase'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp
} from 'firebase/firestore'

const COLLECTION_NAME = 'expeditions'

const getUserId = (): string => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('ユーザーが認証されていません')
  }
  return user.uid
}

const getUserExpeditionsCollection = () => {
  const userId = getUserId()
  return collection(db, 'users', userId, COLLECTION_NAME)
}

const getUserExpeditionDoc = (expeditionId: string) => {
  const userId = getUserId()
  return doc(db, 'users', userId, COLLECTION_NAME, expeditionId)
}

export class FirestoreExpeditionRepositoryImpl {
  async createExpedition(
    partyId: number,
    partyName: string,
    dungeonId: string,
    dungeonName: string,
    returnPolicy: ExpeditionRequest['returnPolicy'],
    explorationTimeSec: number
  ): Promise<ExpeditionRecord> {
    try {
      const userId = getUserId()
      const now = new Date()
      const returnTime = new Date(now.getTime() + explorationTimeSec * 1000)

      const expeditionId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const record: ExpeditionRecord = {
        id: expeditionId,
        userId,
        partyId,
        partyName,
        dungeonId,
        dungeonName,
        startTime: now,
        returnTime,
        status: 'ongoing',
        returnPolicy,
        createdAt: now,
        updatedAt: now
      }

      const docRef = getUserExpeditionDoc(expeditionId)
      await setDoc(docRef, {
        ...record,
        startTime: Timestamp.fromDate(record.startTime),
        returnTime: Timestamp.fromDate(record.returnTime),
        createdAt: Timestamp.fromDate(record.createdAt),
        updatedAt: Timestamp.fromDate(record.updatedAt)
      })

      return record
    } catch (error) {
      console.error('遠征作成エラー:', error)
      throw error
    }
  }

  async updateExpeditionReplay(expeditionId: string, replay: ExpeditionReplay): Promise<void> {
    try {
      const docRef = getUserExpeditionDoc(expeditionId)
      await updateDoc(docRef, {
        replay,
        updatedAt: Timestamp.fromDate(new Date())
      })
    } catch (error) {
      console.error('遠征リプレイ更新エラー:', error)
      throw error
    }
  }

  async completeExpedition(expeditionId: string): Promise<void> {
    try {
      const docRef = getUserExpeditionDoc(expeditionId)
      await updateDoc(docRef, {
        status: 'completed',
        updatedAt: Timestamp.fromDate(new Date())
      })
    } catch (error) {
      console.error('遠征完了エラー:', error)
      throw error
    }
  }

  async getExpedition(expeditionId: string): Promise<ExpeditionRecord | null> {
    try {
      const docRef = getUserExpeditionDoc(expeditionId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        return {
          ...data,
          startTime: data.startTime.toDate(),
          returnTime: data.returnTime.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        } as ExpeditionRecord
      }
      return null
    } catch (error) {
      console.error('遠征取得エラー:', error)
      return null
    }
  }

  async getOngoingExpeditions(): Promise<ExpeditionRecord[]> {
    try {
      const q = query(
        getUserExpeditionsCollection(),
        orderBy('startTime', 'desc')
      )
      const querySnapshot = await getDocs(q)
      const now = new Date()

      return querySnapshot.docs
        .map(doc => {
          const data = doc.data()
          return {
            ...data,
            startTime: data.startTime.toDate(),
            returnTime: data.returnTime.toDate(),
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate()
          } as ExpeditionRecord
        })
        .filter(record => record.returnTime > now) // 帰還時間がまだ来ていないもののみ
    } catch (error) {
      console.error('進行中の遠征取得エラー:', error)
      return []
    }
  }

  async getExpeditionByPartyId(partyId: number): Promise<ExpeditionRecord | null> {
    console.log('getExpeditionByPartyId', partyId)
    try {
      const q = query(
        getUserExpeditionsCollection(),
        where('partyId', '==', partyId),
        orderBy('startTime', 'desc')
      )
      const querySnapshot = await getDocs(q)

      console.log('querySnapshot size:', querySnapshot.size)
      if (querySnapshot.empty) {
        return null
      }

      // 最新の遠征データから、帰還時間がまだ来ていないものを探す
      const now = new Date()
      for (const doc of querySnapshot.docs) {
        const data = doc.data()
        const record = {
          ...data,
          startTime: data.startTime.toDate(),
          returnTime: data.returnTime.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        } as ExpeditionRecord

        // 帰還時間がまだ来ていない場合は遠征中とみなす
        if (record.returnTime > now) {
          return record
        }
      }

      // 全ての遠征が終了している場合は最新のものを返す
      const doc = querySnapshot.docs[0]
      const data = doc.data()
      return {
        ...data,
        startTime: data.startTime.toDate(),
        returnTime: data.returnTime.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      } as ExpeditionRecord
    } catch (error) {
      console.error('パーティIDによる遠征取得エラー:', error)
      return null
    }
  }

  async getPartyExpeditionHistory(partyId: number, limit: number = 2): Promise<ExpeditionRecord[]> {
    try {
      const q = query(
        getUserExpeditionsCollection(),
        where('partyId', '==', partyId),
        orderBy('startTime', 'desc')
      )
      const querySnapshot = await getDocs(q)

      return querySnapshot.docs
        .slice(0, limit)
        .map(doc => {
          const data = doc.data()
          return {
            ...data,
            startTime: data.startTime.toDate(),
            returnTime: data.returnTime.toDate(),
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate()
          } as ExpeditionRecord
        })
    } catch (error) {
      console.error('パーティ遠征履歴取得エラー:', error)
      return []
    }
  }

  async getAllExpeditions(): Promise<ExpeditionRecord[]> {
    try {
      const q = query(getUserExpeditionsCollection(), orderBy('startTime', 'desc'))
      const querySnapshot = await getDocs(q)

      return querySnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          ...data,
          startTime: data.startTime.toDate(),
          returnTime: data.returnTime.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        } as ExpeditionRecord
      })
    } catch (error) {
      console.error('全遠征取得エラー:', error)
      return []
    }
  }

  async deleteExpedition(expeditionId: string): Promise<void> {
    try {
      const docRef = getUserExpeditionDoc(expeditionId)
      await deleteDoc(docRef)
    } catch (error) {
      console.error('遠征削除エラー:', error)
      throw error
    }
  }
}

export class FirestoreExpeditionRepositoryAdapter {
  private firestoreRepo = new FirestoreExpeditionRepositoryImpl()
  private cache: Map<string, ExpeditionRecord> = new Map()
  private ongoingExpeditions: ExpeditionRecord[] = []
  private isInitialized = false
  private onDataChange?: () => void

  setOnDataChange(callback: () => void) {
    this.onDataChange = callback
  }

  private async initialize() {
    if (!this.isInitialized) {
      this.ongoingExpeditions = await this.firestoreRepo.getOngoingExpeditions()
      this.ongoingExpeditions.forEach(exp => {
        this.cache.set(exp.id, exp)
      })
      this.isInitialized = true
      this.onDataChange?.()
    }
  }

  async createExpedition(
    partyId: number,
    partyName: string,
    dungeonId: string,
    dungeonName: string,
    returnPolicy: ExpeditionRequest['returnPolicy'],
    explorationTimeSec: number
  ): Promise<ExpeditionRecord> {
    const record = await this.firestoreRepo.createExpedition(
      partyId,
      partyName,
      dungeonId,
      dungeonName,
      returnPolicy,
      explorationTimeSec
    )
    this.cache.set(record.id, record)
    this.ongoingExpeditions.push(record)
    this.onDataChange?.()
    return record
  }

  async updateExpeditionReplay(expeditionId: string, replay: ExpeditionReplay): Promise<void> {
    await this.firestoreRepo.updateExpeditionReplay(expeditionId, replay)
    const cached = this.cache.get(expeditionId)
    if (cached) {
      cached.replay = replay
      cached.updatedAt = new Date()
      // statusは変更せず、ongoingExpeditionsからも削除しない
      this.onDataChange?.()
    }
  }

  async completeExpedition(expeditionId: string): Promise<void> {
    await this.firestoreRepo.completeExpedition(expeditionId)
    const cached = this.cache.get(expeditionId)
    if (cached) {
      cached.status = 'completed'
      cached.updatedAt = new Date()
      this.ongoingExpeditions = this.ongoingExpeditions.filter(exp => exp.id !== expeditionId)
      this.onDataChange?.()
    }
  }

  getOngoingExpeditions(): ExpeditionRecord[] {
    if (!this.isInitialized) {
      this.initialize()
    }
    // 現在時刻より帰還時間が後のもののみを返す
    const now = new Date()
    return this.ongoingExpeditions.filter(exp => exp.returnTime > now)
  }

  async getExpeditionByPartyId(partyId: number): Promise<ExpeditionRecord | null> {
    console.log('this.isInitialized', this.isInitialized)
    if (!this.isInitialized) {
      await this.initialize()
    }

    const ongoing = this.ongoingExpeditions.find(exp => exp.partyId === partyId)
    if (ongoing) {
      return ongoing
    }

    return await this.firestoreRepo.getExpeditionByPartyId(partyId)
  }

  async getPartyExpeditionHistory(partyId: number, limit: number = 2): Promise<ExpeditionRecord[]> {
    // キャッシュから最新の履歴を取得
    const history = Array.from(this.cache.values())
      .filter(exp => exp.partyId === partyId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit)

    // キャッシュに十分なデータがない場合はFirestoreから取得
    if (history.length < limit) {
      const firestoreHistory = await this.firestoreRepo.getPartyExpeditionHistory(partyId, limit)
      firestoreHistory.forEach(exp => {
        if (!this.cache.has(exp.id)) {
          this.cache.set(exp.id, exp)
        }
      })
      return firestoreHistory
    }

    return history
  }

  async getExpedition(expeditionId: string): Promise<ExpeditionRecord | null> {
    if (this.cache.has(expeditionId)) {
      return this.cache.get(expeditionId) || null
    }

    const record = await this.firestoreRepo.getExpedition(expeditionId)
    if (record) {
      this.cache.set(expeditionId, record)
    }
    return record
  }
}
