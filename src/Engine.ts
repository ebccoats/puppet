import * as THREE from 'three'
import GUI from 'lil-gui'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { Puppet } from './Puppet'
import { getRapier } from './physics/rapier'
import { RapierDebugRenderer } from './debug/RapierDebugRenderer'

let world
let boxBody
let boxMesh
let boxCollider
let debug
let centerOfMassMarker

const params = {
    gravity: -9.81,
    debugPhysics: true,
    density: 1,
    ox: 0,
    oy: 0,
    oz: 0,
}

let puppet: Puppet

const scene = new THREE.Scene()

const fov = 25
const aspect = window.innerWidth / window.innerHeight
const near = 0.1
const far = 100

const camera = new THREE.PerspectiveCamera( fov, aspect, near, far )
camera.position.set(0, 10, 20)
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
    const RAPIER = await getRapier()

    centerOfMassMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.08),
        new THREE.MeshBasicMaterial({ color: 0xffff00 }),
    )
    scene.add(centerOfMassMarker)

    world = new RAPIER.World({ x: 0, y: params.gravity, z: 0 })

    // cuboid collider has to have a height, so giving it groundHalfHeight and then moving it down by the same amount makes it register at 0,0
    const groundHalfHeight = 0.2

    const ground = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, -groundHalfHeight, 0),
    )
    world.createCollider(RAPIER.ColliderDesc.cuboid(10, groundHalfHeight, 10), ground)
    const groundGeometry = new THREE.PlaneGeometry( 20, 20 )
    const groundMaterial = new THREE.MeshPhongMaterial( { color: 0xCC8866 })
    const groundMesh = new THREE.Mesh( groundGeometry, groundMaterial )
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.receiveShadow = true
    scene.add(groundMesh)

    boxBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, 0),
    )
    boxCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(0.25, 0.25, 0.25), boxBody)
    boxCollider.setDensity(params.density)
    boxCollider.setTranslationWrtParent({ x: params.ox, y: params.oy, z: params.oz })
    boxBody.recomputeMassPropertiesFromColliders()

    boxMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshPhongMaterial({ color: 0x88ccff })
    )
    scene.add(boxMesh)

    debug = new RapierDebugRenderer(scene, world, params.debugPhysics)

    puppet = new Puppet(scene)

    let canvas = renderer.domElement
    canvas.style.width = "100%"
    canvas.style.height = "100%"
    canvas.style.display = "block"
    makeGui()
}

const position = {
    R: {
        x: 0,
        y: 0,
        z: 0,
    },
    L: {
        x: 0,
        y: 0,
        z: 0,
    },
}

const gui = new GUI()

function makeGui() {
    // GUI setup (break into its own file)
    gui.add( document, 'title' )

    gui.add( puppet.mouth, 'rotationDeg')
    .min(90)
    .max(126)
    .step(0.5)

    gui.add(params, 'gravity', -40, 10, 0.1)
    gui.add(params, 'debugPhysics').onChange((v: boolean) => {
        debug.toggleVisible(v)
    })

    gui.add(params, 'density', 0.01, 20, 0.01).onChange(applyMass)
    gui.add(params, 'ox', -1, 1, 0.01).onChange(applyMass)
    gui.add(params, 'oy', -1, 1, 0.01).onChange(applyMass)
    gui.add(params, 'oz', -1, 1, 0.01).onChange(applyMass)

    gui.add( position.R, 'x')
    .min(-5)
    .max(5)
    .step(0.01)
    gui.add( position.R, 'y')
    .min(-5)
    .max(5)
    .step(0.01)
    gui.add( position.R, 'z')
    .min(-5)
    .max(5)
    .step(0.01)
    gui.add( position.L, 'x')
    .min(-5)
    .max(5)
    .step(0.01)
    gui.add( position.L, 'y')
    .min(-5)
    .max(5)
    .step(0.01)
    gui.add( position.L, 'z')
    .min(-5)
    .max(5)
    .step(0.01)
}

function applyMass() {
    boxCollider.setDensity(params.density)
    boxCollider.setTranslationWrtParent({ x: params.ox, y: params.oy, z: params.oz })
    boxBody.recomputeMassPropertiesFromColliders()
}

function offsetTarget(side: string) {
    const bone = puppet.skeleton.getBoneByName(`ik_target_armstick.${side}`)
    if (side === 'L') {
        bone.position.x = position.L.x
        bone.position.y = position.L.y
        bone.position.z = position.L.z
    } else if (side === 'R') {
        bone.position.x = position.R.x
        bone.position.y = position.R.y
        bone.position.z = position.R.z
    }
}

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
        world.step()

        const com = boxBody.worldCom()
        centerOfMassMarker.position.set(com.x, com.y, com.z)

        const t = boxBody.translation()
        const r = boxBody.rotation()
        boxMesh.position.set(t.x, t.y, t.z)
        boxMesh.quaternion.set(r.x, r.y, r.z, r.w)

        debug.update()
    }
    if (puppet?.skeleton && puppet?.ikSolver) {
        offsetTarget("L")
        offsetTarget("R") 
        puppet.updateMouth()
        puppet.skeleton.bones[0]?.updateMatrixWorld(true)
        puppet.ikSolver.update()

    }
    // This is what renders the scene
    renderer.render (scene, camera)

}

setup()
renderer.setAnimationLoop( render )
