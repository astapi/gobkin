import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ImageBackground,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { getRandomSplashBackgroundImage } from '@/shared/utils/splashImages'

interface StartScreenProps {
  onStart?: () => void
  starting?: boolean
}

export function StartScreen({ onStart, starting = false }: StartScreenProps) {
  const { t } = useTranslation()
  const [startBackgroundImage] = useState(getRandomSplashBackgroundImage)

  const handleStart = () => {
    if (starting) return
    onStart?.()
  }

  return (
    <ImageBackground
      source={startBackgroundImage}
      style={styles.container}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('ui.start.title')}</Text>
            <View style={styles.subtitleRow}>
              <View style={styles.subtitleLine} />
              <Text style={styles.subtitle}>{t('ui.start.subtitle')}</Text>
              <View style={styles.subtitleLine} />
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.buttonScrim}>
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
                  <ActivityIndicator color="#374151" />
                ) : (
                  <Text style={styles.startButtonText}>{t('ui.start.beginButton')}</Text>
                )}
              </Pressable>
              <Text style={styles.tagline}>{t('ui.start.tagline')}</Text>
            </View>
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
  header: {
    alignItems: 'center',
    marginTop: 52,
  },
  title: {
    fontSize: 36,
    fontFamily: Platform.select({
      ios: 'Hiragino Mincho ProN',
      android: 'serif',
      default: 'serif',
    }),
    fontWeight: Platform.select({
      ios: '600',
      android: '700',
      default: '700',
    }),
    color: '#F0C05A',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 2,
  },
  subtitleRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  subtitleLine: {
    width: 34,
    height: 1,
    backgroundColor: 'rgba(240, 192, 90, 0.75)',
  },
  subtitle: {
    fontSize: 13,
    color: '#E4E7EE',
    letterSpacing: 5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 28,
  },
  buttonScrim: {
    width: '100%',
    paddingHorizontal: 2,
  },
  startButton: {
    width: '100%',
    minHeight: 70,
    borderRadius: 22,
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(217, 119, 6, 0.7)',
  },
  startButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    color: '#263241',
    fontSize: 17,
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
