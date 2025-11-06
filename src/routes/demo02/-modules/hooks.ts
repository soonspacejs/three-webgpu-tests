import { useEffect, type RefObject } from 'react';

import { useViewer, useModel } from '@/hooks';

export const useScene = (elRef: RefObject<HTMLElement | null>) => {
  const viewer = useViewer(elRef);

  useModel(viewer);

  useEffect(() => {
    // todo
  }, [viewer]);
};
