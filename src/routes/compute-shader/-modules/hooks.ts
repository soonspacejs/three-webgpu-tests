import { useEffect, useMemo, type RefObject } from 'react';
import { AdditiveBlending, Sprite, SpriteNodeMaterial } from 'three/webgpu';
import { instancedArray, instanceIndex, code, wgslFn, Fn, uv } from 'three/tsl';

import { useViewer } from '@/hooks';

const COUNT = 3 * 1e4;

export const useScene = (elRef: RefObject<HTMLElement | null>) => {
  const viewer = useViewer(elRef);

  const { nodes } = useMemo(() => {
    const spawnPositionsBuffer = instancedArray(COUNT, 'vec3');
    const offsetPositionsBuffer = instancedArray(COUNT, 'vec3');

    const spawnPosition = spawnPositionsBuffer.element(instanceIndex);
    const offsetPosition = offsetPositionsBuffer.element(instanceIndex);

    const hash = code(`
      fn hash(index: u32) -> f32 {
        return fract(sin(f32(index) * 12.9898) * 43758.5453);
      }
    `);

    const thomasAttractor = wgslFn(`
      fn thomasAttractor(pos: vec3<f32>) -> vec3<f32> {
        let b = 0.19;

        let dt = 0.015;

        let x = pos.x;
        let y = pos.y;
        let z = pos.z;

        let dx = (-b * x + sin(y)) * dt;
        let dy = (-b * y + sin(z)) * dt;
        let dz = (-b * z + sin(x)) * dt;

        return vec3(dx, dy, dz);
      }
      `);

    const computeInitWgsl = wgslFn(
      `
      fn computeInit(
        spawnPositions: ptr<storage, array<vec3f>, read_write>,
        offsetPositions: ptr<storage, array<vec3f>, read_write>,
        index: u32
      ) -> void {
        let h0 = hash(index);
        let h1 = hash(index + 1u);
        let h2 = hash(index + 2u);
        
        let distance = sqrt(h0 * 4.0);
        let theta = h1 * 6.28318530718; // 2 * PI
        let phi = h2 * 3.14159265359; // PI
        
        let x = distance * sin(phi) * cos(theta);
        let y = distance * sin(phi) * sin(theta);
        let z = distance * cos(phi);
        
        spawnPositions[index] = vec3f(x, y, z);
        offsetPositions[index] = vec3f(0.0);
      }
    `,
      [hash]
    );

    const computeNode = computeInitWgsl({
      spawnPositions: spawnPositionsBuffer,
      offsetPositions: offsetPositionsBuffer,
      index: instanceIndex,
    }).compute(COUNT);

    const computeNodeUpdate = Fn(() => {
      const updatedOffsetPosition = thomasAttractor({
        pos: spawnPosition.add(offsetPosition),
      });
      offsetPosition.addAssign(updatedOffsetPosition);
    })().compute(COUNT);

    const scaleNode = wgslFn(
      `
      fn scaleNode() -> f32 {
        return randValue(0.01, 0.04, 3u);
      }
    
      fn randValue(min: f32, max: f32, seed: u32) -> f32 {
        return hash(seed) * (max - min) + min;
      }
    `,
      [hash]
    )();

    const positionNode = Fn(() => {
      const pos = spawnPosition.add(offsetPosition);
      return pos;
    })();

    const particleColor = wgslFn(`
      fn colorNode(
        spawnPos: vec3f,
        offsetPos: vec3f,
        uvCoord: vec2f
      ) -> vec4f {
        let color = vec3f(0.24, 0.43, 0.96);
        let distanceToCenter = min(
          distance(spawnPos + offsetPos, vec3f(0.0, 0.0, 0.0)),
          2.75
        );
        
        let strength = distance(uvCoord, vec2f(0.5));
        
        let distColor = mix(
          vec3f(0.97, 0.7, 0.45),
          color,
          distanceToCenter * 0.4
        );
        
        let fillMask = 1.0 - strength * 2.0;
        let finalColor = mix(vec3f(0.0), distColor, fillMask);
        
        let circle = smoothstep(0.5, 0.49, strength);
        return vec4f(finalColor * circle, 1.0);
      }
    `);

    const colorNode = particleColor({
      spawnPos: spawnPosition,
      offsetPos: offsetPosition,
      uvCoord: uv(),
    });

    return {
      nodes: {
        positionNode,
        computeNode,
        computeNodeUpdate,
        colorNode,
        scaleNode,
      },
      uniforms: {},
      utils: {},
    };
  }, []);

  // init compute node
  useEffect(() => {
    if (viewer) {
      const { renderer } = viewer;
      renderer.computeAsync(nodes.computeNode);
    }
  }, [viewer, nodes]);

  // update compute node
  useEffect(() => {
    if (viewer) {
      const { renderer } = viewer;

      const update = () => {
        renderer.compute(nodes.computeNodeUpdate);
      };

      viewer.addEventListener('beforeRender', update);

      return () => {
        viewer.removeEventListener('beforeRender', update);
      };
    }
  }, [viewer, nodes]);

  // sprite object
  useEffect(() => {
    if (viewer) {
      const { scene } = viewer;

      const sprite = new Sprite();
      sprite.count = COUNT;
      const material = new SpriteNodeMaterial({
        colorNode: nodes.colorNode,
        positionNode: nodes.positionNode,
        scaleNode: nodes.scaleNode,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      sprite.material = material;

      scene.add(sprite);

      return () => {
        sprite.geometry.dispose();
        sprite.material.dispose();
        scene.remove(sprite);
      };
    }
  }, [viewer, nodes]);
};
