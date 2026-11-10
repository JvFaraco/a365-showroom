import { Stage } from '../Stage'
import { KitLineup } from './Kit'

/** Encerramento: os aparelhos se reúnem; o logo e o slogan ficam na camada 2D. */
export function Outro() {
  return (
    <>
      <Stage floorY={0} />
      <KitLineup mode="gather" />
    </>
  )
}
