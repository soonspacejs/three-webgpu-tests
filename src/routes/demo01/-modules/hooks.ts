import { useEffect, type RefObject } from 'react';
import { GridHelper, UnsignedByteType } from 'three/webgpu';
import {
  pass,
  mrt,
  output,
  normalView,
  diffuseColor,
  velocity,
  add,
  vec4,
  directionToColor,
  colorToDirection,
  sample,
} from 'three/tsl';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';

import { useViewer } from '@/hooks';

export const useScene = (elRef: RefObject<HTMLElement | null>) => {
  const viewer = useViewer(elRef);

  // scene
  useEffect(() => {
    if (viewer) {
      const { scene } = viewer;

      const size = 10;
      const divisions = 10;
      const gridHelper = new GridHelper(size, divisions);
      scene.add(gridHelper);
    }
  }, [viewer]);

  // load model
  useEffect(() => {
    if (viewer) {
      //
    }
  }, [viewer]);

  // ssgi
  useEffect(() => {
    if (viewer) {
      const { scene, camera, postProcessing } = viewer;

      //

      const scenePass = pass(scene, camera, { samples: 0 });
      scenePass.setMRT(
        mrt({
          output: output,
          diffuseColor: diffuseColor,
          normal: directionToColor(normalView),
          velocity: velocity,
        })
      );

      const scenePassColor = scenePass.getTextureNode('output');
      const scenePassDiffuse = scenePass.getTextureNode('diffuseColor');
      const scenePassDepth = scenePass.getTextureNode('depth');

      const scenePassNormal = scenePass.getTextureNode('normal');
      const scenePassVelocity = scenePass.getTextureNode('velocity');

      // bandwidth optimization

      const diffuseTexture = scenePass.getTexture('diffuseColor');
      diffuseTexture.type = UnsignedByteType;

      const normalTexture = scenePass.getTexture('normal');
      normalTexture.type = UnsignedByteType;

      const sceneNormal = sample((uv) => {
        return colorToDirection(scenePassNormal.sample(uv));
      });

      // gi

      const giPass = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera);
      giPass.sliceCount.value = 2;
      giPass.stepCount.value = 0;

      // composite

      const gi = giPass.rgb;
      const ao = giPass.a;

      const compositePass = vec4(add(scenePassColor.rgb.mul(ao), scenePassDiffuse.rgb.mul(gi)), scenePassColor.a);
      compositePass.name = 'Composite';

      // traa

      const traaPass = traa(compositePass, scenePassDepth, scenePassVelocity, camera);
      postProcessing.outputNode = traaPass;

      return () => {
        scenePass.dispose();
        giPass.dispose();
        compositePass.dispose();
        traaPass.dispose();
      };
    }
  }, [viewer]);
};
