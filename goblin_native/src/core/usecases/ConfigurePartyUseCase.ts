import type { ExpeditionRequest, Party, DungeonTier } from '../../shared/types'
import type { IPartyRepository } from '../repositories'
import { createAutoExpeditionSummary } from '../../shared/utils/autoExpeditionSummary'

export class ConfigurePartyUseCase {
  private readonly partyRepository: IPartyRepository

  constructor(partyRepository: IPartyRepository) {
    this.partyRepository = partyRepository
  }

  public async setName(partyId: number, name: string): Promise<Party> {
    const party = await this.requireParty(partyId)
    const trimmedName = name.trim()

    if (!trimmedName) {
      throw new Error('パーティ名を入力してください')
    }

    await this.partyRepository.saveParty({
      ...party,
      name: trimmedName,
    })

    return this.requireParty(partyId)
  }

  public async setDungeon(partyId: number, dungeonId: string): Promise<Party> {
    await this.partyRepository.updateDungeonSettings(partyId, dungeonId)
    return this.requireParty(partyId)
  }

  public async setDungeonTier(partyId: number, tier: DungeonTier): Promise<Party> {
    await this.partyRepository.updateDungeonTier(partyId, tier)
    return this.requireParty(partyId)
  }

  public async setTargetFloor(partyId: number, targetFloor: number | null): Promise<Party> {
    await this.partyRepository.updateFloorTarget(partyId, targetFloor)
    return this.requireParty(partyId)
  }

  public async setReturnPolicy(
    partyId: number,
    returnPolicy: ExpeditionRequest['returnPolicy']
  ): Promise<Party> {
    await this.partyRepository.updateReturnPolicy(partyId, returnPolicy)
    return this.requireParty(partyId)
  }

  public async configureExpedition(
    partyId: number,
    settings: {
      dungeonId: string
      tier: DungeonTier
      targetFloor: number | null
      returnPolicy: ExpeditionRequest['returnPolicy']
    },
  ): Promise<Party> {
    const party = await this.requireParty(partyId)
    const updated: Party = {
      ...party,
      dungeonId: settings.dungeonId,
      dungeonTier: settings.tier,
      targetFloor: settings.targetFloor,
      returnPolicy: settings.returnPolicy,
    }
    await this.partyRepository.saveParty(updated)
    return this.requireParty(partyId)
  }

  public async setAutoExpedition(partyId: number, enabled: boolean): Promise<Party> {
    const party = await this.requireParty(partyId)
    const sessionId = enabled && !party.autoExpeditionEnabled
      ? `auto_${partyId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      : party.autoExpeditionSessionId
    await this.partyRepository.saveParty({
      ...party,
      autoExpeditionEnabled: enabled,
      autoExpeditionSessionId: sessionId,
      autoExpeditionSummary: enabled && sessionId && !party.autoExpeditionEnabled
        ? createAutoExpeditionSummary(sessionId)
        : party.autoExpeditionSummary,
    })
    return this.requireParty(partyId)
  }

  public async acknowledgeAutoExpeditionSummary(partyId: number): Promise<Party> {
    const party = await this.requireParty(partyId)
    if (party.autoExpeditionEnabled || (party.status ?? 'idle') === 'expedition') {
      return party
    }

    await this.partyRepository.saveParty({
      ...party,
      autoExpeditionSessionId: undefined,
    })
    return this.requireParty(partyId)
  }

  private async requireParty(partyId: number): Promise<Party> {
    const party = await this.partyRepository.getParty(partyId)
    if (!party) {
      throw new Error(`ID ${partyId} のパーティが見つかりません`)
    }
    return party
  }
}
