export type Rapier = typeof import ('@dimforge/rapier3d')

export function getRapier() {
    return import('@dimforge/rapier3d')
}
