import type { ComponentType } from 'react'
import type { DeviceId } from '../../data/devices'
import type { DeviceProps } from '../common/util'
import { ModuloComando } from './ModuloComando'
import { Fotossensor } from './Fotossensor'
import { SensorMagnetico } from './SensorMagnetico'
import { Sirene } from './Sirene'
import { ControleRemoto } from './ControleRemoto'
import { Placa } from './Placa'
import { Smartphone } from './Smartphone'

// Um componente por aparelho. Para trocar por .glb, substitua o componente aqui
// mantendo os mesmos part.id nos <ClickablePart>.
export const DEVICE_COMPONENTS: Record<DeviceId, ComponentType<DeviceProps>> = {
  modulo: ModuloComando,
  fotossensor: Fotossensor,
  magnetico: SensorMagnetico,
  sirene: Sirene,
  controle: ControleRemoto,
  placa: Placa,
  app: Smartphone,
}
