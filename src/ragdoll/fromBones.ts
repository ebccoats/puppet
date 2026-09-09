import type { RagdollConfig, PartDef, JointDef } from './config'

export function makeCoreConfig(): RagdollConfig {
    const parts: PartDef[] = [
        { id: 'root', bodyType: 'kinematic', density: 1 },
        { id: 'puppeteer_upper_arm', parent: 'root', density: 1 },
        { id: 'puppeteer_forearm', parent: 'puppeteer_upper_arm', density: 1 },

        { id: 'hip.L', parent: 'puppeteer_forearm', density: 0.8 },
        { id: 'upper_leg.L', parent: 'hip.L', density: 0.5 },
        { id: 'lower_leg.L', parent: 'upper_leg.L', density: 0.5 },
        { id: 'foot.L', parent: 'lower_leg.L', density: 0.4 },

        { id: 'hip.R', parent: 'puppeteer_forearm', density: 0.8 },
        { id: 'upper_leg.R', parent: 'hip.R', density: 0.5 },
        { id: 'lower_leg.R', parent: 'upper_leg.R', density: 0.5 },
        { id: 'foot.R', parent: 'lower_leg.R', density: 0.4 },

        { id: 'puppeteer_wrist', parent: 'puppeteer_forearm', density: 0.8 },
        { id: 'puppeteer_thumb', parent: 'puppeteer_wrist', density: 0.2 },

        { id: 'shoulder.L', parent: 'puppeteer_forearm', density: 0.5 },
        { id: 'shoulder.R', parent: 'puppeteer_forearm', density: 0.5 },
    ]

    const joints: JointDef[] = parts
        .filter((part) => part.parent)
        .map((part) => ({
            id: `j-${part.parent}-${part.id}`,
            a: part.parent!,
            b: part.id,
            type: 'spherical',
        }))

    return { parts, joints }
}
