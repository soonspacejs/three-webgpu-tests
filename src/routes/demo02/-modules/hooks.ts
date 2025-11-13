import { useEffect, useMemo, type RefObject } from 'react';
import { AgXToneMapping, Vector3 } from 'three/webgpu';
import { mrt, output, pass, toneMapping, uniform } from 'three/tsl';
import { getECIToECEFRotationMatrix, getMoonDirectionECI, getSunDirectionECI } from '@takram/three-atmosphere';
import {
  AtmosphereLightNode,
  AtmosphereLight,
  AtmosphereContextNode,
  skyEnvironment,
  aerialPerspective,
} from '@takram/three-atmosphere/webgpu';
import { Ellipsoid, Geodetic, radians } from '@takram/three-geospatial';
import { dithering, highpVelocity, lensFlare, temporalAntialias } from '@takram/three-geospatial/webgpu';

import { useViewer, useModel } from '@/hooks';

const longitude = 120,
  latitude = 30,
  height = 100;

const geodetic = new Geodetic();
const position = new Vector3();
const date = new Date();
date.setHours(10);

export const useScene = (elRef: RefObject<HTMLElement | null>) => {
  const viewer = useViewer(elRef);

  useModel(viewer);

  const context = useMemo(() => new AtmosphereContextNode(), []);
  const envNode = useMemo(() => skyEnvironment(context), [context]);

  // init lights
  useEffect(() => {
    if (viewer) {
      const { renderer } = viewer;
      renderer.library.addLight(AtmosphereLightNode, AtmosphereLight);
    }
  }, [viewer]);

  // add light
  useEffect(() => {
    if (viewer) {
      const { scene } = viewer;
      const light = new AtmosphereLight(context, 80);
      light.castShadow = true;
      light.target.position.set(22, 0, -12);
      light.shadow.normalBias = 0.1;
      light.shadow.mapSize.width = 1024 * 4;
      light.shadow.mapSize.height = 1024 * 4;
      light.shadow.camera.near = 1;
      light.shadow.camera.far = 500;
      light.shadow.camera.left = -60;
      light.shadow.camera.bottom = -60;
      light.shadow.camera.right = 60;
      light.shadow.camera.top = 60;
      scene.add(light);
      scene.add(light.target);

      return () => {
        scene.remove(light);
        scene.remove(light.target);
      };
    }
  }, [viewer, context]);

  // update context camera
  useEffect(() => {
    if (viewer) {
      const { camera } = viewer;
      context.camera = camera;
    }
  }, [viewer, context]);

  // update context matrices
  useEffect(() => {
    const { matrixWorldToECEF, matrixECIToECEF, sunDirectionECEF, moonDirectionECEF } = context;

    // matrixWorldToECEF
    Ellipsoid.WGS84.getNorthUpEastFrame(
      geodetic.set(radians(longitude), radians(latitude), height).toECEF(position),
      matrixWorldToECEF.value
    );

    //   - matrixECIToECEF: For the stars
    //   - sunDirectionECEF: For the sun
    //   - moonDirectionECEF: For the moon
    getECIToECEFRotationMatrix(date, matrixECIToECEF.value);
    getSunDirectionECI(date, sunDirectionECEF.value).applyMatrix4(matrixECIToECEF.value);
    getMoonDirectionECI(date, moonDirectionECEF.value).applyMatrix4(matrixECIToECEF.value);
  }, [context]);

  // update environment
  useEffect(() => {
    if (viewer) {
      const { scene } = viewer;
      scene.environmentNode = envNode;
    }
  }, [envNode, viewer]);

  // post processing
  useEffect(() => {
    if (viewer) {
      const { scene, camera, postProcessing } = viewer;

      const passNode = pass(scene, camera, { samples: 0 }).setMRT(
        mrt({
          output,
          velocity: highpVelocity,
        })
      );
      const colorNode = passNode.getTextureNode('output');
      const depthNode = passNode.getTextureNode('depth');
      const velocityNode = passNode.getTextureNode('velocity');

      const aerialNode = aerialPerspective(context, colorNode, depthNode);
      const lensFlareNode = lensFlare(aerialNode);
      const toneMappingNode = toneMapping(AgXToneMapping, uniform(4), lensFlareNode);
      const taaNode = temporalAntialias(highpVelocity)(toneMappingNode, depthNode, velocityNode, camera);
      postProcessing.outputNode = taaNode.add(dithering);
      postProcessing.needsUpdate = true;

      return () => {
        passNode.dispose();
        aerialNode.dispose();
        lensFlareNode.dispose();
        toneMappingNode.dispose();
        taaNode.dispose();
      };
    }
  }, [viewer, context]);

  // dispose things
  useEffect(() => {
    return () => {
      context.dispose();
    };
  }, [context]);
  useEffect(() => {
    return () => {
      envNode.dispose();
    };
  }, [envNode]);
};
