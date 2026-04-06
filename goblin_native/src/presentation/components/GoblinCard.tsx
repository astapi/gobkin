import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { getGoblinImage } from '@/shared/utils/goblinImages'
import { getFactorImage } from '@/shared/utils/factorImages'
import { getEffectiveStats } from '@/shared/utils/goblinStats'
import type { Goblin } from '@/shared/types'

interface GoblinCardProps {
  goblin: Goblin
  onPress?: () => void
  isAssigned?: boolean
  isAssignedElsewhere?: boolean
  disabled?: boolean
}

export function GoblinCard({
  goblin,
  onPress,
  isAssigned = false,
  isAssignedElsewhere = false,
  disabled = false
}: GoblinCardProps) {
  const stats = getEffectiveStats(goblin)
  const FactorIcon1 = goblin.factors?.[0] ? getFactorImage(goblin.factors[0]) : null
  const FactorIcon2 = goblin.factors?.[1] ? getFactorImage(goblin.factors[1]) : null

  const content = (
    <View style={[
      styles.container,
      isAssigned && styles.containerAssigned,
      isAssignedElsewhere && styles.containerDisabled,
    ]}>
      <Image source={getGoblinImage(goblin.avatar)} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={[styles.name, isAssignedElsewhere && styles.nameDisabled]}>
          {goblin.name}
        </Text>
        <View style={styles.subRow}>
          <Text style={[styles.race, isAssignedElsewhere && styles.raceDisabled]}>
            {goblin.race}
          </Text>
          <Text style={[styles.level, isAssignedElsewhere && styles.levelDisabled]}>
            Lv.{goblin.level}
          </Text>
          <View style={styles.factorIcons}>
            {FactorIcon1 && <FactorIcon1 width={16} height={16} />}
            {FactorIcon2 && <FactorIcon2 width={16} height={16} />}
          </View>
        </View>
      </View>
      <View style={styles.statsContainer}>
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
}

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
    gap: 6,
  },
  race: {
    fontSize: 11,
    color: '#6B7280',
  },
  raceDisabled: {
    color: '#9CA3AF',
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
