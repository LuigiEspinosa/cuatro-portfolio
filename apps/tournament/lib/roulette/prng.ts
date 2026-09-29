/**
 * The deterministic, integer-only PRNG — browser VERIFIER side (Story 6.3, FR-25 / AD-14 /
 * SOLUTION-DESIGN §9.1).
 *
 *   seed        = 32 raw bytes            # hex-decoded from seed_hex (lowercase, 64 chars)
 *   block(i, L) = HMAC_SHA256(key = seed, msg = utf8(L) || LE64(i))     # 32 bytes, i from 0
 *   stream(L)   = block(0,L) || block(1,L) || block(2,L) || …           # consumed left-to-right
 *
 *   uniform_int(stream, n):
 *       k     = minimal integer with 256^k >= n        # n=1 -> k=0  (E1)
 *       limit = 256^k - (256^k mod n)
 *       loop:
 *           x = big-endian integer from the next k bytes of stream     # bytes are CONSUMED
 *           if x >= limit: continue                                    # rejected bytes are GONE
 *           return x mod n
 *
 * ⛔ NO `import 'server-only'` — see the note in `labels.ts`. Pinned by a source scan in
 * `prng.test.ts`.
 *
 * ⛔ NO `node:crypto`. `lib/steam/nonce.ts`'s `createHmac` is the wrong model here on two counts:
 * `node:crypto` does not exist in a browser, and a suite that exercises `createHmac` while the
 * browser runs SubtleCrypto is testing a DIFFERENT IMPLEMENTATION than the one that ships. Node
 * >= 20.9 exposes the same global `crypto.subtle` under Vitest's `node` environment, so one code
 * path serves both the test and the browser. This is why the API is ASYNC: `crypto.subtle.sign`
 * returns a Promise, and 6.4/6.6/6.7 will `await` it. Do not hand-roll SHA-256 to fake a sync API.
 *
 * THE SEAM: this module conforms to `roulette/vectors/`, never to `worker/awards`. When the two
 * disagree the vector decides; when the vector is silent, add a vector.
 */

/**
 * A `Uint8Array` backed by a plain `ArrayBuffer`.
 *
 * Since TypeScript 5.7 `Uint8Array` is generic over its backing buffer and defaults to
 * `ArrayBufferLike`, which includes `SharedArrayBuffer` — and WebCrypto's `BufferSource` does
 * not accept that. So every byte array that reaches `crypto.subtle` is typed here. Note that
 * `npm test` does NOT typecheck; only `npm run build` catches this, which is where it surfaced.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

/** The raw HMAC key length. The key is the 32 DECODED bytes, never the 64-char hex string. */
export const SEED_BYTES = 32;

/** HMAC-SHA256 output width, and therefore the stride at which the block counter advances. */
const BLOCK_BYTES = 32;

/**
 * The inclusive bounds on `uniformInt`'s `n` (E2 / DECISION C).
 *
 * `Object.freeze` is SHALLOW — 6.1 shipped a "frozen" catalog of mutable entries on exactly that
 * mistake. One call suffices here only because every leaf is a primitive, and the test asserts
 * that rather than assuming it. Do not add a nested object to this without deep-freezing.
 *
 * Nothing in the engine approaches the maximum — the largest real `n` is a Stage-1 total weight
 * (<= 12 awards x weight 100 = 1200) or a candidate count (<= 16 players). The bound keeps
 * `k <= 4`, which is what makes the `Number` return below always exact and deletes the
 * `256^8 = 2^64` overflow class entirely. It changes no reachable outcome; it converts an
 * unreachable overflow into a loud error.
 */
export const N_BOUNDS: Readonly<{ MIN: number; MAX: number }> = Object.freeze({
  MIN: 1,
  // Written as a literal, not `2 ** 32`: the exponent operator is banned in this module (it is
  // float-valued in general) and the pinning test enforces that.
  MAX: 4294967296,
});

/** `^[0-9a-f]{64}$` — the same shape `tournament_fair_seed_hex` enforces at the database. */
const SEED_HEX_RE = /^[0-9a-f]{64}$/;

/**
 * Caps a single {@link Stream.read}. Nothing in the engine reads more than 4 bytes at a time
 * (`k <= 4` by {@link N_BOUNDS}), so this is far above any real call. It exists because `read` is
 * exported and an unbounded `k` is an allocation that hangs rather than the loud refusal every
 * other programmer error here gets — measured at the 6.3 review: `read(2**31)` never returned.
 */
export const MAX_READ_BYTES = 4096;

/** Brand proving a {@link Stream} came from {@link createStream}. Never exported. */
const STREAM_BRAND = Symbol('roulette.Stream');

/** Nibble table for {@link decodeSeedHex} — see the note there on why not `parseInt`. */
const HEX_NIBBLE: Readonly<Record<string, number>> = Object.freeze({
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, a: 10, b: 11, c: 12, d: 13, e: 14, f: 15,
});

/**
 * Streams with a draw in flight. {@link Stream.read} guards a single read; this guards a whole
 * {@link uniformInt} draw, which spans several reads when a rejection loops — without it, two
 * overlapping draws could interleave between reads and slip past the per-read guard.
 */
const DRAWING = new WeakSet<Stream>();

/**
 * Decode a 64-character LOWERCASE hex seed into the raw 32-byte HMAC key (E4).
 *
 * Uppercase hex, a `0x` prefix, surrounding whitespace, or any other length THROWS — it is never
 * a best-effort decode. A 31-byte key silently produces a perfectly valid-looking, completely
 * different stream, and there is no later symptom to catch it by.
 */
export function decodeSeedHex(seedHex: string): Bytes {
  if (typeof seedHex !== 'string' || !SEED_HEX_RE.test(seedHex)) {
    throw new TypeError(
      `roulette: seed_hex must match ^[0-9a-f]{64}$ (64 lowercase hex chars), got ${JSON.stringify(seedHex)}`,
    );
  }
  const out: Bytes = new Uint8Array(SEED_BYTES);
  for (let i = 0; i < SEED_BYTES; i++) {
    // Decoded nibble by nibble rather than with parseInt, which is banned here: it accepts
    // leading whitespace, stops at the first invalid character instead of failing, and is the
    // exact "best-effort decode" this function refuses to be. The regex above has already
    // guaranteed every character is [0-9a-f], so this is total.
    out[i] = HEX_NIBBLE[seedHex[i * 2] as string]! * 16 + HEX_NIBBLE[seedHex[i * 2 + 1] as string]!;
  }
  return out;
}

/**
 * One domain-separated byte stream: the concatenation `block_0 || block_1 || …` for a single
 * label, consumed left-to-right. Each decision owns its own stream — that is what the
 * per-decision labels are for.
 */
export class Stream {
  /**
   * The label, held privately so it cannot be reassigned at runtime.
   *
   * `readonly` is a compile-time-only annotation and is erased in the emitted JS — the 6.3 code
   * review measured `Object.getOwnPropertyDescriptor(stream, 'label')` returning
   * `{writable: true}`, so `stream.label = '…'` silently made the reported label disagree with
   * the bytes actually drawn (which come from `#labelBytes`, captured in the constructor). Go's
   * `Label()` over an unexported field cannot be made to lie; now neither can this.
   */
  readonly #label: string;

  /** The cumulative byte position — the stream's entire state. Everything else is cache. */
  #pos = 0;

  readonly #key: CryptoKey;
  readonly #labelBytes: Bytes;

  /** One materialized block, so a 32-byte block is not re-signed once per byte. */
  #cached: Bytes | null = null;
  #cachedIndex = -1;

  /**
   * Set for the duration of a `read`. See {@link read} — this is the reentrancy guard, not a
   * performance flag.
   */
  #reading = false;

  /**
   * ⛔ Not constructible from outside this module — use {@link createStream}.
   *
   * The class is exported because callers need the TYPE, but the 6.3 code review measured E4
   * reachable straight through this constructor: `new Stream(<31-byte HMAC key>, label)` was
   * accepted and produced a valid-looking, completely different stream, bypassing every check in
   * `createStream`. Go's equivalent is structurally impossible (`NewStream(seed [32]byte, …)`).
   * The brand restores that: only this module holds the symbol.
   */
  constructor(brand: symbol, key: CryptoKey, label: string) {
    if (brand !== STREAM_BRAND) {
      throw new TypeError('roulette: Stream is not constructible directly — use createStream()');
    }
    this.#key = key;
    this.#label = label;
    this.#labelBytes = new TextEncoder().encode(label);
  }

  /** The domain separator this stream was opened with (diagnostics only). */
  get label(): string {
    return this.#label;
  }

  /**
   * The cumulative byte position.
   *
   * ⭐ This exists so "the two runtimes consume identical bytes" is TESTABLE — AC2 cannot be
   * asserted without it, and a rejection is observable from outside only as `consumed` advancing
   * by more than `k`. It is not decorative.
   */
  get consumed(): number {
    return this.#pos;
  }

  /**
   * `block_i = HMAC_SHA256(key = seed, msg = utf8(label) || LE64(i))`.
   *
   * `LE64` is an 8-byte LITTLE-endian counter and is the ONLY little-endian construct in the
   * whole engine — the byte assembly in {@link uniformInt} is big-endian. The `true` below is
   * that little-endian flag. Getting it backwards leaves block 0 correct (counter 0 is all zero
   * bytes either way) and every later block wrong, which is why the vectors carry an `i = 1`
   * case for every label.
   */
  async #block(index: number): Promise<Bytes> {
    if (this.#cached !== null && this.#cachedIndex === index) return this.#cached;

    const msg: Bytes = new Uint8Array(this.#labelBytes.length + 8);
    msg.set(this.#labelBytes, 0);
    new DataView(msg.buffer).setBigUint64(this.#labelBytes.length, BigInt(index), true);

    const sig = await crypto.subtle.sign('HMAC', this.#key, msg);
    const block: Bytes = new Uint8Array(sig);

    this.#cached = block;
    this.#cachedIndex = index;
    return block;
  }

  /**
   * Consume and return the next `k` bytes.
   *
   * E3 — the stream is a BYTE stream over the block concatenation, so a read STRADDLES block
   * boundaries: a 2-byte read beginning at byte 31 takes byte 31 of block 0 and byte 0 of
   * block 1. Consumed bytes are never put back, including the bytes of a rejected draw.
   *
   * `k = 0` is legal and consumes nothing — that is E1's path.
   */
  async read(k: number): Promise<Bytes> {
    if (!Number.isInteger(k) || k < 0) {
      throw new RangeError(`roulette: read(k) requires a non-negative integer k, got ${String(k)}`);
    }
    if (k > MAX_READ_BYTES) {
      throw new RangeError(`roulette: read(k) requires k <= ${MAX_READ_BYTES}, got ${String(k)}`);
    }
    // ⛔ REENTRANCY. This method awaits inside the byte loop, so `#pos` is read-modify-written
    // across microtask boundaries. Two overlapping calls on ONE stream interleave and each gets
    // the WRONG bytes — measured at the 6.3 review: after `read(30)`, two concurrent `read(4)`
    // returned de11f26e / 7b537ef2 where the true bytes 30-37 are de7b92537ef2f26e. Byte 32 was
    // never delivered and stream byte 0 was injected.
    //
    // The lethal part is that `consumed` was IDENTICAL (38) in the correct and the corrupt run,
    // so the byte-position assertion the whole vector suite rests on cannot see it. A forgotten
    // `await` does the same thing.
    //
    // This THROWS rather than serialising on purpose (DECISION, 6.3 review). Queueing would make
    // a forgotten `await` silently produce a different-but-valid-looking ceremony ordering, which
    // is exactly the invisible-divergence class this module exists to prevent. Everywhere else in
    // this engine a programmer error is loud; so is this one.
    if (this.#reading) {
      throw new Error(
        'roulette: Stream is not reentrant — await each read/uniformInt before starting the next. ' +
          'Overlapping draws on one stream consume interleaved bytes and silently diverge from the producer.',
      );
    }
    this.#reading = true;
    try {
      const out: Bytes = new Uint8Array(k);
      for (let j = 0; j < k; j++) {
        const block = await this.#block(Math.floor(this.#pos / BLOCK_BYTES));
        out[j] = block[this.#pos % BLOCK_BYTES] as number;
        this.#pos += 1;
      }
      return out;
    } finally {
      this.#reading = false;
    }
  }
}

/**
 * Open the stream for `label`. The HMAC key is imported ONCE here and held for the stream's life
 * — re-importing per block is correct but wasteful. The counter starts at 0 and nothing is
 * computed until the first read: every label is independent and every one starts at block 0.
 */
export async function createStream(seed: Bytes, label: string): Promise<Stream> {
  if (!(seed instanceof Uint8Array) || seed.length !== SEED_BYTES) {
    throw new TypeError(`roulette: seed must be ${SEED_BYTES} raw bytes, got ${String(seed?.length)}`);
  }
  if (typeof label !== 'string' || label.length === 0) {
    throw new TypeError('roulette: label must be a non-empty string');
  }
  // The spec says msg = utf8(label) || LE64(i). A lone surrogate has no UTF-8 encoding, and
  // TextEncoder silently substitutes U+FFFD (EF BF BD) rather than failing — while Go writes the
  // raw bytes verbatim. Measured at the 6.3 review: the same label produced d61f6c62… here and
  // 9e671492… in the producer, with no error on either side. Refuse it in both instead.
  if (!label.isWellFormed()) {
    throw new TypeError(`roulette: label must be well-formed UTF-16/UTF-8, got ${JSON.stringify(label)}`);
  }
  const key = await crypto.subtle.importKey(
    'raw',
    seed,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Stream(STREAM_BRAND, key, label);
}

/**
 * The smallest `k` with `256^k >= n`, together with `256^k`.
 *
 * E1 — for `n = 1` this is `k = 0`: `256^0 = 1 >= 1`, so a one-candidate draw reads NOTHING and
 * returns 0. An implementation that loops from `k = 1` returns the same ANSWER (0) and a
 * different STREAM POSITION, so every subsequent draw in that ceremony differs. It is the
 * highest-value divergence in the engine precisely because it is invisible in the result.
 * Pinned by the `e1-n1-consumes-zero-bytes` vector case.
 *
 * Exported for the test suite only. It was module-private until the 6.3 code review, which found
 * the coverage test asserting against its own inline duplicate of this function — so a bug HERE
 * could not fail it. Go has had a direct `TestMinimalK` over every `k` boundary all along; this
 * makes the mirror possible. Nothing outside the module should call it.
 */
export function minimalK(n: bigint): { k: number; space: bigint } {
  let k = 0;
  let space = 1n;
  while (space < n) {
    space *= 256n;
    k += 1;
  }
  return { k, space };
}

/**
 * Draw an unbiased integer in `[0, n)` from the stream.
 *
 * The rejection is what makes it unbiased: `256^k` is not in general a multiple of `n`, so the
 * top `256^k mod n` values would over-represent the first residues. Those are rejected — and a
 * rejection CONSUMES its `k` bytes and draws `k` FRESH ones. That is the property keeping the Go
 * producer and this verifier byte-position-identical after every draw.
 *
 * Arithmetic is `BigInt` throughout: the assembly stays exact regardless of `k`, and with
 * `n <= 2^32` the returned `Number` is always a safe integer. Never `parseInt`, never `**` on
 * floats, and never `<<` on a Number (that operator is 32-bit and would silently corrupt `k = 4`).
 *
 * E2 — `n` outside `[1, 2^32]`, non-integer, or negative is a PROGRAMMER error: it throws. It is
 * never a silent clamp and never a typed business refusal, because no user input reaches here.
 */
export async function uniformInt(stream: Stream, n: number): Promise<number> {
  if (!Number.isInteger(n) || n < N_BOUNDS.MIN || n > N_BOUNDS.MAX) {
    throw new RangeError(
      `roulette: uniformInt n must be an integer in [${N_BOUNDS.MIN}, ${N_BOUNDS.MAX}], got ${String(n)}`,
    );
  }
  // ⛔ A draw spans several reads when a rejection loops, so the per-read guard inside
  // Stream.read is not enough on its own: two overlapping draws could interleave in the gap
  // between one draw's reads. This claims the stream for the WHOLE draw. See Stream.read for the
  // measured failure and for why this throws instead of queueing.
  if (DRAWING.has(stream)) {
    throw new Error(
      'roulette: Stream is not reentrant — await each uniformInt before starting the next. ' +
        'Overlapping draws on one stream consume interleaved bytes and silently diverge from the producer.',
    );
  }
  DRAWING.add(stream);
  try {
    const bn = BigInt(n);
    const { k, space } = minimalK(bn);
    const limit = space - (space % bn);

    for (;;) {
      const buf = await stream.read(k);
      // Big-endian assembly — the opposite endianness to the LE64 counter above. Multiplication
      // rather than a shift so there is no doubt about width.
      let x = 0n;
      for (const b of buf) x = x * 256n + BigInt(b);

      if (x >= limit) continue; // rejected: those k bytes are GONE, the next pass reads k fresh ones
      return Number(x % bn);
    }
  } finally {
    DRAWING.delete(stream);
  }
}
