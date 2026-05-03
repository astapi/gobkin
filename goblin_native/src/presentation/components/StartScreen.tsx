import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useTutorialStore } from '../stores/useTutorialStore'

const goblinImage = require('../../../assets/goblin/goblin.png')

interface StartScreenProps {
  onStart?: () => void
}

export function StartScreen({ onStart }: StartScreenProps) {
  const { t } = useTranslation()
  const advanceTo = useTutorialStore(state => state.advanceTo)
  const [starting, setStarting] = useState(false)

  const handleStart = async () => {
    if (starting) return
    setStarting(true)
    try {
      await advanceTo('read_prologue')
      onStart?.()
    } finally {
      setStarting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('ui.start.title')}</Text>
          <Text style={styles.subtitle}>{t('ui.start.subtitle')}</Text>
        </View>

        <View style={styles.imageWrapper}>
          <Image source={goblinImage} style={styles.image} resizeMode="contain" />
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.startButton,
              pressed && styles.startButtonPressed,
              starting && styles.startButtonDisabled,
            ]}
            onPress={handleStart}
            disabled={starting}
          >
            {starting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.startButtonText}>{t('ui.start.beginButton')}</Text>
            )}
          </Pressable>
          <Text style={styles.tagline}>{t('ui.start.tagline')}</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FBBF24',
    letterSpacing: 2,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    color: '#CBD5F5',
    letterSpacing: 4,
    textAlign: 'center',
  },
  imageWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 220,
    height: 220,
    opacity: 0.95,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  startButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  startButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tagline: {
    marginTop: 16,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
})
