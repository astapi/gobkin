import type { ImageSourcePropType } from 'react-native'

export const splashBackgroundImages: ImageSourcePropType[] = [
  require('../../../assets/images/splash-goblin-settlement-raid.png'),
  require('../../../assets/images/splash-orc-fortress-raid.png'),
  require('../../../assets/images/splash-fortress-defense.png'),
]

export function getRandomSplashBackgroundImage(): ImageSourcePropType {
  const index = Math.floor(Math.random() * splashBackgroundImages.length)
  return splashBackgroundImages[index]
}
