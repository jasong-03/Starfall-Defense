// Poseidon2 hash using Barretenberg WASM (same implementation as the Noir circuit)
// This ensures browser-computed hashes match the ZK circuit exactly

import { Barretenberg, Fr } from '@aztec/bb.js';

let bb = null;
let initPromise = null;

// Initialize Barretenberg (call early, it takes ~1-2s)
async function initPoseidon2() {
  if (bb) return bb;
  if (initPromise) return initPromise;
  initPromise = Barretenberg.new({ threads: 1 }).then(function(instance) {
    bb = instance;
    return bb;
  });
  return initPromise;
}

// Hash an array of field elements using Poseidon2
// inputs: array of BigInt or number values
// returns: BigInt
async function poseidon2Hash(inputs) {
  var api = await initPoseidon2();
  var frInputs = inputs.map(function(x) {
    return new Fr(BigInt(x));
  });
  var result = await api.poseidon2Hash(frInputs);
  return result.toBigInt();
}

// Compute seed commitment: poseidon2([seed])
async function computeCommitment(seed) {
  return await poseidon2Hash([seed]);
}

// Compute card rarity: poseidon2([seed, wave, cardIndex]) % 100
async function computeRarity(seed, wave, cardIndex) {
  var hash = await poseidon2Hash([seed, wave, cardIndex]);
  // hash is a BigInt, take mod 100
  return Number(hash % 100n);
}

// Pre-compute all card rarities for a game
// Returns array of { wave, cardIndex, rarity }
async function computeAllRarities(seed, numWaves) {
  var cards = [];
  for (var w = 1; w <= numWaves; w++) {
    var cardIndex = w - 1; // card 0 for wave 1, card 1 for wave 2, etc.
    var rarity = await computeRarity(seed, w, cardIndex);
    cards.push({ wave: w, cardIndex: cardIndex, rarity: rarity });
  }
  return cards;
}

// Convert commitment BigInt to 32-byte hex string (for on-chain)
function commitmentToHex(commitment) {
  var hex = commitment.toString(16);
  while (hex.length < 64) hex = '0' + hex;
  return hex;
}

window.Poseidon2 = {
  init: initPoseidon2,
  hash: poseidon2Hash,
  computeCommitment: computeCommitment,
  computeRarity: computeRarity,
  computeAllRarities: computeAllRarities,
  commitmentToHex: commitmentToHex,
};

// NOTE: Standalone Barretenberg.new() hangs in some browsers.
// Poseidon2 hashing is done inside zk-prover.js using UltraHonkBackend's internal Barretenberg.
// Do NOT auto-init here — it causes a hanging Promise.

export {
  initPoseidon2,
  poseidon2Hash,
  computeCommitment,
  computeRarity,
  computeAllRarities,
  commitmentToHex,
};
