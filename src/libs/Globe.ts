import { MeshLambertNodeMaterial } from 'three/webgpu';
import { DRACOLoader } from 'three/examples/jsm/Addons.js';
import { radians } from '@takram/three-geospatial';
import { TilesRenderer } from '3d-tiles-renderer';
import {
  CesiumIonAuthPlugin,
  GLTFExtensionsPlugin,
  TileCompressionPlugin,
  UpdateOnChangePlugin,
} from '3d-tiles-renderer/plugins';

import { TilesFadePlugin } from '@/plugins/fade/TilesFadePlugin';
import { TileCreasedNormalsPlugin } from '@/plugins/TileCreasedNormalsPlugin';
import { TileMaterialReplacementPlugin } from '@/plugins/TileMaterialReplacementPlugin';
import { ReorientationPlugin } from '@/plugins/ReorientationPlugin';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

class Globe {
  tilesRenderer: TilesRenderer;
  cesiumIonPlugin: CesiumIonAuthPlugin;
  gltfExtensionsPlugin: GLTFExtensionsPlugin;
  tileCompressionPlugin: TileCompressionPlugin;
  updateOnChangePlugin: UpdateOnChangePlugin;
  tilesFadePlugin: TilesFadePlugin;
  tileCreasedNormalsPlugin: TileCreasedNormalsPlugin;
  tileMaterialReplacementPlugin: TileMaterialReplacementPlugin;
  reorientationPlugin: ReorientationPlugin;

  constructor() {
    this.tilesRenderer = this._initTilesRenderer();
    this.cesiumIonPlugin = this._initCesiumIonPlugin();
    this.gltfExtensionsPlugin = this._initGLTFExtensionsPlugin();
    this.tileCompressionPlugin = this._initTileCompressionPlugin();
    this.updateOnChangePlugin = this._initUpdateOnChangePlugin();
    this.tilesFadePlugin = this._initTilesFadePlugin();
    this.tileCreasedNormalsPlugin = this._initTileCreasedNormalsPlugin();
    this.tileMaterialReplacementPlugin = this._initTileMaterialReplacementPlugin();
    this.reorientationPlugin = this._initReorientationPlugin();
  }

  _initTilesRenderer() {
    const tilesRenderer = new TilesRenderer();
    return tilesRenderer;
  }

  _initCesiumIonPlugin() {
    const cesiumIonPlugin = new CesiumIonAuthPlugin({
      apiToken: 'YOUR_CESIUM_ION_ACCESS_TOKEN',
      assetId: 'xxx',
      autoRefreshToken: true,
    });
    this.tilesRenderer.registerPlugin(cesiumIonPlugin);
    return cesiumIonPlugin;
  }

  _initGLTFExtensionsPlugin() {
    const gltfExtensionsPlugin = new GLTFExtensionsPlugin({
      dracoLoader,
    });
    this.tilesRenderer.registerPlugin(gltfExtensionsPlugin);
    return gltfExtensionsPlugin;
  }

  _initTileCompressionPlugin() {
    const tileCompressionPlugin = new TileCompressionPlugin();
    this.tilesRenderer.registerPlugin(tileCompressionPlugin);
    return tileCompressionPlugin;
  }

  _initUpdateOnChangePlugin() {
    const updateOnChangePlugin = new UpdateOnChangePlugin();
    this.tilesRenderer.registerPlugin(updateOnChangePlugin);
    return updateOnChangePlugin;
  }

  _initTilesFadePlugin() {
    const tilesFadePlugin = new TilesFadePlugin();
    this.tilesRenderer.registerPlugin(tilesFadePlugin);
    return tilesFadePlugin;
  }

  _initTileCreasedNormalsPlugin() {
    const tileCreasedNormalsPlugin = new TileCreasedNormalsPlugin({
      creaseAngle: radians(30),
    });
    this.tilesRenderer.registerPlugin(tileCreasedNormalsPlugin);
    return tileCreasedNormalsPlugin;
  }

  _initTileMaterialReplacementPlugin() {
    const tileMaterialReplacementPlugin = new TileMaterialReplacementPlugin(MeshLambertNodeMaterial);
    this.tilesRenderer.registerPlugin(tileMaterialReplacementPlugin);
    return tileMaterialReplacementPlugin;
  }

  _initReorientationPlugin() {
    const reorientationPlugin = new ReorientationPlugin();
    this.tilesRenderer.registerPlugin(reorientationPlugin);
    return reorientationPlugin;
  }
}

export { Globe };
