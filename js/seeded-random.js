class SeededRandom {
  constructor(seed) {
    this.seed = seed;
    this.state = seed;
  }

  // Mulberry32 - fast, good distribution, deterministic
  next() {
    var t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Convenience: random int in range [min, max)
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  }

  // Convenience: random float in range [min, max)
  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  // Get current seed for serialization
  getSeed() {
    return this.seed;
  }
}
window.SeededRandom = SeededRandom;
