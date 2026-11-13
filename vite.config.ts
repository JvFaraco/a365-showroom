import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pacotes separados: three, o ecossistema react-three (fiber, drei e companhia), o pós-processamento e a
// camada de interface. O único acima de 600 kB é o núcleo do three (675 kB, 171 kB em gzip): na versão
// 0.169 ele é um arquivo só e não dá para dividir; por isso o aviso fica em 700 kB.
const groups = [
  { name: 'postfx', test: /node_modules[\\/](postprocessing|n8ao|@react-three[\\/]postprocessing)[\\/]/, priority: 40 },
  { name: 'three', test: /node_modules[\\/]three[\\/]build[\\/]/, priority: 50 },
  { name: 'three-extras', test: /node_modules[\\/](three[\\/]examples|three-stdlib|camera-controls|maath|troika-[a-z-]+|meshline|three-mesh-bvh)[\\/]/, priority: 45 },
  { name: 'r3f', test: /node_modules[\\/](@react-three|suspend-react|its-fine|react-reconciler|scheduler|tunnel-rat|zustand|@use-gesture|react-use-measure)[\\/]/, priority: 20 },
  { name: 'ui', test: /node_modules[\\/](react|react-dom|framer-motion|motion-dom|motion-utils)[\\/]/, priority: 10 },
]

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 700, rolldownOptions: { output: { codeSplitting: { groups } } } },
})
