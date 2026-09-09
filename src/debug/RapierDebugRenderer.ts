import type { Rapier } from '../physics/rapier'
import {
    Scene,
    LineSegments,
    BufferGeometry,
    LineBasicMaterial,
    BufferAttribute
} from 'three'

export class RapierDebugRenderer {
    mesh: LineSegments
    world: InstanceType<Rapier['World']>
    enabled: boolean

    constructor(
        scene: Scene,
        world: InstanceType<Rapier['World']>,
        enabled: boolean

    ) {
        this.world = world
        this.mesh = new LineSegments(
            new BufferGeometry(), 
            new LineBasicMaterial({ color: 0xffffff, vertexColors: true }),
        )
        this.mesh.frustumCulled = false
        this.enabled = enabled
        scene.add(this.mesh)

    }

    toggleVisible(visible: boolean) {
        this.enabled = visible
    }

    update() {
        if (!this.enabled) {
            this.mesh.visible = false
            return

        }

        const { vertices, colors } = this.world.debugRender()
        this.mesh.geometry.setAttribute('position', new BufferAttribute(vertices, 3))
        this.mesh.geometry.setAttribute('color', new BufferAttribute(colors, 3))
        this.mesh.visible = true
    }
}
