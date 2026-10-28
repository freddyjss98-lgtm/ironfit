// Estado de la grabación para la UI: se carga al montar, se actualiza con cada
// lote de puntos y el reloj avanza cada segundo mientras se graba.

import { useEffect, useState } from 'react';

import { getRecording, subscribe, type Recording } from './recorder';

export function useRecording() {
  const [rec, setRec] = useState<Recording | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    getRecording().then((r) => alive && setRec(r));
    const off = subscribe((r) => setRec(r));
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (rec?.status !== 'recording') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [rec?.status]);

  /** undefined mientras carga; null si no hay grabación. */
  return { rec, now };
}
