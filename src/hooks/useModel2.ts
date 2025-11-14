import { useEffect } from 'react';
import { Object3D, Mesh } from 'three/webgpu';
import { GLTFLoader, DRACOLoader } from 'three/addons/Addons.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import type { Viewer } from '@/u-space';

function useModel2(viewer: Viewer | null) {
  // load model
  useEffect(() => {
    if (viewer) {
      const { scene } = viewer;

      const modelSet = new Set<Object3D>();

      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('/draco/');
      loader.setDRACOLoader(dracoLoader);
      loader.setMeshoptDecoder(MeshoptDecoder);
      // building
      loader.load('/models/dingchuang-opt.glb', (gltf) => {
        gltf.scene.traverse((child) => {
          if (child instanceof Mesh) {
            child.receiveShadow = true;
            child.castShadow = true;
          }
        });
        modelSet.add(gltf.scene);
        scene.add(gltf.scene);
      });

      return () => {
        modelSet.forEach((m) => m.removeFromParent());
        modelSet.clear();
        dracoLoader.dispose();
      };
    }
  }, [viewer]);
}

export { useModel2 };
