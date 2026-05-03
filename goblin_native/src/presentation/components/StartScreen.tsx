import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ImageBackground,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useTutorialStore } from '../stores/useTutorialStore'

const startBackgroundImage = require('../../../assets/images/start-background.png')

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
    <ImageBackground
      source={startBackgroundImage}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.topScrim} />
      <View style={styles.bottomScrim} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('ui.start.title')}</Text>
            <Text style={styles.subtitle}>{t('ui.start.subtitle')}</Text>
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
                <ActivityIndicator color="#1F2937" />
              ) : (
                <Text style={styles.startButtonText}>{t('ui.start.beginButton')}</Text>
              )}
            </Pressable>
            <Text style={styles.tagline}>{t('ui.start.tagline')}</Text>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 230,
    backgroundColor: 'rgba(6, 12, 24, 0.28)',
  },
  bottomScrim: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 300,
    backgroundColor: 'rgba(3, 8, 18, 0.56)',
  },
  header: {
    alignItems: 'center',
    marginTop: 48,
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FBBF24',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: '#CBD5F5',
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 26,
  },
  startButton: {
    width: '100%',
    minHeight: 74,
    borderRadius: 18,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 214, 102, 0.45)',
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
  },
  tagline: {
    marginTop: 14,
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
})
