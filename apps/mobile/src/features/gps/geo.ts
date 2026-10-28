// Cálculos sobre los puntos del GPS: distancia, desnivel, ritmo actual,
// simplificación de la ruta y formato polyline (el de Google, precisión 5).
// Sin dependencias para poder probarlo en Node.

export type GpsPoint = {
  lat: number;
  lng: number;
  /** Altitud en metros (null si el teléfono no la da). */
  alt: number | null;
  /** Instante en ms. */
  t: number;
  /** Tramo: sube al reanudar tras una pausa (no se suma la distancia entre tramos). */
  seg: number;
};

export type LatLng = [number, number];

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distancia en metros entre dos puntos (haversine). */
export function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distancia y desnivel positivo. El desnivel usa histéresis de 4 m: la
 * altitud del GPS oscila unos metros y sumar cada subida inflaría el total.
 */
export function summarize(points: GpsPoint[]): { distance_m: number; elevation_m: number } {
  let distance = 0;
  let gain = 0;
  let ref: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    if (prev && prev.seg === p.seg) distance += haversine(prev.lat, prev.lng, p.lat, p.lng);
    if (p.alt != null) {
      if (ref == null || (prev && prev.seg !== p.seg)) ref = p.alt;
      else if (p.alt > ref + 4) {
        gain += p.alt - ref;
        ref = p.alt;
      } else if (p.alt < ref - 4) ref = p.alt;
    }
  }
  return { distance_m: Math.round(distance), elevation_m: Math.round(gain) };
}

/** Ritmo de los últimos `windowMs` (s/km), o null si no hay datos suficientes. */
export function currentPace(points: GpsPoint[], now: number, windowMs = 30000): number | null {
  const recent = points.filter((p) => p.t >= now - windowMs);
  if (recent.length < 2) return null;
  let d = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].seg === recent[i - 1].seg) d += haversine(recent[i - 1].lat, recent[i - 1].lng, recent[i].lat, recent[i].lng);
  }
  const secs = (recent[recent.length - 1].t - recent[0].t) / 1000;
  if (d < 20 || secs <= 0) return null;
  return secs / (d / 1000);
}

/** Proyección local en metros (suficiente para rutas de decenas de km). */
function project(points: LatLng[]): { x: number; y: number }[] {
  const lat0 = points.reduce((s, p) => s + p[0], 0) / points.length;
  const k = Math.cos(rad(lat0));
  return points.map(([lat, lng]) => ({ x: rad(lng) * R * k, y: rad(lat) * R }));
}

/** Douglas-Peucker con tolerancia en metros. */
export function simplify(points: LatLng[], tolerance: number): LatLng[] {
  if (points.length <= 2) return points;
  const xy = project(points);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = xy[a].x, ay = xy[a].y, bx = xy[b].x, by = xy[b].y;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      let t = len2 ? ((xy[i].x - ax) * dx + (xy[i].y - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(xy[i].x - (ax + t * dx), xy[i].y - (ay + t * dy));
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tolerance && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Quita los primeros y últimos `meters` del recorrido para no mostrar dónde
 * vive el socio (como las "zonas privadas" de Strava). Solo afecta el dibujo.
 */
export function trimEnds(points: LatLng[], meters: number): LatLng[] {
  if (points.length < 3) return points;
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  if (total < meters * 4) return points;
  let start = 0, acc = 0;
  while (start < points.length - 1 && acc < meters) {
    acc += haversine(points[start][0], points[start][1], points[start + 1][0], points[start + 1][1]);
    start++;
  }
  let end = points.length - 1;
  acc = 0;
  while (end > start && acc < meters) {
    acc += haversine(points[end][0], points[end][1], points[end - 1][0], points[end - 1][1]);
    end--;
  }
  return points.slice(start, end + 1);
}

function encodeValue(v: number): string {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let out = '';
  while (n >= 0x20) {
    out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return out + String.fromCharCode(n + 63);
}

export function encodePolyline(points: LatLng[]): string {
  let lastLat = 0, lastLng = 0, out = '';
  for (const [lat, lng] of points) {
    const la = Math.round(lat * 1e5), ln = Math.round(lng * 1e5);
    out += encodeValue(la - lastLat) + encodeValue(ln - lastLng);
    lastLat = la;
    lastLng = ln;
  }
  return out;
}

export function decodePolyline(str: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0, lat = 0, lng = 0;
  const next = () => {
    let result = 0, shift = 0, b: number;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lng += next();
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

/** La ruta que se guarda: sin los extremos, simplificada y de tamaño acotado. */
export function routeForStorage(points: GpsPoint[]): string | null {
  const raw: LatLng[] = points.map((p) => [p.lat, p.lng]);
  if (raw.length < 2) return null;
  const trimmed = trimEnds(raw, 200);
  for (const tol of [4, 8, 15, 30, 60]) {
    const enc = encodePolyline(simplify(trimmed, tol));
    if (enc.length <= 50000) return enc;
  }
  return null;
}
