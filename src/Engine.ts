import * as THREE from 'three'
import GUI from 'lil-gui'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { CCDIKSolver } from 'three/examples/jsm/Addons.js'


const scene = new THREE.Scene()

const fov = 25
const aspect = window.innerWidth / window.innerHeight
const near = 0.1
const far = 100

const camera = new THREE.PerspectiveCamera( fov, aspect, near, far )
camera.position.set(0, 0, 5)
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


const loader = new GLTFLoader()
let puppet
let skeleton: THREE.Skeleton
let ikSolver: CCDIKSolver

function boneIndex(name: string) {
    const index = skeleton.bones.findIndex(bone => bone.name === name)
    if (index < 0) throw new Error(`missing bone ${name}`)
    return index
}

function makeArmIK(side: string) {
    return {
        target: boneIndex(`ik_target_armstick.${side}`),
        effector: boneIndex(`arm_stick.${side}`),
        iteration: 10,
        maxAngle: 0.5,
        links: [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ({
            index: boneIndex(`arm.${side}.${n}`),
        })),

    }
}

function makePuppet() {
    const puppetPath = new URL('./assets/puppet_re-rig.glb', import.meta.url).href
    loader.load(puppetPath, (gltf) => {
        let skinnedMesh
        gltf.scene.scale.setScalar(0.5)
        gltf.scene.position.setY(-2.5)

        gltf.scene.traverse( (child) => {
            if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
                const mesh = child as THREE.SkinnedMesh
                skinnedMesh = mesh
                skeleton = mesh.skeleton
            }

        })

        skeleton.bones.forEach((bone) => {
            if (bone.userData.name) bone.name = bone.userData.name
        })

        puppet = gltf.scene
        scene.add(puppet)
        ikSolver = new CCDIKSolver(skinnedMesh, [makeArmIK('L'), makeArmIK('R')])

    })
}

async function setup() {
    makePuppet()

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

const mouth = { rotationDeg: 92 }


const gui = new GUI()

function makeGui() {
    // GUI setup (break into its own file)
    gui.add( document, 'title' )

    gui.add( mouth, 'rotationDeg')
    .min(90)
    .max(126)
    .step(0.5)
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

function offsetTarget(side: string) {
    const bone = skeleton.getBoneByName(`ik_target_armstick.${side}`)
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

function updateMouth() {
    const mouthBone = skeleton.getBoneByName('puppeteer_thumb')
    mouthBone.rotation.x = THREE.MathUtils.degToRad(mouth.rotationDeg)
}

function render( time ) {
    // this is part 2 of the resizing thing
    time *= 0.001

    if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement
        camera.aspect = canvas.clientWidth / canvas.clientHeight
        camera.updateProjectionMatrix()
    }

    if (skeleton && ikSolver) {
        offsetTarget("L")
        offsetTarget("R") 
        updateMouth()
        skeleton.bones[0]?.updateMatrixWorld(true)
        ikSolver.update()

    }
    // This is what renders the scene
    renderer.render (scene, camera)

}

setup()
renderer.setAnimationLoop( render )
