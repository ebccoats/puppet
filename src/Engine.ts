import * as THREE from 'three'
import GUI from 'lil-gui'


const scene = new THREE.Scene()

const fov = 35
const aspect = window.innerWidth / window.innerHeight
const near = 0.1
const far = 100

const camera = new THREE.PerspectiveCamera( fov, aspect, near, far )
camera.position.set(0, 0, 5)
camera.lookAt(0, 0, 0)

const hue = 0xFFFFFF
const intensity = 3
const light = new THREE.DirectionalLight(hue, intensity)
light.position.set(0, 0, 3)
scene.add(light)
light.castShadow = true

const renderer = new THREE.WebGLRenderer()
renderer.setSize( window.innerWidth, window.innerHeight )
document.body.appendChild(renderer.domElement)

let cube = new THREE.Mesh()
const gui = new GUI()

async function makeCube() {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshStandardMaterial({ color: 0xffff00 })
    cube = new THREE.Mesh( geometry, material )
    cube.castShadow = true
    await scene.add(cube)
    console.log(cube)

    makeGui()

    function makeGui() {
        // GUI setup (break into its own file)
        gui.add( document, 'title' )

        gui.add( cube.position, 'x')
            .min(-2)
            .max(2)
            .step(0.01)
            .onChange( value => {
                cube.position.setX(value)
            })
        gui.add( cube.position, 'y')
            .min(-2)
            .max(2)
            .step(0.01)
            .onChange( value => {
                cube.position.setY(value)
            })
        gui.add( cube.position, 'z')
            .min(-2)
            .max(2)
            .step(0.01)
            .onChange( value => {
                cube.position.setZ(value)
            })


    }

}
function animate( time ) {
    renderer.render (scene, camera)
    cube.rotation.x = time / 2000
    cube.rotation.y = time / 1000
}

makeCube()
renderer.setAnimationLoop( animate )
