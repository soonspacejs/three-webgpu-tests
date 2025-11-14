import { useEffect, useMemo, type RefObject } from 'react';
import { AgXToneMapping, NoToneMapping, Vector3 } from 'three/webgpu';
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

import { useViewer, useModel2 } from '@/hooks';
import { Globe } from '@/libs';

const longitude = 120.002982,
  latitude = 30.284658,
  height = 8.4;

const geodetic = new Geodetic();
const position = new Vector3();
const date = new Date();
date.setHours(15.5);

const camer_poition = {
  x: 91.32403953927673,
  y: 84.80716984979425,
  z: 776.9649691471615,
};
const camera_target = {
  x: 10.159808653396547,
  y: 84.8071698497942,
  z: 17.369087952880744,
};

export const useScene = (elRef: RefObject<HTMLElement | null>) => {
  const viewer = useViewer(elRef);

  useModel2(viewer);

  // override viewer settings

  useEffect(() => {
    if (viewer) {
      const { camera, renderer, controls } = viewer;
      camera.near = 1;
      camera.far = 1e10;
      camera.updateProjectionMatrix();
      renderer.toneMapping = NoToneMapping;
      renderer.toneMappingExposure = 1;
      controls.maxPolarAngle = Math.PI / 2;
      controls.setPosition(camer_poition.x, camer_poition.y, camer_poition.z);
      controls.setTarget(camera_target.x, camera_target.y, camera_target.z);
    }
  }, [viewer]);

  // globe and tiles renderer

  const globe = useMemo(() => new Globe(), []);

  // set camera and resolution
  useEffect(() => {
    if (viewer) {
      const { camera, renderer } = viewer;
      globe.tilesRenderer.setCamera(camera);
      globe.tilesRenderer.setResolutionFromRenderer(camera, renderer as never);
    }
  }, [viewer, globe]);

  // set longitude, latitude, height
  useEffect(() => {
    const loadTilesHandle = () => {
      globe.reorientationPlugin.transformLatLonHeightToOrigin(radians(latitude), radians(longitude), height);
    };
    loadTilesHandle();
    globe.tilesRenderer.addEventListener('load-tile-set', loadTilesHandle);
    return () => {
      globe.tilesRenderer.removeEventListener('load-tile-set', loadTilesHandle);
    };
  }, [globe]);

  // update tiles renderer
  useEffect(() => {
    if (viewer) {
      const { scene, camera } = viewer;

      const update = () => {
        camera.updateMatrixWorld();
        globe.tilesRenderer.update();
      };
      viewer.addEventListener('beforeRender', update);
      scene.add(globe.tilesRenderer.group);

      return () => {
        viewer.removeEventListener('beforeRender', update);
        scene.remove(globe.tilesRenderer.group);
      };
    }
  }, [viewer, globe]);

  // atmosphere context and environment

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
      const toneMappingNode = toneMapping(AgXToneMapping, uniform(8), lensFlareNode);
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
