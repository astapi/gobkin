import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  ATTRIBUTE_ROWS,
  STAT_ROWS,
  formatStatValue,
  getEnemyEntry,
  getFactorDropNames,
  getRareDropNames,
  getUnlockedTiers,
} from '@/presentation/encyclopedia/encyclopediaData'
import { useDungeonStore } from '@/presentation/stores/useDungeonStore'
import { SPELL_DEFS } from '@/shared/data/spells'
import {
  getDungeonName,
  getEnemyName,
  getSkillDescription,
  getSkillLabel,
} from '@/shared/i18n/entityLocalization'
import { DUNGEON_TIER_META } from '@/shared/types/DungeonTier'
import { getEnemyImage } from '@/shared/utils/enemyImages'
import { applyDungeonTierScalingToEnemy } from '@/shared/utils/enemyTierScaling'

export default function EncyclopediaMonsterDetailScreen() {
  const { t } = useTranslation()
  const { dungeonId, enemyId } = useLocalSearchParams<{ dungeonId: string; enemyId: string }>()
  const dungeons = useDungeonStore((state) => state.dungeons)
  const dungeon = dungeons.find((entry) => entry.id === dungeonId && entry.unlocked)
  const entry = dungeon ? getEnemyEntry(dungeon.id, enemyId) : undefined
  const image = entry ? getEnemyImage(entry.enemy) : null

  if (!dungeon || !entry) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: t('ui.encyclopedia.title') }} />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t('ui.encyclopedia.empty')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const tiers = getUnlockedTiers(dungeon)

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: getEnemyName(entry.enemy) }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <View style={styles.imageFrame}>
            {image ? (
              <Image source={image} style={styles.enemyImage} resizeMode="contain" />
            ) : (
              <Text style={styles.imageFallback}>?</Text>
            )}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.summaryName}>{getEnemyName(entry.enemy)}</Text>
            <Text style={styles.summaryMeta}>{getDungeonName(dungeon)}</Text>
            <Text style={styles.summaryMeta}>
              {entry.isBoss ? t('ui.encyclopedia.boss') : t('ui.encyclopedia.normal')}
            </Text>
          </View>
        </View>

        {tiers.map((tier) => {
          const tieredEnemy = applyDungeonTierScalingToEnemy(entry.enemy, tier)
          const rareDrops = getRareDropNames(tieredEnemy)
          const factorDrops = getFactorDropNames(tieredEnemy)
          const skills = tieredEnemy.skills ?? []
          const spells = tieredEnemy.spells ?? []
          const tierMeta = DUNGEON_TIER_META.find((meta) => meta.tier === tier)

          return (
            <View key={tier} style={styles.tierCard}>
              <View style={styles.tierHeader}>
                <View style={styles.tierTitleBlock}>
                  <Text style={styles.tierTitle}>
                    {tierMeta ? t(tierMeta.labelKey) : tier + 1}
                  </Text>
                  <Text style={styles.tierMeta}>Lv.{tieredEnemy.level}</Text>
                </View>
              </View>

              <View style={styles.statGrid}>
                {STAT_ROWS.map((row) => (
                  <View key={row.key} style={styles.statCell}>
                    <Text style={styles.statLabel}>{row.label}</Text>
                    <Text style={styles.statValue}>{formatStatValue(tieredEnemy[row.key])}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.attributeGrid}>
                {ATTRIBUTE_ROWS.map((row) => (
                  <View key={row.key} style={styles.attributeCell}>
                    <Text style={styles.statLabel}>{row.label}</Text>
                    <Text style={styles.statValue}>{tieredEnemy.baseAttributes[row.key]}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.infoBlock}>
                <Text style={styles.infoTitle}>{t('ui.encyclopedia.skills')}</Text>
                {skills.length === 0 && spells.length === 0 ? (
                  <Text style={styles.emptyLine}>{t('ui.encyclopedia.none')}</Text>
                ) : (
                  <>
                    {skills.map((skill) => {
                      const description = getSkillDescription(skill)
                      return (
                        <View key={skill.id} style={styles.skillRow}>
                          <Text style={styles.skillName}>{getSkillLabel(skill)}</Text>
                          {description ? <Text style={styles.skillDescription}>{description}</Text> : null}
                        </View>
                      )
                    })}
                    {spells.map((spell) => {
                      const spellDef = SPELL_DEFS[spell.spellId]
                      return (
                        <View key={spell.spellId} style={styles.skillRow}>
                          <Text style={styles.skillName}>{spellDef?.name ?? spell.spellId}</Text>
                          <Text style={styles.skillDescription}>
                            {t('ui.encyclopedia.spellCharges', {
                              count: (spellDef?.defaultCharges ?? 1) + (spell.extraCharges ?? 0),
                            })}
                          </Text>
                        </View>
                      )
                    })}
                  </>
                )}
              </View>

              <View style={styles.infoBlock}>
                <Text style={styles.infoTitle}>{t('ui.encyclopedia.rareDrops')}</Text>
                {rareDrops.length === 0 ? (
                  <Text style={styles.emptyLine}>{t('ui.encyclopedia.none')}</Text>
                ) : (
                  rareDrops.map((dropName) => (
                    <Text key={dropName} style={styles.dropLine}>・{dropName}</Text>
                  ))
                )}
              </View>

              {factorDrops.length > 0 ? (
                <View style={styles.infoBlock}>
                  <Text style={styles.infoTitle}>{t('ui.encyclopedia.factorDrops')}</Text>
                  {factorDrops.map((factorName) => (
                    <Text key={factorName} style={styles.dropLine}>・{factorName}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    gap: 14,
  },
  imageFrame: {
    width: 58,
    height: 58,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyImage: {
    width: 52,
    height: 52,
  },
  imageFallback: {
    color: '#9CA3AF',
    fontSize: 28,
    fontWeight: '800',
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  summaryName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  summaryMeta: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  tierCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 14,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  tierTitleBlock: {
    flex: 1,
    gap: 4,
  },
  tierTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  tierMeta: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 17,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  statCell: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  attributeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  attributeCell: {
    width: '33.3333%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  statValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  infoBlock: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    gap: 8,
  },
  infoTitle: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '800',
  },
  skillRow: {
    gap: 2,
  },
  skillName: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  skillDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  dropLine: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 20,
  },
  emptyLine: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  emptyCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
  },
})
