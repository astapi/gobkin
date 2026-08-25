import { parseGameAgentBridgeMessage } from '../parseGameAgentMessage'

describe('parseGameAgentBridgeMessage', () => {
  it('遠征設定コマンドを解析する', () => {
    const message = parseGameAgentBridgeMessage(JSON.stringify({
      type: 'execute_action',
      payload: {
        actionId: 'action-1',
        reason: '安全な階層を選択',
        action: {
          type: 'configure_expedition',
          partyId: 1,
          dungeonId: 'slime_cave',
          tier: 0,
          targetFloor: 5,
          returnPolicy: 'if_two_ko',
        },
      },
    }))

    expect(message.payload).toEqual({
      actionId: 'action-1',
      reason: '安全な階層を選択',
      action: {
        type: 'configure_expedition',
        partyId: 1,
        dungeonId: 'slime_cave',
        tier: 0,
        targetFloor: 5,
        returnPolicy: 'if_two_ko',
      },
    })
  })

  it('不正な帰還条件を拒否する', () => {
    expect(() => parseGameAgentBridgeMessage(JSON.stringify({
      type: 'execute_action',
      payload: {
        actionId: 'action-2',
        action: {
          type: 'configure_expedition',
          partyId: 1,
          dungeonId: 'slime_cave',
          returnPolicy: 'invalid',
        },
      },
    }))).toThrow('returnPolicyが不正です')
  })

  it('未知の操作を拒否する', () => {
    expect(() => parseGameAgentBridgeMessage(JSON.stringify({
      type: 'execute_action',
      payload: {
        actionId: 'action-3',
        action: { type: 'delete_everything' },
      },
    }))).toThrow('未対応のaction typeです')
  })
})

