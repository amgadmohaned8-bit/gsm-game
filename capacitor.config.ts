
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gsm.game',
  appName: 'Global Soccer Manager',
  webDir: 'public',
  server: {
  url: 'https://gsm-game.vercel.app',
    cleartext: false
  }
};

export default config;
