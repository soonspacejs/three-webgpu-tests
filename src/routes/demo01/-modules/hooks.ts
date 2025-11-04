import { useEffect, type RefObject } from 'react';
import {
  EquirectangularReflectionMapping,
  Group,
  Matrix4,
  Mesh,
  NearestFilter,
  Object3D,
  UnsignedByteType,
  Vector3,
} from 'three/webgpu';
import {
  pass,
  mrt,
  output,
  normalView,
  velocity,
  add,
  vec4,
  directionToColor,
  colorToDirection,
  sample,
  vec2,
  metalness,
  roughness,
  blendColor,
} from 'three/tsl';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { HDRLoader, GLTFLoader, DRACOLoader } from 'three/addons/Addons.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import { useViewer } from '@/hooks';

const robotToThreeMatrix = new Matrix4().makeBasis(
  new Vector3(1, 0, 0), // X axis
  new Vector3(0, 0, -1), // Y axis
  new Vector3(0, 1, 0) // Z axis
);

export const useScene = (elRef: RefObject<HTMLElement | null>) => {
  const viewer = useViewer(elRef);

  // hdr
  useEffect(() => {
    if (viewer) {
      const { scene } = viewer;

      const loader = new HDRLoader();

      loader.load('/textures/qwantani_dusk_2_puresky_1k.hdr', (texture) => {
        texture.mapping = EquirectangularReflectionMapping;
        scene.environment = texture;
        scene.background = texture;
      });
    }
  }, [viewer]);

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

  // ssgi
  useEffect(() => {
    if (viewer) {
      const { scene, camera, postProcessing, inspector } = viewer;

      const scenePass = pass(scene, camera, {
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        samples: 0,
      });
      scenePass.setMRT(
        mrt({
          output: output,
          normal: directionToColor(normalView),
          metalrough: vec2(metalness, roughness),
          velocity: velocity,
        })
      );

      const scenePassColor = scenePass.getTextureNode('output');
      const scenePassNormal = scenePass.getTextureNode('normal');
      const scenePassDepth = scenePass.getTextureNode('depth');
      const scenePassVelocity = scenePass.getTextureNode('velocity');
      const scenePassMetalRough = scenePass.getTextureNode('metalrough');

      const normalTexture = scenePass.getTexture('normal');
      normalTexture.type = UnsignedByteType;

      const sceneNormal = sample((uv) => colorToDirection(scenePassNormal.sample(uv)));

      const ssrPass = ssr(scenePassColor, scenePassDepth, sceneNormal, scenePassMetalRough.r, scenePassMetalRough.g);
      ssrPass.maxDistance.value = 10;
      ssrPass.blurQuality.value = 1;
      ssrPass.thickness.value = 0.15;
      ssrPass.resolutionScale = 1;

      const bloomPass = bloom(scenePassColor, 0.05, 0.8, 0.99);
      const ssgiPass = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera);
      ssgiPass.sliceCount.value = 2;
      ssgiPass.stepCount.value = 8;
      ssgiPass.giIntensity.value = 4;
      ssgiPass.aoIntensity.value = 0.8;

      // Extract GI and AO from SSGI (following example)
      const _gi = ssgiPass.rgb;
      const _ao = ssgiPass.a;
      // Composite: sceneColor * AO + diffuseColor * GI (following example)
      const finalColor = vec4(add(scenePassColor.rgb.mul(_ao), scenePassColor.rgb.mul(_gi)), scenePassColor.a);
      const blendPassBloom = finalColor.add(bloomPass);
      const compositePass = blendColor(blendPassBloom, ssrPass);

      // Apply TRAA (Temporal Reprojection Anti-Aliasing) - following example
      const traaPass = traa(compositePass, scenePassDepth, scenePassVelocity, camera);
      postProcessing.outputNode = traaPass;
      postProcessing.needsUpdate = true;

      // gui

      const gui = inspector.createParameters('Settings');

      const effectsFolder = gui.addFolder('Effects');

      const params = {
        enabled: true,
      };

      effectsFolder
        .add(params, 'enabled')
        .name('Effects Enabled')
        .onChange((v) => {
          if (v) {
            postProcessing.outputNode = traaPass;
          } else {
            postProcessing.outputNode = scenePass;
          }
          postProcessing.needsUpdate = true;
        });

      return () => {
        scenePass.dispose();
        ssrPass.dispose();
        bloomPass.dispose();
        ssgiPass.dispose();
        compositePass.dispose();
        traaPass.dispose();
      };
    }
  }, [viewer]);
};
