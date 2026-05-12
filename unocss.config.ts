import { defineConfig, presetMini, presetIcons } from 'unocss';

export default defineConfig({
  presets: [presetMini(), presetIcons({ scale: 1.2 })],
  theme: {
    colors: {
      primary: '#0078d4',
      surface: '#1e1e1e',
      'surface-alt': '#2d2d2d',
      text: '#cccccc',
      'text-dim': '#808080',
      border: '#3c3c3c',
    },
  },
});