import type { Party } from '../../shared/types'

const MAX_PARTY_MEMBERS = 6

export class PartyEntity {
  private readonly base: Party
  private memberIds: number[]

  constructor(party: Party) {
    this.base = { ...party, memberIds: [...party.memberIds] }
    this.memberIds = this.base.memberIds
  }

  public addMember(goblinId: string): void {
    const memberId = Number.parseInt(goblinId, 10)
    if (Number.isNaN(memberId)) {
      throw new Error('数値のゴブリンIDが必要です')
    }
    if (this.memberIds.includes(memberId)) {
      return
    }
    if (this.memberIds.length >= MAX_PARTY_MEMBERS) {
      throw new Error('パーティ上限を超えています')
    }
    this.memberIds.push(memberId)
    this.base.memberIds = [...this.memberIds]
  }

  public removeMember(goblinId: string): void {
    const memberId = Number.parseInt(goblinId, 10)
    if (Number.isNaN(memberId)) {
      return
    }
    this.memberIds = this.memberIds.filter(id => id !== memberId)
    this.base.memberIds = [...this.memberIds]
  }

  public canStartExpedition(): boolean {
    if (this.memberIds.length === 0) {
      return false
    }
    return (this.base.status ?? 'idle') === 'idle'
  }

  public toSnapshot(): Party {
    return { ...this.base, memberIds: [...this.memberIds] }
  }
}
