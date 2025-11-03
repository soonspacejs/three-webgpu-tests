import { useLayoutEffect, useState, type RefObject } from 'react';

import { Viewer } from '@/u-space';

function useViewer(elRef: RefObject<HTMLElement | null>) {
  const [viewer, setViewer] = useState<Viewer | null>(null);

  useLayoutEffect(() => {
    if (elRef.current) {
      const viewer = new Viewer({ el: elRef.current });

      setViewer(viewer);

      return () => {
        viewer.dispose();
      };
    }
  }, [elRef]);

  return viewer;
}

export { useViewer };
