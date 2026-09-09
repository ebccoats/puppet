import * as THREE from 'three'
import { GLTFLoader } from "three/examples/jsm/Addons.js"
import { CCDIKSolver } from 'three/examples/jsm/Addons.js'

export class Puppet {
    scene: any
    skeleton: THREE.Skeleton
    ikSolver: CCDIKSolver
    mouth: {
        rotationDeg: number
    }

    constructor(scene: THREE.Scene) {
        this.mouth = { rotationDeg: 92 }

        const puppetPath = new URL('./assets/puppet_re-rig.glb', import.meta.url).href
        const loader = new GLTFLoader()
        loader.load(puppetPath, (gltf) => {

            let skinnedMesh
            gltf.scene.scale.setScalar(0.5)
            gltf.scene.position.setY(-2.5)

            gltf.scene.traverse( (child) => {
                if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
                    const mesh = child as THREE.SkinnedMesh
                    skinnedMesh = mesh
                    this.skeleton = mesh.skeleton
                }

            })

            this.skeleton.bones.forEach((bone) => {
                if (bone.userData.name) bone.name = bone.userData.name
            })

            this.scene = gltf.scene
            scene.add(this.scene)
            this.ikSolver = new CCDIKSolver(skinnedMesh, [this.makeArmIK('L'), this.makeArmIK('R')])
        })
        
    }


    public updateMouth() {
        const mouthBone = this.skeleton.getBoneByName('puppeteer_thumb')
        mouthBone.rotation.x = THREE.MathUtils.degToRad(this.mouth.rotationDeg)
    }


    boneIndex(name: string) {
        const index = this.skeleton.bones.findIndex(bone => bone.name === name)
        if (index < 0) throw new Error(`missing bone ${name}`)
        return index
    }

    makeArmIK(side: string) {
        return {
            target: this.boneIndex(`ik_target_armstick.${side}`),
            effector: this.boneIndex(`arm_stick.${side}`),
            iteration: 10,
            maxAngle: 0.5,
            links: [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ({
                index: this.boneIndex(`arm.${side}.${n}`),
            })),

        }
    }
}
