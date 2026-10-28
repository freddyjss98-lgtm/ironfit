// Dibujo del recorrido (sin mapa de fondo): la línea de la ruta encajada en
// el recuadro, con un punto de inicio y otro de llegada. Sirve en la pantalla
// de grabación, en la comunidad y en la tarjeta sin fondo para Instagram.

import Svg, { Circle, Polyline } from 'react-native-svg';

import { colors } from '@/theme';

import type { LatLng } from './geo';

type Props = {
  points: LatLng[];
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
  /** Contorno oscuro para que la línea se lea encima de cualquier foto. */
  outline?: boolean;
};

export function RouteSvg({ points, width, height, color = colors.accent, strokeWidth = 4, outline = false }: Props) {
  if (points.length < 2) return null;
  const pad = strokeWidth * 2 + 4;
  // Proyección equirectangular: suficiente para rutas de una ciudad.
  const lat0 = points.reduce((s, p) => s + p[0], 0) / points.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p[1] * k);
  const ys = points.map((p) => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9, spanY = maxY - minY || 1e-9;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2, offY = (height - spanY * scale) / 2;
  const pts = xs.map((x, i) => [offX + (x - minX) * scale, offY + (ys[i] - minY) * scale] as const);
  const str = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];

  return (
    <Svg width={width} height={height}>
      {outline && (
        <Polyline points={str} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={strokeWidth + 4} strokeLinecap="round" strokeLinejoin="round" />
      )}
      <Polyline points={str} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={sx} cy={sy} r={strokeWidth + 1} fill="#fff" stroke={color} strokeWidth={2} />
      <Circle cx={ex} cy={ey} r={strokeWidth + 1} fill={color} stroke="#fff" strokeWidth={2} />
    </Svg>
  );
}
