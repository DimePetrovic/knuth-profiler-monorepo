/**
 * Seedovan generator pseudoslučajnih brojeva (mulberry32).
 *
 * Isto seme daje isti niz, pa se svaki broj iz evaluacije može ponoviti.
 * Nije kriptografski i ne treba da bude — jedini zahtev je ponovljivost.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ceo broj iz [min, max]. */
export function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Nasumičan element niza. Niz ne sme biti prazan. */
export function randomOf<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.min(Math.floor(rng() * items.length), items.length - 1)];
}
