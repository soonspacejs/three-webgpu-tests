import { useEffect } from 'react';
import { EquirectangularReflectionMapping } from 'three/webgpu';
import { HDRLoader } from 'three/addons';

import type { Viewer } from '@/u-space';

function useHDR(viewer: Viewer | null) {
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
}

export { useHDR };
