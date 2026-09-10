export const THUMB_BIND_DEG = 92

export type PuppetPose = {
    thumbDeg: number
    shoulderL: number // degrees from bind
    shoulderR: number
    handL: { x: number; y: number; z: number } // offset from hand's spawn position
    handR: { x: number; y: number; z: number }
}

export function defaultPose(): PuppetPose {
    return {
        thumbDeg: THUMB_BIND_DEG,
        shoulderL: 0,
        shoulderR: 0,
        handL: { x: 0, y: 0, z: 0 },
        handR: { x: 0, y: 0, z: 0 },
    }
}
