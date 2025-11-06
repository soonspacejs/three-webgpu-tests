import { useEffect } from 'react';
import { NearestFilter, UnsignedByteType } from 'three/webgpu';
import {
  pass,
  mrt,
  output,
  directionToColor,
  normalView,
  vec2,
  metalness,
  roughness,
  velocity,
  sample,
  colorToDirection,
  vec4,
  add,
  blendColor,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';

import type { Viewer } from '@/u-space';

function useSSGI(viewer: Viewer | null) {
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
}

export { useSSGI };
