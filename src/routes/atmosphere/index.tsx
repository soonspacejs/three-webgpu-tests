import { useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router'

import { useScene } from './-modules';

export const Route = createFileRoute('/atmosphere/')({
  component: RouteComponent,
})

function RouteComponent() {
  const elRef = useRef<HTMLDivElement>(null);
 
   useScene(elRef);
 
   return <div ref={elRef} className="w-screen h-screen"></div>;
}
