import { ReorientationPlugin as ReorientationPluginBase } from '3d-tiles-renderer/three/plugins'

declare module '3d-tiles-renderer/three/plugins' {
  interface ReorientationPlugin {
    lat?: number
    lon?: number
    height?: number
  }
}

export class ReorientationPlugin extends ReorientationPluginBase {
  update(): void {
    const { lat, lon, height } = this
    if (lat != null && lon != null) {
      this.transformLatLonHeightToOrigin(lat, lon, height)
    }
  }
}
