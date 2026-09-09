import * as THREE from 'three'
import type { Rapier } from '../physics/rapier'
import type { Puppet } from '../Puppet'
import type { RagdollConfig } from './config'

export function groups(membership: number, filter: number) {
    return (membership << 16) | filter
}

export class Ragdoll {
    bodies = new Map<string, any>()
    private restWorldQuaternion = new Map<string, THREE.Quaternion>()

    constructor(
        RAPIER: Rapier,
        world: InstanceType<Rapier['World']>,
        puppet: Puppet,
        config: RagdollConfig,
    ) {
        const gap = 0.02
        const childrenOf = new Map<string, string[]>()
        
        for (const part of config.parts) {
            if (!part.parent) continue
            
            const list = childrenOf.get(part.parent) ?? []
            list.push(part.id)
            childrenOf.set(part.parent, list)
        }

    const boneWorld = (name: string) => {
        const point = new THREE.Vector3()
        puppet.skeleton.getBoneByName(name)!.getWorldPosition(point)
        return point
    }

    for (const part of config.parts) {
        const bone = puppet.skeleton.getBoneByName(part.id)!
        const quaternion = new THREE.Quaternion()
        bone.getWorldQuaternion(quaternion)
        this.restWorldQuaternion.set(part.id, quaternion.clone())

        const desc = 
            part.bodyType === 'kinematic' ? RAPIER.RigidBodyDesc.kinematicPositionBased()
            : part.bodyType === 'fixed' ? RAPIER.RigidBodyDesc.fixed()
            : RAPIER.RigidBodyDesc.dynamic()

        const hub = new Set([
            'root',
            'puppeteer_upper_arm',
            'puppeteer_forearm',
            'puppeteer_wrist',
        ])
        const kids = childrenOf.get(part.id) ?? []
        const nextId = !hub.has(part.id) && kids.length === 1 ? kids[0] : undefined

        let body

        if (!nextId) {
            const pos = boneWorld(part.id)
            body = world.createRigidBody(desc.setTranslation(pos.x, pos.y, pos.z))
            const col = world.createCollider(RAPIER.ColliderDesc.cuboid(0.04, 0.04, 0.04), body)
            col.setDensity(part.density)
        } else {
            const a = boneWorld(part.id)
            const b = boneWorld(nextId)
            const mid = a.clone().add(b).multiplyScalar(0.5)
            const len = Math.max(a.distanceTo(b) - gap, 0.04)
            const quat = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                b.clone().sub(a).normalize(),
            )

            body = world.createRigidBody(
                desc.setTranslation(mid.x, mid.y, mid.z).setRotation({
                    x: quat.x, y: quat.y, z: quat.z, w: quat.w,
                }),
            )

            const thick = part.id === 'puppeteer_forearm' ? 0.08 : 0.04
            const col = world.createCollider(
                RAPIER.ColliderDesc.cuboid(thick, len / 2, thick),
                body,
            )
            col.setDensity(part.density)
        }

        body.setEnabled(false) // freeze until you inspect
        this.bodies.set(part.id, body)

    }

    const bitOf = new Map<string, number>()
    config.parts.forEach((p, i) => bitOf.set(p.id, 1 << (i + 1)))

    for (const part of config.parts) {
        const membership = bitOf.get(part.id)!
        let filter = 0xffff
        if (part.parent) filter &= ~bitOf.get(part.parent)!

            for (const kid of childrenOf.get(part.id) ?? []) {
                filter &= ~bitOf.get(kid)!
            }

            this.bodies.get(part.id)!.collider(0).setCollisionGroups(
                groups(membership, filter),
            )
    }

    for (const joint of config.joints) {
        const bodyA = this.bodies.get(joint.a)
        const bodyB = this.bodies.get(joint.b)
        const colA = bodyA.collider(0)
        const colB = bodyB.collider(0)
        const halfA = colA.halfExtents().y
        const halfB = colB.halfExtents().y

        world.createImpulseJoint(
            RAPIER.JointData.spherical(
                { x: 0, y: halfA, z: 0 },
                { x: 0, y: -halfB, z: 0 },
            ),
            bodyA,
            bodyB,
            true,
        )
    }

    }

    setFrozen(on: boolean) {
        for (const body of this.bodies.values()) body.setEnabled(!on)
    }
    
    syncBones(puppet: Puppet) {
        for (const id of this.bodies.keys()) {
            const bone = puppet.skeleton.getBoneByName(id)
            const body = this.bodies.get(id)
            
            if (!bone?.parent) continue

            const rot = body.rotation()
            const bodyQuat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)

            if (id === 'root') {
                const t  = body.translation()
                const worldPos = new THREE.Vector3(t.x, t.y, t.z)
                bone.parent.worldToLocal(worldPos)
                bone.position.copy(worldPos)
            }

            const parentQuat = new THREE.Quaternion()
            bone.parent.getWorldQuaternion(parentQuat)
            const rest = this.restWorldQuaternion.get(id)!
            const targetWorld = bodyQuat.clone().multiply(rest)

            bone.quaternion.copy(parentQuat.clone().invert()).multiply(targetWorld)
            bone.updateMatrixWorld(true)
        }

    }

}
