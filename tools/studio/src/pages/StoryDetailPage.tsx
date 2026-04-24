import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { StorySchema } from '../lib/schema'
import type {
  Story,
  StoryCategory,
  StoryChapter,
  StoryReward,
  StoryUnlockCondition,
} from '../lib/schema'
import {
  FieldRow,
  NumberField,
  TextAreaField,
  TextField,
} from '../components/fields'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'success' }

const EMPTY_STORY: Story = {
  id: '',
  title: '',
  category: 'main',
  order: 0,
  unlockCondition: null,
  rewards: [],
  chapters: [{ id: 'chapter_1', text: '' }],
}

export function StoryDetailPage() {
  const { storyId } = useParams<{ storyId: string }>()
  const navigate = useNavigate()
  const isNew = storyId === undefined
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [draft, setDraft] = useState<Story | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const originalRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (isNew) {
      setDraft(structuredClone(EMPTY_STORY))
      originalRef.current = stableStringify(EMPTY_STORY)
      setLoadState({ kind: 'ready' })
      setSaveState({ kind: 'idle' })
      return
    }

    setLoadState({ kind: 'loading' })
    setSaveState({ kind: 'idle' })
    setDeleteError(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/stories/${storyId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as Story
        if (cancelled) return
        setDraft(data)
        originalRef.current = stableStringify(data)
        setLoadState({ kind: 'ready' })
      } catch (err) {
        if (!cancelled) {
          setLoadState({
            kind: 'error',
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isNew, storyId])

  const isDirty = useMemo(() => {
    if (!draft || originalRef.current === null) return false
    return stableStringify(draft) !== originalRef.current
  }, [draft])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const updateDraft = useCallback((updater: (prev: Story) => Story) => {
    setDraft((prev) => (prev ? updater(prev) : prev))
    setSaveState({ kind: 'idle' })
    setDeleteError(null)
  }, [])

  const save = useCallback(async () => {
    if (!draft) return
    const result = StorySchema.safeParse(draft)
    if (!result.success) {
      setSaveState({
        kind: 'error',
        message: `story 検証失敗: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / ')}`,
      })
      return
    }

    setSaveState({ kind: 'saving' })
    try {
      const method = isNew ? 'POST' : 'PUT'
      const url = isNew ? '/api/stories' : `/api/stories/${storyId}`
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story: draft }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error ?? `HTTP ${res.status}`)
      }
      originalRef.current = stableStringify(draft)
      setSaveState({ kind: 'success' })
      if (isNew) {
        navigate(`/stories/${draft.id}`, { replace: true })
      }
    } catch (err) {
      setSaveState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [draft, isNew, navigate, storyId])

  const revert = useCallback(() => {
    if (originalRef.current === null) return
    setDraft(JSON.parse(originalRef.current) as Story)
    setSaveState({ kind: 'idle' })
    setDeleteError(null)
  }, [])

  const remove = useCallback(async () => {
    if (isNew || !storyId) return
    const confirmed = window.confirm(`ストーリー ${storyId} を削除しますか？`)
    if (!confirmed) return
    setDeleteError(null)
    try {
      const res = await fetch(`/api/stories/${storyId}`, { method: 'DELETE' })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error ?? `HTTP ${res.status}`)
      }
      navigate('/stories')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err))
    }
  }, [isNew, navigate, storyId])

  if (loadState.kind === 'loading') return <p className="state-msg">読み込み中…</p>
  if (loadState.kind === 'error') {
    return <p className="state-msg error">読み込みに失敗しました: {loadState.message}</p>
  }
  if (!draft) return null

  return (
    <div className="detail story-detail">
      <p>
        <Link to="/stories">← ストーリー一覧へ戻る</Link>
      </p>
      <div className="detail-head">
        <div>
          <h2>{isNew ? '新規ストーリー' : draft.title || draft.id}</h2>
          <p className="subtle">
            <code>{draft.id || '(id未設定)'}</code> · {draft.category} · order {draft.order}
          </p>
        </div>
        <div className="save-bar">
          {!isNew && (
            <button className="btn ghost" onClick={remove}>
              削除
            </button>
          )}
          {saveState.kind === 'saving' && <span className="subtle">保存中…</span>}
          {saveState.kind === 'success' && !isDirty && (
            <span className="saved">保存しました</span>
          )}
          <button
            className="btn ghost"
            onClick={revert}
            disabled={!isDirty || saveState.kind === 'saving'}
          >
            取り消し
          </button>
          <button
            className="btn primary"
            onClick={save}
            disabled={saveState.kind === 'saving'}
          >
            保存
          </button>
        </div>
      </div>

      {saveState.kind === 'error' && <p className="save-error">{saveState.message}</p>}
      {deleteError && <p className="save-error">{deleteError}</p>}

      <div className="panel-stack">
        <section className="card">
          <h3>基本情報</h3>
          <FieldRow>
            <TextField
              size="md"
              label="id"
              value={draft.id}
              onChange={(value) => updateDraft((prev) => ({ ...prev, id: value }))}
              placeholder="story_id"
            />
            <TextField
              size="xl"
              label="title"
              value={draft.title}
              onChange={(value) => updateDraft((prev) => ({ ...prev, title: value }))}
            />
            <label className="field field-size-sm">
              <span className="field-label">category</span>
              <span className="field-input">
                <select
                  value={draft.category}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      category: e.target.value as StoryCategory,
                    }))
                  }
                >
                  <option value="main">main</option>
                  <option value="side">side</option>
                </select>
              </span>
            </label>
            <NumberField
              size="xs"
              label="order"
              value={draft.order}
              onChange={(value) => updateDraft((prev) => ({ ...prev, order: value }))}
            />
          </FieldRow>
        </section>

        <section className="card">
          <div className="section-head">
            <h3>解放条件</h3>
            <button
              className="btn ghost small"
              onClick={() =>
                updateDraft((prev) => ({
                  ...prev,
                  unlockCondition: prev.unlockCondition
                    ? null
                    : { type: 'dungeon_cleared', dungeonId: '' },
                }))
              }
            >
              {draft.unlockCondition ? '常時解放にする' : '条件を追加'}
            </button>
          </div>

          {draft.unlockCondition ? (
            <FieldRow>
              <label className="field field-size-sm">
                <span className="field-label">type</span>
                <span className="field-input">
                  <select value={draft.unlockCondition.type} disabled>
                    <option value="dungeon_cleared">dungeon_cleared</option>
                  </select>
                </span>
              </label>
              <TextField
                size="md"
                label="dungeonId"
                value={draft.unlockCondition.dungeonId}
                onChange={(value) =>
                  updateDraft((prev) => ({
                    ...prev,
                    unlockCondition: {
                      type: 'dungeon_cleared',
                      dungeonId: value,
                    } satisfies StoryUnlockCondition,
                  }))
                }
              />
            </FieldRow>
          ) : (
            <p className="subtle">このストーリーは常時解放です。</p>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <h3>報酬</h3>
            <button
              className="btn ghost small"
              onClick={() =>
                updateDraft((prev) => ({
                  ...prev,
                  rewards: [...prev.rewards, { type: 'gold', value: 0 }],
                }))
              }
            >
              + 報酬を追加
            </button>
          </div>
          {draft.rewards.length === 0 ? (
            <p className="subtle">報酬はありません。</p>
          ) : (
            <div className="story-block-list">
              {draft.rewards.map((reward, index) => (
                <StoryRewardCard
                  key={`${index}-${reward.type}`}
                  reward={reward}
                  onChange={(nextReward) =>
                    updateDraft((prev) => ({
                      ...prev,
                      rewards: prev.rewards.map((entry, entryIndex) =>
                        entryIndex === index ? nextReward : entry,
                      ),
                    }))
                  }
                  onMoveUp={() => moveItem(index, -1, draft.rewards, (next) =>
                    updateDraft((prev) => ({ ...prev, rewards: next })),
                  )}
                  onMoveDown={() => moveItem(index, 1, draft.rewards, (next) =>
                    updateDraft((prev) => ({ ...prev, rewards: next })),
                  )}
                  onDelete={() =>
                    updateDraft((prev) => ({
                      ...prev,
                      rewards: prev.rewards.filter((_, entryIndex) => entryIndex !== index),
                    }))
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <h3>チャプター</h3>
            <button
              className="btn ghost small"
              onClick={() =>
                updateDraft((prev) => ({
                  ...prev,
                  chapters: [
                    ...prev.chapters,
                    createChapter(prev.id || 'story', prev.chapters.length + 1),
                  ],
                }))
              }
            >
              + チャプターを追加
            </button>
          </div>
          <div className="story-block-list">
            {draft.chapters.map((chapter, index) => (
              <StoryChapterCard
                key={chapter.id || index}
                chapter={chapter}
                onChange={(nextChapter) =>
                  updateDraft((prev) => ({
                    ...prev,
                    chapters: prev.chapters.map((entry, entryIndex) =>
                      entryIndex === index ? nextChapter : entry,
                    ),
                  }))
                }
                onMoveUp={() => moveItem(index, -1, draft.chapters, (next) =>
                  updateDraft((prev) => ({ ...prev, chapters: next })),
                )}
                onMoveDown={() => moveItem(index, 1, draft.chapters, (next) =>
                  updateDraft((prev) => ({ ...prev, chapters: next })),
                )}
                onDelete={() =>
                  updateDraft((prev) => ({
                    ...prev,
                    chapters:
                      prev.chapters.length <= 1
                        ? [createChapter(prev.id || 'story', 1)]
                        : prev.chapters.filter((_, entryIndex) => entryIndex !== index),
                  }))
                }
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function StoryRewardCard({
  reward,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  reward: StoryReward
  onChange: (reward: StoryReward) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  return (
    <div className="story-block">
      <div className="story-block-head">
        <strong>報酬</strong>
        <div className="pattern-actions">
          <button className="icon-btn" title="上へ" onClick={onMoveUp}>
            ↑
          </button>
          <button className="icon-btn" title="下へ" onClick={onMoveDown}>
            ↓
          </button>
          <button className="icon-btn danger" title="削除" onClick={onDelete}>
            ×
          </button>
        </div>
      </div>
      <FieldRow>
        <label className="field field-size-sm">
          <span className="field-label">type</span>
          <span className="field-input">
            <select
              value={reward.type}
              onChange={(e) =>
                onChange({
                  type: e.target.value as StoryReward['type'],
                  value: e.target.value === 'gold' ? 0 : '',
                })
              }
            >
              <option value="gold">gold</option>
              <option value="goblin">goblin</option>
              <option value="equipment">equipment</option>
            </select>
          </span>
        </label>
        {reward.type === 'gold' ? (
          <NumberField
            size="sm"
            label="value"
            value={typeof reward.value === 'number' ? reward.value : 0}
            min={0}
            onChange={(value) => onChange({ ...reward, value })}
          />
        ) : (
          <TextField
            size="lg"
            label="value"
            value={typeof reward.value === 'string' ? reward.value : String(reward.value)}
            onChange={(value) => onChange({ ...reward, value })}
          />
        )}
      </FieldRow>
    </div>
  )
}

function StoryChapterCard({
  chapter,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  chapter: StoryChapter
  onChange: (chapter: StoryChapter) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  return (
    <div className="story-block">
      <div className="story-block-head">
        <strong>{chapter.id || 'チャプター'}</strong>
        <div className="pattern-actions">
          <button className="icon-btn" title="上へ" onClick={onMoveUp}>
            ↑
          </button>
          <button className="icon-btn" title="下へ" onClick={onMoveDown}>
            ↓
          </button>
          <button className="icon-btn danger" title="削除" onClick={onDelete}>
            ×
          </button>
        </div>
      </div>
      <FieldRow>
        <TextField
          size="lg"
          label="id"
          value={chapter.id}
          onChange={(value) => onChange({ ...chapter, id: value })}
        />
      </FieldRow>
      <FieldRow>
        <TextAreaField
          size="xl"
          label="text"
          value={chapter.text}
          rows={8}
          onChange={(value) => onChange({ ...chapter, text: value })}
        />
      </FieldRow>
    </div>
  )
}

function moveItem<T>(
  index: number,
  direction: -1 | 1,
  items: T[],
  commit: (items: T[]) => void,
) {
  const target = index + direction
  if (target < 0 || target >= items.length) return
  const next = items.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  commit(next)
}

function createChapter(storyId: string, number: number): StoryChapter {
  return {
    id: `${storyId}_chapter_${number}`,
    text: '',
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {}
      for (const key of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[key] = (val as Record<string, unknown>)[key]
      }
      return sorted
    }
    return val
  })
}
