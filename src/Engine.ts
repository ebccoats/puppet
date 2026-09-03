import * as THREE from 'three'

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

const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshStandardMaterial({ color: 0xffff00 })
const cube = new THREE.Mesh( geometry, material )
cube.castShadow = true
scene.add(cube)

function animate( time ) {
    renderer.render (scene, camera)
    cube.rotation.x = time / 2000
    cube.rotation.y = time / 1000
}

renderer.setAnimationLoop( animate )
