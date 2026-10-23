import type { CaseDef } from '../engine/types'
import { broccoli } from './broccoli'
import { fridge } from './fridge'
import { haircut } from './haircut'
import { influencer } from './influencer'
import { neglect } from './neglect'
import { vegetable } from './vegetable'

/** The docket. Adding a case = writing one data file and listing it here. */
export const CASES: CaseDef[] = [neglect, haircut, broccoli, vegetable, influencer, fridge]
export const getCase = (id: string): CaseDef | undefined => CASES.find((c) => c.id === id)
