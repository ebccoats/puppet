import * as THREE from 'three'
import type { Rapier } from '../physics/rapier'
import type { Puppet } from '../Puppet'
import type { RagdollConfig } from './config'
import { THUMB_BIND_DEG } from './pose'

export function groups(membership: number, filter: number) {
    return (membership << 16) | filter
}

export class Ragdoll {
    bodies = new Map<string, any>()
    joints = new Map<string, any>()
    private restWorldQuaternion = new Map<string, THREE.Quaternion>()

    handTargets = new Map<string, any>()
    handRest = new Map<string, THREE.Vector3>()
    armLength = new Map<string, number>()

    boneOriginLocal = new Map<string, THREE.Vector3>()

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

        const desc = 
            part.bodyType === 'kinematic' ? RAPIER.RigidBodyDesc.kinematicPositionBased()
            : part.bodyType === 'fixed' ? RAPIER.RigidBodyDesc.fixed()
            : RAPIER.RigidBodyDesc.dynamic()

        const hub = new Set([
            'root',
            'puppeteer_upper_arm',
            'puppeteer_forearm',
            'puppeteer_wrist',
            'shoulder.L',
            'shoulder.R',
        ])
        const kids = childrenOf.get(part.id) ?? []
        const nextId = !hub.has(part.id) && kids.length === 1 ? kids[0] : undefined

        let body


        if (!nextId) {
            this.boneOriginLocal.set(part.id, new THREE.Vector3(0,0,0))

            const pos = boneWorld(part.id)
            body = world.createRigidBody(desc.setTranslation(pos.x, pos.y, pos.z))
            const col = world.createCollider(RAPIER.ColliderDesc.cuboid(0.04, 0.04, 0.04), body)
            col.setDensity(part.density)

        } else {
            const a = boneWorld(part.id)
            const b = boneWorld(nextId)
            const mid = a.clone().add(b).multiplyScalar(0.5)
            const len = Math.max(a.distanceTo(b) - gap, 0.04)

            this.boneOriginLocal.set(part.id, new THREE.Vector3(0, -len / 2, 0))

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

        body.setAngularDamping(1)
        body.setLinearDamping(0.2)

        if (part.id.startsWith('arm.') || part.id.startsWith('hand.')) {
            body.setLinearDamping(10)
            body.setAngularDamping(10)
        }


        body.setEnabled(false) // freeze until you inspect



        this.bodies.set(part.id, body)

        const br = body.rotation()
        const bodyBind = new THREE.Quaternion(br.x, br.y, br.z, br.w)
        this.restWorldQuaternion.set(part.id, bodyBind.invert().multiply(quaternion))
    }

    const bitOf = new Map<string, number>()

    for (const part of config.parts) {
        if (part.id.startsWith('arm.L') || part.id === 'hand.L') {
            bitOf.set(part.id, 1 << 1)
        } else if (part.id.startsWith('arm.R') || part.id === 'hand.R') {
            bitOf.set(part.id, 1 << 2)
        } else {
            bitOf.set(part.id, 1 << 3)
        }
    }

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

        const worldPoint = boneWorld(joint.b) // child's bone origin

        const toLocal = (body: any, point: THREE.Vector3) => {
            const t = body.translation()
            const r = body.rotation()
            const q = new THREE.Quaternion(r.x, r.y, r.z, r.w)
            return point.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(q.clone().invert())
        }

        const a = toLocal(bodyA, worldPoint)
        const b = toLocal(bodyB, worldPoint)

        const anchorA = { x: a.x, y: a.y, z: a.z }
        const anchorB = { x: b.x, y: b.y, z: b.z }

        let axis = joint.axis
            ? { x: joint.axis[0], y: joint.axis[1], z: joint.axis[2] }
            : undefined

        if (joint.b === 'shoulder.L' || joint.b === 'shoulder.R') {
            const hubBone = puppet.skeleton.getBoneByName('puppeteer_forearm')!
            const axisWorld = new THREE.Vector3(0, 0, 1).applyQuaternion(
                hubBone.getWorldQuaternion(new THREE.Quaternion()),
            )
            const wr = bodyA.rotation()
            const axisLocal = axisWorld.applyQuaternion(
                new THREE.Quaternion(wr.x, wr.y, wr.z, wr.w).invert(),
            )
            axis = { x: axisLocal.x, y: axisLocal.y, z: axisLocal.z }
        }

        if (joint.b === 'puppeteer_thumb') {
            const wristBone = puppet.skeleton.getBoneByName('puppeteer_wrist')!
            const axisWorld = new THREE.Vector3(1, 0, 0).applyQuaternion(
                wristBone.getWorldQuaternion(new THREE.Quaternion())
            )

            const wr = bodyA.rotation()
            const axisLocal = axisWorld.applyQuaternion(
                new THREE.Quaternion(wr.x, wr.y, wr.z, wr.w).invert(),
            )
            axis = { x: axisLocal.x, y: axisLocal.y, z: axisLocal.z }
        }

        const twistLock = 
            RAPIER.JointAxesMask.LinX |
            RAPIER.JointAxesMask.LinY |
            RAPIER.JointAxesMask.LinZ |
            RAPIER.JointAxesMask.AngX

        const data = 
            joint.b === 'arm.L.1' || joint.b === 'arm.R.1'
                ? RAPIER.JointData.generic(
                    anchorA,
                    anchorB,
                    { x: 0, y: 1, z: 0 }, // bone = +Y on arm cuboid
                    twistLock,
                )
            : joint.type === 'revolute'
                ? RAPIER.JointData.revolute(anchorA, anchorB, axis!)
                : RAPIER.JointData.spherical(anchorA, anchorB)

        const created = world.createImpulseJoint(data, bodyA, bodyB, true)

        if (joint.type === 'revolute' && joint.limits) {
            created.setLimits(joint.limits[0], joint.limits[1])
        }

        if (joint.b === 'puppeteer_thumb') {
            created.configureMotorModel(RAPIER.MotorModel.ForceBased)
            created.setMotorMaxForce(1000)
        }

        this.joints.set(joint.b, created)
    }

    for (const side of ['L', 'R'] as const) {
        const t = this.bodies.get(`hand.${side}`)!.translation()

        const desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(t.x, t.y, t.z)  
        const target = world.createRigidBody(desc)
        const col = world.createCollider(RAPIER.ColliderDesc.ball(0.03), target)
        col.setCollisionGroups(groups(1 << 4, 0))

        this.handTargets.set(side, target)
        this.handRest.set(side, new THREE.Vector3(t.x, t.y, t.z))
        
        const hand = this.bodies.get(`hand.${side}`)!
        const data = RAPIER.JointData.spherical(
            {x: 0, y: 0, z: 0}, // hand center of mass
            {x: 0, y: 0, z: 0}, // ball center of mass
        )
        world.createImpulseJoint(data, hand, target, true)
    }

    this.armLength = new Map<string, number>()

    for (const side of ['L', 'R'] as const) {
        let len = 0
        let prev = boneWorld(`shoulder.${side}`)
        for (let i = 1; i <= 16; i++) {
            const p = boneWorld(`arm.${side}.${i}`)
            len += prev.distanceTo(p)
            prev = p
        }
        len += prev.distanceTo(boneWorld(`hand.${side}`))
        this.armLength.set(side, len)

    }

    // end of constructor
    console.log('thumb joint', this.joints.get('puppeteer_thumb'))
    }


    setFrozen(on: boolean) {
        for (const [id, body] of this.bodies) {
            if (id === 'root') continue
            body.setEnabled(!on)
        }
    }
    
    syncBones(puppet: Puppet) {
        for (const id of this.bodies.keys()) {
            const bone = puppet.skeleton.getBoneByName(id)
            const body = this.bodies.get(id)
            
            if (!bone?.parent) continue

            const rot = body.rotation()
            const bodyQuat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)

            if (
                id === 'root' ||
                id.startsWith('arm.') ||
                id.startsWith('hand.')
            ) {
                const t  = body.translation()
                const local = this.boneOriginLocal.get(id) ?? new THREE.Vector3()
                const worldPos = new THREE.Vector3(t.x, t.y, t.z)
                    .add(local.clone().applyQuaternion(bodyQuat))
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

    setThumbDeg(deg: number, bind = 92) {
        const j = this.joints.get('puppeteer_thumb')
        j.configureMotorPosition(
            THREE.MathUtils.degToRad(deg - bind),
            400, // stiffness
            20, // damping
        )
        this.bodies.get('puppeteer_thumb')!.wakeUp()
        this.bodies.get('puppeteer_wrist')!.wakeUp()
    }

    setShoulderDeg(side: 'L' | 'R', deg: number) {
        const id = `shoulder.${side}`
        const j = this.joints.get(id)
        j.configureMotorPosition(
            THREE.MathUtils.degToRad(deg),
            200, // stiffness
            15, // damping
        )
        this.bodies.get(id)!.wakeUp()
    }

    setHandTargets(pose: { handL: {x: number; y: number; z: number}; handR: { x: number; y: number; z: number} }) {

        for (const side of ['L', 'R'] as const) {
            const rest = this.handRest.get(side)!
            const off = pose[`hand${side}`]
            const world = new THREE.Vector3(
                rest.x + off.x,
                rest.y + off.y,
                rest.z + off.z,
            )

            const origin = this.bodies.get(`shoulder.${side}`)!.translation()
            const max = this.armLength.get(side)!
            const dx = world.x - origin.x
            const dy = world.y - origin.y
            const dz = world.z - origin.z
            const dist = Math.hypot(dx, dy, dz)

            if (dist > max && dist > 1e-6) {
                const s = max / dist
                world.x = origin.x + dx * s
                world.y = origin.y + dy * s
                world.z = origin.z + dz * s
            }

            this.handTargets.get(side)!.setNextKinematicTranslation({
                x: world.x, y: world.y, z: world.z,
            })
        }
    }

    setPose(pose: { thumbDeg: number; shoulderL: number; shoulderR: number }) {
        this.setThumbDeg(pose.thumbDeg, THUMB_BIND_DEG)
        // this.setShoulderDeg('L', pose.shoulderL)
        // this.setShoulderDeg('R', pose.shoulderR)
        this.setHandTargets(pose)
    }
}
