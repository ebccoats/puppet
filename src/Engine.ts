import * as THREE from 'three'
import GUI from 'lil-gui'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { Puppet } from './Puppet'
import { getRapier } from './physics/rapier'
import { RapierDebugRenderer } from './debug/RapierDebugRenderer'
import { makePuppetConfig } from './ragdoll/fromBones'
import { Ragdoll, groups } from './ragdoll/Ragdoll'
import { defaultPose } from './ragdoll/pose'
import { checkForGrantedDevices, requestDevice } from './dualsenseTrimmed.js'

let RAPIER

let world
let debug

let ragdoll: Ragdoll
const pose = defaultPose()
let r1WasDown = false

let armGuidePlane: THREE.Mesh

const params = {
    gravity: -9.81,
    debugPhysics: false,
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
    const head = gui.addFolder('head')
    head.add(pose, 'headTilt', -45, 45, 1).name('tilt')
    head.add(pose, 'headTurn', -80, 80, 1).name('turn')
    head.add(pose, 'headRoll', -35, 35, 1).name('roll')

    gui.add(pose, 'puppeteerArmVertical', -0.2, 0.2, 0.01).name('puppeteer arm vertical bounce')

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

function applyDualSenseAccel(dt: number) {
    const ds = (window as any).dshid
    if (ds?.accelx == null) return

    if (ds.l2axis != null) {
        pose.thumbDeg = THREE.MathUtils.lerp(90, 150, ds.l2axis)
    }

    if (ds.lsy != null) {
        const dead = 0.12
        const y = Math.abs(ds.lsy) < dead ? 0 : -ds.lsy
        const range = 0.2
        const targetY = THREE.MathUtils.clamp(y * range, -range, range)
        pose.puppeteerArmVertical += (targetY - pose.puppeteerArmVertical) * (1 - Math.exp(-8 * dt))
    }
    const dead = 80
    const scale = 0.008 // deg per gyro unit per second; tune
    const rate = (v: number) => (Math.abs(v) < dead ? 0 : v) * scale


    const maxPad = THREE.MathUtils.degToRad(10) // 10 on the pad = max head
    const padPitch = Math.atan2(ds.accelx, ds.accely)
    const padRoll = Math.atan2(ds.accelz, ds.accely)

    const targetTilt = THREE.MathUtils.clamp((padRoll / maxPad) * 45, -45, 45)
    const targetRoll = THREE.MathUtils.clamp((padPitch / maxPad) * 35, -35, 35)

    const a = 1 - Math.exp(-4 * dt) // lower = smoother

    const turnRate = rate(ds.gyroy)


    if (ds.l1) {
        const t = ragdoll?.bodies.get('puppeteer_wrist')?.translation()
        const from = t
            ? new THREE.Vector3(t.x, t.y, t.z)
            : new THREE.Vector2(0, 2, 0)

        const toCam = camera.position.clone().sub(from)
        const horiz = Math.hypot(toCam.x, toCam.z)

        pose.headTurn = THREE.MathUtils.clamp(
            THREE.MathUtils.radToDeg(Math.atan2(toCam.x, toCam.z)),
            -80,
            80,
        )

        pose.headTilt = THREE.MathUtils.clamp(
            THREE.MathUtils.radToDeg(Math.atan2(-toCam.y, horiz + 5)),
            -45,
            45,
        )


    } else {

        pose.headTilt += (targetTilt - pose.headTilt) * a
        pose.headRoll += (targetRoll - pose.headRoll) * a

        const turnTarget = THREE.MathUtils.clamp(
            pose.headTurn + turnRate * dt, -80, 80,
        )
        pose.headTurn += (turnTarget - pose.headTurn) * a
    }

    if (ds.rsx != null && ds.rsy != null && armGuidePlane && ragdoll) {
        const dead = 0.12
        let sx = Math.abs(ds.rsx) < dead ? 0 : ds.rsx
        let sy = Math.abs(ds.rsy) < dead ? 0 : -ds.rsy
        const mag = Math.hypot(sx, sy)
        if (mag > 1) {
            sx /= mag
            sy /= mag
        }

        armGuidePlane.updateMatrixWorld(true)
        const origin = new THREE.Vector3()
        const quat = new THREE.Quaternion()
        armGuidePlane.getWorldPosition(origin)
        armGuidePlane.getWorldQuaternion(quat)

        const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(quat)
        const axisY = new THREE.Vector3(0, 1, 0).applyQuaternion(quat)
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quat)

        const project = (p: THREE.Vector3) => {
            const d = p.clone().sub(origin).dot(normal)
            return p.clone().sub(normal.clone().multiplyScalar(d))
        }

        const reachOnPlane = (side: 'L' | 'R') => {
            const t = ragdoll.bodies.get(`shoulder.${side}`)!.translation()
            const shoulder = new THREE.Vector3(t.x, t.y, t.z)
            const center = project(shoulder)
            const dist = shoulder.clone().sub(origin).dot(normal)
            const max = ragdoll.armLength.get(side)!
            const r = Math.sqrt(Math.max(0, max * max - dist * dist))
            return { rest: project(ragdoll.handRest.get(side)!), center, r }
        }

        const L = reachOnPlane('L')
        const R = reachOnPlane('R')

        const maxTravel = (from: THREE.Vector3, center: THREE.Vector3, r: number, dir: THREE.Vector3) => {
            const m = from.clone().sub(center)
            const b = m.dot(dir)
            const c = m.lengthSq() - r * r
            const disc = b * b - c
            if (disc < 0) return 0
            return Math.max(0, -b + Math.sqrt(disc))
        }


        const delta = new THREE.Vector3()
        const r = Math.min(L.r, R.r)

        if (mag > 1e-6) {
            delta.copy(axisX).multiplyScalar(sx * r)
                .add(axisY.clone().multiplyScalar(sy * r))
        }

        const restSep = L.rest.distanceTo(R.rest)
        const pinch = Math.min(ds.r2axis ?? 0, 1 - 0.14 / restSep) // 0 = rest width, 1 = together
        const mid = L.rest.clone().add(R.rest).multiplyScalar(0.5).add(delta)
        const targetL = L.rest.clone().add(delta).lerp(mid, pinch)
        const targetR = R.rest.clone().add(delta).lerp(mid, pinch)

        const restL = ragdoll.handRest.get('L')!
        const restR = ragdoll.handRest.get('R')!

        pose.handL.x = targetL.x - restL.x
        pose.handL.y = targetL.y - restL.y
        pose.handL.z = targetL.z - restL.z
        pose.handR.x = targetR.x - restR.x
        pose.handR.y = targetR.y - restR.y
        pose.handR.z = targetR.z - restR.z

    }

    const r1 = !!ds.r1
    if (r1 && !r1WasDown) {
        ragdoll.captureHandRest()
        pose.handL.x = pose.handL.y = pose.handL.z = 0
        pose.handR.x = pose.handR.y = pose.handR.z = 0
    }
    r1WasDown = r1
}

let puppet: Puppet

const scene = new THREE.Scene()

const fov = 35
const aspect = window.innerWidth / window.innerHeight
const near = 0.1
const far = 100

const camera = new THREE.PerspectiveCamera( fov, aspect, near, far )
camera.position.set(0, 3, 4)


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
orbit.target.set(0, 2.5, 0)
orbit.update()

async function setup() {
    RAPIER = await getRapier() 

    world = new RAPIER.World({ x: 0, y: params.gravity, z: 0 })

    const backdropGroup = new THREE.Group()
    const textureLoader = new THREE.TextureLoader()
    const backdropUrl = new URL('./assets/rc-bg.jpg', import.meta.url).href
    const backdropTexture = textureLoader.load(backdropUrl)
    console.log(backdropTexture)

    const bgMaterial = new THREE.MeshStandardMaterial({
        map: backdropTexture,
        roughness: 0.8,
        side: THREE.DoubleSide,
    })

    const bgWidth = 7
    const bgFloorDepth = 10
    const bgHeight = 5 
    const radius = 3

    const wallGeo = new THREE.PlaneGeometry(bgWidth, bgHeight)
    const wall = new THREE.Mesh(wallGeo, bgMaterial)
    wall.position.set(0, 2, -2)
    wall.receiveShadow = true
    backdropGroup.add(wall)
    scene.add(backdropGroup)

    const armGuideGeo = new THREE.PlaneGeometry(4, 4, 4, 4)
    const armGuideMat = new THREE.MeshBasicMaterial({
        color: 0x88ff88,
        wireframe: true,
        side: THREE.DoubleSide,
    })

    armGuidePlane = new THREE.Mesh(armGuideGeo, armGuideMat)
    armGuidePlane.position.set(0, 1.5, 1)
    armGuidePlane.rotation.x = THREE.MathUtils.degToRad(-45)
    armGuidePlane.visible = false
    scene.add(armGuidePlane)
    // cuboid collider has to have a height, so giving it groundHalfHeight and then moving it down by the same amount makes it register at 0,0
    // const groundHalfHeight = 0.2
    //
    // const ground = world.createRigidBody(
    //     RAPIER.RigidBodyDesc.fixed().setTranslation(0, -groundHalfHeight, 0),
    // )
    // world.createCollider(RAPIER.ColliderDesc.cuboid(10, groundHalfHeight, 10), ground).setCollisionGroups(groups(1 << 0, 0xffff))
    // const groundGeometry = new THREE.PlaneGeometry( 20, 20 )
    // const groundMaterial = new THREE.MeshPhongMaterial( { color: 0xCC8866 })
    // const groundMesh = new THREE.Mesh( groundGeometry, groundMaterial )
    // groundMesh.rotation.x = -Math.PI / 2
    // groundMesh.receiveShadow = true
    // scene.add(groundMesh)
    //
    debug = new RapierDebugRenderer(scene, world, params.debugPhysics)

    puppet = new Puppet()
    await puppet.load(scene)
    puppet.updateMouth()
    puppet.scene.updateMatrixWorld(true)

    ragdoll = new Ragdoll(RAPIER, world, puppet, makePuppetConfig())

    let canvas = renderer.domElement
    canvas.style.width = "100%"
    canvas.style.height = "100%"
    canvas.style.display = "block"
    makeGui()

    document.getElementById('ds-connect')!.onclick = () => { requestDevice() }
    checkForGrantedDevices()
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
let lastTime = 0

function render( time: number ) {
    // this is part 2 of the resizing thing

    time *= 0.001
    
    const dt = lastTime === 0
        ? 1 / 60
        : Math.min(time - lastTime, 1 / 30)
    lastTime = time

    if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement
        camera.aspect = canvas.clientWidth / canvas.clientHeight
        camera.updateProjectionMatrix()
    }

    if (world) {
        world.gravity = { x: 0, y: params.gravity, z: 0 }

        applyDualSenseAccel(dt)
        if (params.ragdoll) {
            ragdoll.setPose(pose, dt, armGuidePlane)
        }

        world.step()

        if (ragdoll) {
            ragdoll.clampArmSpeed()

        }

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
