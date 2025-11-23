import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../../config/firebase'
import type { DungeonProgressState } from '../../shared/types/DungeonProgress'

const getUserId = (): string => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('ユーザーが認証されていません')
  }
  return user.uid
}

const getUserDocRef = () => {
  const userId = getUserId()
  return doc(db, 'users', userId)
}

export class FirestoreDungeonProgressService {
  async loadProgress(defaults: DungeonProgressState): Promise<DungeonProgressState> {
    try {
      const docRef = getUserDocRef()
      const snap = await getDoc(docRef)

      if (!snap.exists()) {
        await setDoc(docRef, { dungeonProgress: defaults }, { merge: true })
        return defaults
      }

      const data = snap.data()
      const stored = (data?.dungeonProgress ?? {}) as DungeonProgressState
      return { ...defaults, ...stored }
    } catch (error) {
      console.error('ダンジョン進行状況の取得エラー:', error)
      return defaults
    }
  }

  async saveProgress(progress: DungeonProgressState): Promise<void> {
    try {
      const docRef = getUserDocRef()
      await setDoc(docRef, { dungeonProgress: progress }, { merge: true })
    } catch (error) {
      console.error('ダンジョン進行状況の保存エラー:', error)
      throw error
    }
  }
}
