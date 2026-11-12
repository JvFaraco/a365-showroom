// Camada 2D da cena "Sistema conectado" (ficava em src/ui/Overlays.tsx). Arquivada: fora do build.
function NetworkUI() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4">
      <div className="glass max-w-2xl rounded-2xl px-5 py-3 text-center text-[0.9em] text-white/85">
        <b className="font-title text-white">Sistema conectado.</b> Sensores, sirene e controle falam com o Módulo por radiofrequência. O Módulo fala com a nuvem por três vias: <b>Chip 4G, Wi-Fi e Ethernet</b>. Da nuvem, o aviso chega ao aplicativo e à Central.
        <span className="mt-1 block text-[0.85em] text-white/55">Clique num aparelho para abri-lo no showroom.</span>
      </div>
    </div>
  )
}

