export type PartDef = {
    id: string
    parent?: string
    bodyType?: 'dynamic' | 'fixed' | 'kinematic'
    density: number
}

export type JointDef = {
    id: string
    a: string
    b: string
    type: 'spherical' | 'revolute'
    axis?: [number, number, number]
    limits?: [number, number]
}

export type RagdollConfig = { parts: PartDef[]; joints: JointDef[] }
