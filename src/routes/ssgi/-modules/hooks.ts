import { type RefObject } from 'react';

import { useViewer, useModel, useHDR, useSSGI } from '@/hooks';

export const useScene = (elRef: RefObject<HTMLElement | null>) => {
  const viewer = useViewer(elRef);

  useModel(viewer);

  useHDR(viewer);

  useSSGI(viewer);
};
