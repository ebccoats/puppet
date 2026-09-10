import * as THREE from 'three'
import GUI from 'lil-gui'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { Puppet } from './Puppet'
import { getRapier } from './physics/rapier'
import { RapierDebugRenderer } from './debug/RapierDebugRenderer'
import { makePuppetConfig } from './ragdoll/fromBones'
import { Ragdoll, groups } from './ragdoll/Ragdoll'
import { defaultPose } from './ragdoll/pose'

let RAPIER

let world
let debug

let ragdoll: Ragdoll
const pose = defaultPose()

const params = {
    gravity: -9.81,
    debugPhysics: true,
    density: 1,
    ox: 0,
    oy: 0,
    oz: 0,
    freeze: true,
    ragdoll: false,
}

const gui = new GUI()

function makeGui() {
    // GUI setup (break into its own file)
    gui.add( document, 'title' )

    gui.add(pose, 'thumbDeg', 90, 150, 0.5).name('mouth')
    const arms = gui.addFolder('arms')
    arms.add(pose, 'shoulderL', -90, 90, 1)
    arms.add(pose, 'shoulderR', -90, 90, 1)

    const reachMax = ragdoll.armLength.get('L') ?? 0.5

    const reach = gui.addFolder('reach')
    reach.add(pose.handL, 'x', -reachMax, reachMax, 0.01).name('handL x')
    reach.add(pose.handL, 'y', -reachMax, reachMax, 0.01).name('handL y')
    reach.add(pose.handL, 'z', -reachMax, reachMax, 0.01).name('handL z')
    reach.add(pose.handR, 'x', -reachMax, reachMax, 0.01).name('handR x')
    reach.add(pose.handR, 'y', -reachMax, reachMax, 0.01).name('handR y')
    reach.add(pose.handR, 'z', -reachMax, reachMax, 0.01).name('handR z')

    gui.add(params, 'gravity', -40, 10, 0.1)
    gui.add(params, 'debugPhysics').onChange((v: boolean) => {
        debug.toggleVisible(v)
    })
    gui.add(params, 'freeze').onChange((on:boolean) => {
        ragdoll.setFrozen(on)
    })
    
    gui.add(params, 'ragdoll')

    gui.add({ drop: () => {
        const root = ragdoll.bodies.get('root')
        root.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
        root.wakeUp()
    }}, 'drop')
}

let puppet: Puppet

const scene = new THREE.Scene()

const fov = 25
const aspect = window.innerWidth / window.innerHeight
const near = 0.1
const far = 100

const camera = new THREE.PerspectiveCamera( fov, aspect, near, far )
camera.position.set(0, 10, 10)
camera.lookAt(0, 0, 0)


const hue = 0xFFFFFF
const intensity = 3
const light = new THREE.DirectionalLight(hue, intensity)
light.position.set(1, 2, 3)
scene.add(light)
light.castShadow = true

const light2 = new THREE.AmbientLight(hue, intensity / 4)
scene.add(light2)

const rimLight = new THREE.DirectionalLight(hue, intensity)
rimLight.position.set(-1, -2, -5)
scene.add(rimLight)
rimLight.castShadow = true

const renderer = new THREE.WebGLRenderer()
renderer.setSize( window.innerWidth, window.innerHeight )
document.body.appendChild(renderer.domElement)

// Make resizing work right; this is part 1, part 2 is in render loop
function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer) {
    let canvas = renderer.domElement
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const needResize = canvas.width !== width || canvas.height !== height
    if (needResize) {
        renderer.setSize(width, height, false)
    }
    return needResize
}


// orbit controls for click, drag to move camera
const orbit = new OrbitControls(camera, renderer.domElement)
orbit.target.set(0, 0, 0)
orbit.update()

async function setup() {
    RAPIER = await getRapier() 

    world = new RAPIER.World({ x: 0, y: params.gravity, z: 0 })

    // cuboid collider has to have a height, so giving it groundHalfHeight and then moving it down by the same amount makes it register at 0,0
    const groundHalfHeight = 0.2

    const ground = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, -groundHalfHeight, 0),
    )
    world.createCollider(RAPIER.ColliderDesc.cuboid(10, groundHalfHeight, 10), ground).setCollisionGroups(groups(1 << 0, 0xffff))
    const groundGeometry = new THREE.PlaneGeometry( 20, 20 )
    const groundMaterial = new THREE.MeshPhongMaterial( { color: 0xCC8866 })
    const groundMesh = new THREE.Mesh( groundGeometry, groundMaterial )
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.receiveShadow = true
    scene.add(groundMesh)

    debug = new RapierDebugRenderer(scene, world, params.debugPhysics)

    puppet = new Puppet()
    await puppet.load(scene)

    ragdoll = new Ragdoll(RAPIER, world, puppet, makePuppetConfig())

    let canvas = renderer.domElement
    canvas.style.width = "100%"
    canvas.style.height = "100%"
    canvas.style.display = "block"
    makeGui()
}




// function offsetTarget(side: string) {
//     const bone = puppet.skeleton.getBoneByName(`ik_target_armstick.${side}`)
//     if (side === 'L') {
//         bone.position.x = position.L.x
//         bone.position.y = position.L.y
//         bone.position.z = position.L.z
//     } else if (side === 'R') {
//         bone.position.x = position.R.x
//         bone.position.y = position.R.y
//         bone.position.z = position.R.z
//     }
// }

function render( time ) {
    // this is part 2 of the resizing thing
    time *= 0.001

    if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement
        camera.aspect = canvas.clientWidth / canvas.clientHeight
        camera.updateProjectionMatrix()
    }

    if (world) {
        world.gravity = { x: 0, y: params.gravity, z: 0 }

        if (params.ragdoll) {
            ragdoll.setPose(pose)
        }

        world.step()

        if (params.ragdoll) {
            ragdoll.syncBones(puppet)
        } else if (puppet?.skeleton && puppet.ikSolver) {
            puppet.updateMouth()
            puppet.skeleton.bones[0]?.updateMatrixWorld(true)
            puppet.ikSolver.update()

            puppet.updateMouth()

        }

        debug.update()
    }

    // This is what renders the scene
    renderer.render (scene, camera)

}

setup()
renderer.setAnimationLoop( render )
