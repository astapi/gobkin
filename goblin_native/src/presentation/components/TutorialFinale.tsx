import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTutorialStore } from '../stores/useTutorialStore'

/**
 * チュートリアルの締め演出。
 * 拠点にゴブリンを迎え入れた後（step === 'finish'）に全画面で表示し、
 * 「冒険を始める」を押すとチュートリアルを完了する。
 */
export function TutorialFinale() {
  const { t } = useTranslation()
  const step = useTutorialStore(state => state.step)

  if (step !== 'finish') return null

  const handleStart = () => {
    void useTutorialStore.getState().complete()
  }

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.overlay]} pointerEvents="auto">
      <View style={styles.card}>
        <Text style={styles.body}>{t('ui.tutorial.finale.body')}</Text>
        <Text style={styles.lead}>{t('ui.tutorial.finale.lead')}</Text>
        <TouchableOpacity style={styles.button} onPress={handleStart} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{t('ui.tutorial.finale.start')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FBBF24',
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#FBBF24',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: '#E5E7EB',
    textAlign: 'center',
  },
  lead: {
    marginTop: 18,
    fontSize: 15,
    fontWeight: '700',
    color: '#FEF3C7',
    textAlign: 'center',
  },
  button: {
    marginTop: 26,
    alignSelf: 'stretch',
    backgroundColor: '#FBBF24',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 1,
  },
})
