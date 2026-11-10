import { Stage } from '../Stage'
import { KitLineup } from './Kit'

/** Abertura: palco escuro com reflexo; os 7 aparelhos entram um a um e formam a foto do kit. */
export function Intro() {
  return (
    <>
      <Stage floorY={0} />
      <KitLineup mode="enter" />
    </>
  )
}
