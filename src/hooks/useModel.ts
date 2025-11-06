import { useEffect } from 'react';
import { Object3D, Group, Mesh, Matrix4, Vector3 } from 'three/webgpu';
import { GLTFLoader, DRACOLoader } from 'three/addons/Addons.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import type { Viewer } from '@/u-space';

const robotToThreeMatrix = new Matrix4().makeBasis(
  new Vector3(1, 0, 0), // X axis
  new Vector3(0, 0, -1), // Y axis
  new Vector3(0, 1, 0) // Z axis
);

function useModel(viewer: Viewer | null) {
  // load model
  useEffect(() => {
    if (viewer) {
      const { scene, controls } = viewer;

      const modelSet = new Set<Object3D>();

      const robotGroup = new Group();
      robotGroup.name = 'robotGroup';
      robotGroup.applyMatrix4(robotToThreeMatrix);
      robotGroup.position.set(22, 0, -12);
      scene.add(robotGroup);

      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('/draco/');
      loader.setDRACOLoader(dracoLoader);
      loader.setMeshoptDecoder(MeshoptDecoder);
      // building
      loader.load('/models/F4.glb', (gltf) => {
        gltf.scene.traverse((child) => {
          if (child instanceof Mesh) {
            child.material.roughness = 1;
            child.material.metalness = 0;

            if (child.name === '网格002') {
              child.material.roughness = 0;
              child.material.metalness = 0.4;
            }
          }
        });
        modelSet.add(gltf.scene);
        scene.add(gltf.scene);
      });
      // robot
      loader.load('/models/g1-opt.glb', (gltf) => {
        modelSet.add(gltf.scene);
        robotGroup.add(gltf.scene);
        gltf.scene.position.set(0, 0, 0.8);
        controls.fitToBox(gltf.scene, true);
      });
      loader.load('/models/x30-opt.glb', (gltf) => {
        modelSet.add(gltf.scene);
        robotGroup.add(gltf.scene);
        gltf.scene.position.set(0, -1, 0.66);
      });
      loader.load('/models/go2-opt.glb', (gltf) => {
        modelSet.add(gltf.scene);
        robotGroup.add(gltf.scene);
        gltf.scene.position.set(0, 1, 0.46);
      });

      return () => {
        robotGroup.removeFromParent();
        modelSet.forEach((m) => m.removeFromParent());
        modelSet.clear();
        dracoLoader.dispose();
      };
    }
  }, [viewer]);
}

export { useModel };
