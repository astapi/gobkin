import { memo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { useTranslation } from 'react-i18next'
import { getGoblinDisplayImage, getGoblinDisplayImageScale } from '@/shared/utils/goblinImages'
import { getFactorImage } from '@/shared/utils/factorImages'
import { getEffectiveStats } from '@/shared/utils/goblinStats'
import type { Goblin } from '@/shared/types'
import { getRaceLabel } from '@/shared/i18n/entityLocalization'

interface GoblinCardProps {
  goblin: Goblin
  onPress?: () => void
  isAssigned?: boolean
  isAssignedElsewhere?: boolean
  assignedPartyName?: string
  disabled?: boolean
}

export const GoblinCard = memo(function GoblinCard({
  goblin,
  onPress,
  isAssigned = false,
  isAssignedElsewhere = false,
  assignedPartyName,
  disabled = false
}: GoblinCardProps) {
  const { t } = useTranslation()
  const stats = getEffectiveStats(goblin)
  const factorIds = goblin.factors ?? []

  const content = (
    <View style={[
      styles.container,
      isAssigned && styles.containerAssigned,
      isAssignedElsewhere && styles.containerDisabled,
    ]}>
      <Image
        source={getGoblinDisplayImage(goblin)}
        style={[
          styles.avatar,
          { transform: [{ scale: getGoblinDisplayImageScale(goblin) }] },
        ]}
      />
      <View style={styles.info}>
        <Text style={[styles.name, isAssignedElsewhere && styles.nameDisabled]}>
          {goblin.name}
        </Text>
        <View style={styles.subRow}>
          <Text style={[styles.race, isAssignedElsewhere && styles.raceDisabled]}>
            {getRaceLabel(goblin.raceId ?? goblin.race)}
          </Text>
          <Text style={[styles.level, isAssignedElsewhere && styles.levelDisabled]}>
            {t('ui.common.levelShort')}{goblin.level}
          </Text>
          {factorIds.length > 0 && (
            <View style={styles.factorIcons}>
              {factorIds.map((factorId, index) => {
                const FactorIcon = getFactorImage(factorId)
                return <FactorIcon key={`${factorId}-${index}`} width={16} height={16} />
              })}
            </View>
          )}
        </View>
      </View>
      <View style={styles.statsContainer}>
        {assignedPartyName && (
          <Text style={styles.partyAssignment}>
            {assignedPartyName}
          </Text>
        )}
        <Text style={[styles.statText, isAssignedElsewhere && styles.statTextDisabled]}>
          HP: {stats.hp}
        </Text>
        <Text style={[styles.statText, isAssignedElsewhere && styles.statTextDisabled]}>
          ATK: {stats.atk}
        </Text>
      </View>
      {isAssignedElsewhere && (
        <Text style={styles.assignedBadge}>他PT</Text>
      )}
      {isAssigned && !isAssignedElsewhere && (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>v</Text>
        </View>
      )}
    </View>
  )

  if (onPress && !disabled) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={isAssignedElsewhere ? 1 : 0.7}
      >
        {content}
      </TouchableOpacity>
    )
  }

  return content
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  containerAssigned: {
    backgroundColor: '#EFF6FF',
  },
  containerDisabled: {
    backgroundColor: '#F9FAFB',
    opacity: 0.6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 8,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 1,
  },
  nameDisabled: {
    color: '#9CA3AF',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  race: {
    fontSize: 11,
    color: '#6B7280',
  },
  raceDisabled: {
    color: '#9CA3AF',
  },
  partyAssignment: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 1,
  },
  level: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  levelDisabled: {
    color: '#9CA3AF',
  },
  factorIcons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  statsContainer: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  statText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 1,
  },
  statTextDisabled: {
    color: '#9CA3AF',
  },
  assignedBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
})
