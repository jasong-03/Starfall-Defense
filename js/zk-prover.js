// ZK Proof Generator - Browser-based proof generation using Noir + Barretenberg
// Generates UltraHonk proofs for the ZK Loot Reveal circuit
//
// The circuit computes Poseidon2 hashes internally, so JavaScript
// only needs to pass seed, numCards, card_waves, and gameSeed.
// Commitment and rarities are circuit OUTPUTS (public in the proof).

import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';

// Circuit instances
let lootCircuit = null;
let lootNoir = null;
let lootBackend = null;
let lootInitialized = false;
let lootInitializing = false;

// Pad array to fixed length with zeros
function padArray(arr, len, defaultVal) {
  var result = arr.slice(0, len);
  while (result.length < len) {
    result.push(defaultVal);
  }
  return result;
}

// Initialize the loot reveal ZK prover
async function initLootProver(onProgress) {
  if (lootInitialized) return true;
  if (lootInitializing) return false;
  lootInitializing = true;

  try {
    if (onProgress) onProgress('Loading loot circuit...');
    console.log('%c[ZK] Loading Noir circuit (loot_reveal.json)...', 'color: #00ffcc');

    var response = await fetch('/zk/loot_reveal/target/loot_reveal.json');
    lootCircuit = await response.json();
    console.log('%c[ZK] Circuit loaded. Bytecode: ' + lootCircuit.bytecode.length + ' chars', 'color: #00ffcc');

    if (onProgress) onProgress('Initializing Barretenberg...');
    console.log('%c[ZK] Initializing UltraHonk backend (Barretenberg WASM)...', 'color: #00ffcc');

    lootBackend = new UltraHonkBackend(lootCircuit.bytecode, { threads: 1 });
    lootNoir = new Noir(lootCircuit);

    await lootBackend.instantiate();

    lootInitialized = true;
    lootInitializing = false;
    if (onProgress) onProgress('Loot ZK prover ready!');
    console.log('%c[ZK] Barretenberg WASM ready. UltraHonk prover initialized.', 'color: #00ff41; font-weight: bold');
    return true;
  } catch (err) {
    console.error('Failed to initialize loot ZK prover:', err);
    lootInitializing = false;
    if (onProgress) onProgress('ZK init failed: ' + err.message);
    return false;
  }
}

// Generate a ZK loot proof
// proofData: { seed, numCards, gameSeed }
async function generateLootProof(proofData, onProgress) {
  if (!lootInitialized) {
    if (onProgress) onProgress('Initializing ZK prover...');
    var ok = await initLootProver(onProgress);
    if (!ok) throw new Error('Failed to initialize ZK loot prover');
  }

  var MAX_CARDS = 5;
  var numCards = Math.min(proofData.numCards || 0, MAX_CARDS);

  // Card waves: wave i+1 for card i
  var cardWaves = [];
  for (var i = 0; i < numCards; i++) {
    cardWaves.push(i + 1);
  }
  cardWaves = padArray(cardWaves, MAX_CARDS, 0);

  // Build circuit inputs — hashes are computed INSIDE the circuit
  var inputs = {
    seed: proofData.seed.toString(),
    num_cards: numCards.toString(),
    card_waves: cardWaves.map(function(w) { return w.toString(); }),
    game_seed: (proofData.gameSeed || 0).toString(),
  };

  console.log('%c[ZK] Circuit inputs:', 'color: #00ffcc');
  console.log('%c  seed (private): ' + inputs.seed, 'color: #ff6b6b');
  console.log('%c  num_cards: ' + inputs.num_cards + ' | game_seed: ' + inputs.game_seed, 'color: #00ffcc');
  console.log('%c  card_waves: [' + inputs.card_waves.join(', ') + ']', 'color: #00ffcc');

  if (onProgress) onProgress('Generating witness...');
  console.log('%c[ZK] Executing Noir circuit (generating witness)...', 'color: #ffff00');

  var execResult = await lootNoir.execute(inputs);
  var witness = execResult.witness;
  console.log('%c[ZK] Witness generated. Size: ' + witness.length + ' elements', 'color: #00ff41');

  // Extract return values (commitment, rarities) from execution
  // The circuit returns: pub (Field, [u8; 5])
  var returnValue = execResult.returnValue;

  // Parse the return values
  var commitment = BigInt(0);
  var cardRarities = [];
  if (returnValue && Array.isArray(returnValue)) {
    // Return is a tuple: [commitment_field, [r0, r1, r2, r3, r4]]
    commitment = BigInt(returnValue[0]);
    var raritiesArr = returnValue[1];
    for (var j = 0; j < numCards; j++) {
      cardRarities.push(Number(raritiesArr[j]));
    }
  }
  var commitmentHex = commitment.toString(16).padStart(64, '0');

  // Log circuit outputs
  console.log('%c[ZK] Circuit outputs (Poseidon2 computed inside circuit):', 'color: #00ffcc');
  console.log('%c  seed_commitment: 0x' + commitmentHex.substring(0, 32) + '...', 'color: #00ff41');
  var tierNames = ['Common', 'Common', 'Common', 'Common', 'Common'];
  for (var k = 0; k < cardRarities.length; k++) {
    var r = cardRarities[k];
    var tier = r >= 95 ? 'Legendary' : r >= 80 ? 'Epic' : r >= 50 ? 'Rare' : 'Common';
    tierNames[k] = tier;
    var tierColor = r >= 95 ? '#ffd700' : r >= 80 ? '#a855f7' : r >= 50 ? '#3b82f6' : '#9ca3af';
    console.log('%c  Card ' + (k + 1) + ': rarity=' + r + ' (' + tier + ')', 'color: ' + tierColor + '; font-weight: bold');
  }

  if (onProgress) onProgress('Generating proof (this may take a moment)...');
  console.log('%c[ZK] Generating UltraHonk proof...', 'color: #ffff00; font-weight: bold');
  var proofStart = Date.now();

  var proofResult = await lootBackend.generateProof(witness, { keccak: true });

  var proofTime = ((Date.now() - proofStart) / 1000).toFixed(1);
  if (onProgress) onProgress('Proof generated!');
  console.log('%c[ZK] UltraHonk proof generated in ' + proofTime + 's', 'color: #00ff41; font-weight: bold');
  console.log('%c  Proof size: ' + proofResult.proof.length + ' bytes (' + (proofResult.proof.length / 1024).toFixed(1) + ' KB)', 'color: #00ff41');
  console.log('%c  Public inputs: ' + proofResult.publicInputs.length + ' field elements', 'color: #00ff41');

  return {
    proof: proofResult.proof,
    publicInputs: proofResult.publicInputs,
    lootData: {
      numCards: numCards,
      cardRarities: cardRarities,
      cardWaves: cardWaves.slice(0, numCards),
      gameSeed: proofData.gameSeed,
      commitmentHex: commitmentHex,
    },
    proofHex: Array.from(proofResult.proof)
      .map(function(b) { return b.toString(16).padStart(2, '0'); })
      .join(''),
  };
}

// Verify a loot proof locally
async function verifyLootProof(proofData, onProgress) {
  if (!lootInitialized) {
    throw new Error('ZK loot prover not initialized');
  }

  if (onProgress) onProgress('Verifying proof...');
  console.log('%c[ZK] Verifying UltraHonk proof...', 'color: #ffff00');
  var verifyStart = Date.now();
  var isValid = await lootBackend.verifyProof(proofData, { keccak: true });
  var verifyTime = ((Date.now() - verifyStart) / 1000).toFixed(1);
  if (isValid) {
    console.log('%c[ZK] Proof VALID (' + verifyTime + 's). Loot is cryptographically fair!', 'color: #00ff41; font-weight: bold; font-size: 14px');
  } else {
    console.log('%c[ZK] Proof INVALID! Loot may have been tampered with.', 'color: #ff0000; font-weight: bold; font-size: 14px');
  }
  if (onProgress) onProgress(isValid ? 'Proof valid!' : 'Proof INVALID!');
  return isValid;
}

// Export for use by the game
window.ZKProver = {
  initLoot: initLootProver,
  generateLootProof: generateLootProof,
  verifyLootProof: verifyLootProof,
  isReady: function() { return lootInitialized; },
};

export { initLootProver, generateLootProof, verifyLootProof };
