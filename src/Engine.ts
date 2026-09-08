import * as THREE from 'three'
import GUI from 'lil-gui'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/Addons.js'


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
function resizeRendererToDisplaySize(renderer) {
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


let cube = new THREE.Mesh()
const gui = new GUI()

// function makeGui() {
//     // GUI setup (break into its own file)
//     gui.add( document, 'title' )
//
//     gui.add( puppet.position, 'x')
//     .min(-2)
//     .max(2)
//     .step(0.01)
//     .onChange( value => {
//         puppet.position.setX(value)
//     })
//     gui.add( puppet.position, 'y')
//     .min(-2)
//     .max(2)
//     .step(0.01)
//     .onChange( value => {
//         puppet.position.setY(value)
//     })
//     gui.add( cube.position, 'z')
//     .min(-2)
//     .max(2)
//     .step(0.01)
//     .onChange( value => {
//         cube.position.setZ(value)
//     })
// }


const loader = new GLTFLoader()

function makePuppet() {
    const puppetPath = new URL('./assets/puppet_re-rig.glb', import.meta.url).href
    loader.load(puppetPath, function (gltf) {
        gltf.scene.scale.setScalar(0.5)
        gltf.scene.traverse(function (child) {
            if (child.isSkinnedMesh) {
                if (child.name === 'Mesh001') {
                    let skinnedMesh = child
                    skeleton = child.skeleton
                    skeleton.bones.forEach(bone => {
                        bone.name = bone.userData.name
                    })

                }
            }


        })
        console.log(gltf.scene)
        scene.add(gltf.scene)
        gltf.scene.position.setY(-2.5)
    })
}

let skeleton = new THREE.Skeleton()
async function setup() {
    makePuppet()

    let canvas = renderer.domElement
    canvas.style.width = "100%"
    canvas.style.height = "100%"
    canvas.style.display = "block"
    // makeGui()
}

function render( time ) {
    // this is part 2 of the resizing thing
    time *= 0.001

    if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement
        camera.aspect = canvas.clientWidth / canvas.clientHeight
        camera.updateProjectionMatrix()
    }

    // This is what renders the scene
    renderer.render (scene, camera)

}

setup()
renderer.setAnimationLoop( render )
