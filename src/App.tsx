import { useEffect, useRef } from 'react';
import { createGame } from './game/createGame';
import { Overlay } from './ui/Overlay';

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const game = createGame(ref.current);
    return () => game.destroy(true);
  }, []);
  return (
    <div className="app">
      <div ref={ref} className="game" />
      <Overlay />
    </div>
  );
}
