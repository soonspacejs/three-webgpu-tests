import { useLayoutEffect, useMemo, useState, type RefObject } from 'react';

import { Viewer } from '@/u-space';

declare global {
  interface Window {
    viewer: Viewer;
  }
}

function useViewer(elRef: RefObject<HTMLElement | null>) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [ready, setReady] = useState(false);
  const readyViewer = useMemo(() => (ready ? viewer : null), [ready, viewer]);

  useLayoutEffect(() => {
    if (elRef.current) {
      const viewer = new Viewer({ el: elRef.current });

      setViewer(viewer);

      window.viewer = viewer;

      return () => {
        viewer.dispose();
      };
    }
  }, [elRef]);

  useLayoutEffect(() => {
    if (viewer) {
      viewer.renderer.init().then(() => setReady(true));
    }
  }, [viewer]);

  return readyViewer;
}

export { useViewer };
