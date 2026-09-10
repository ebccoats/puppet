import type { RagdollConfig, PartDef, JointDef } from './config'

export function makeCoreConfig(): RagdollConfig {
    const parts: PartDef[] = [
        { id: 'root', bodyType: 'fixed', density: 1 },
        { id: 'puppeteer_upper_arm', parent: 'root', density: 1, bodyType: 'fixed'},
        { id: 'puppeteer_forearm', parent: 'puppeteer_upper_arm', density: 1, bodyType: 'fixed'},
        { id: 'puppeteer_wrist', parent: 'puppeteer_forearm', density: 0.8, bodyType: 'fixed'},
        { id: 'puppeteer_thumb', parent: 'puppeteer_wrist', density: 0.2 },

        { id: 'hip.L', parent: 'puppeteer_forearm', density: 0.8 },
        { id: 'upper_leg.L', parent: 'hip.L', density: 0.5 },
        { id: 'lower_leg.L', parent: 'upper_leg.L', density: 0.5 },
        { id: 'foot.L', parent: 'lower_leg.L', density: 0.4 },

        { id: 'hip.R', parent: 'puppeteer_forearm', density: 0.8 },
        { id: 'upper_leg.R', parent: 'hip.R', density: 0.5 },
        { id: 'lower_leg.R', parent: 'upper_leg.R', density: 0.5 },
        { id: 'foot.R', parent: 'lower_leg.R', density: 0.4 },


        { id: 'shoulder.L', parent: 'puppeteer_forearm', density: 0.5 },
        { id: 'shoulder.R', parent: 'puppeteer_forearm', density: 0.5 },
    ]

    const joints: JointDef[] = parts
        .filter((part) => part.parent)
        .map((part) => {
            const knee = part.id === 'lower_leg.L' || part.id === 'lower_leg.R'
            const thumb = part.id === 'puppeteer_thumb'
            const shoulder = part.id === 'shoulder.L' || part.id === 'shoulder.R'
            const hinge = knee || thumb 
            return {
                id: `j-${part.parent}-${part.id}`,
                a: part.parent!,
                b: part.id,
                type: hinge ? 'revolute' : 'spherical',
                axis: hinge ? [1, 0, 0] : undefined,
                limits: thumb
                    ? [
                        ((90 - 92) * Math.PI) / 180, // closed max
                        ((150 - 92) * Math.PI) / 180, // open 88 deg
                    ]
                    :shoulder
                        ? [-Math.PI / 2, Math.PI / 2]
                        : knee 
                            ? [-2.4, 0.15] 
                            : undefined,

            }
        })

    return { parts, joints }
}

export function makeArmChain(side: 'L' | 'R', density = 0.12): RagdollConfig {
    const parts: PartDef[] = []
    const joints: JointDef[] = []

    for (let i = 1; i <= 16; i++) {
        const id = `arm.${side}.${i}`
        const parent = i === 1 ? `shoulder.${side}` : `arm.${side}.${i - 1}`
        const fromShoulder = i === 1

        parts.push({ id, parent, density })
        joints.push({
            id: `j-${parent}-${id}`,
            a: parent,
            b: id,
            type: fromShoulder ? 'spherical' : 'revolute',
            axis: fromShoulder ? undefined : [1, 0, 0],
            limits: fromShoulder ? undefined : [-2.2, 2.2],
        })
    }

    parts.push({
        id: `hand.${side}`,
        parent: `arm.${side}.16`,
        density
    })
    joints.push({
        id: `j-arm16-hand.${side}`,
        a: `arm.${side}.16`,
        b: `hand.${side}`,
        type: 'revolute',
        axis: [1, 0, 0],
        limits: [-2.2, 2.2],
    })

    return {parts, joints}
}

export function makePuppetConfig(): RagdollConfig {
    const core = makeCoreConfig()
    const left = makeArmChain('L')
    const right = makeArmChain('R')
    
    return {
        parts: [...core.parts, ...left.parts, ...right.parts],
        joints: [...core.joints, ...left.joints, ...right.joints],
    }
}
