// ZK Loot Reveal Circuit
// Proves: "My card rarities were fairly derived from a committed seed"
//
// The circuit takes a private seed and public game parameters,
// computes the Poseidon2 commitment and card rarities internally,
// and outputs them as public values in the proof.
//
// This ensures no hash mismatch between the browser and circuit
// since all hash computation happens inside the circuit.

global MAX_CARDS: u32 = 5;
comptime global TWO_POW_64: Field = 18446744073709551616;

// Poseidon2 sponge hash for 1 input
fn poseidon2_hash_1(a: Field) -> Field {
    let iv: Field = 1 * TWO_POW_64;
    let state = std::hash::poseidon2_permutation([a, 0, 0, iv], 4);
    state[0]
}

// Poseidon2 sponge hash for 3 inputs
fn poseidon2_hash_3(a: Field, b: Field, c: Field) -> Field {
    let iv: Field = 3 * TWO_POW_64;
    let state1 = std::hash::poseidon2_permutation([a, b, c, iv], 4);
    let state2 = std::hash::poseidon2_permutation(state1, 4);
    state2[0]
}

fn main(
    // === Private inputs ===
    seed: Field,

    // === Public inputs ===
    num_cards: pub u8,
    card_waves: pub [u32; 5],
    game_seed: pub u64,
) -> pub (Field, [u8; 5]) {
    // game_seed is bound to the proof but not used in computation
    let _ = game_seed;

    // 1. Compute seed commitment
    let commitment = poseidon2_hash_1(seed);

    // 2. Compute each card's rarity
    assert(num_cards as u32 <= MAX_CARDS, "Too many cards");

    let mut rarities: [u8; 5] = [0; 5];
    for i in 0..5 {
        if (i as u8) < num_cards {
            let rarity_hash = poseidon2_hash_3(
                seed,
                card_waves[i] as Field,
                i as Field,
            );
            rarities[i] = (rarity_hash as u64 % 100) as u8;
        }
    }

    // Return commitment and rarities as public outputs
    (commitment, rarities)
}

#[test]
fn test_single_card() {
    let seed: Field = 12345;
    let (commitment, rarities) = main(seed, 1, [1, 0, 0, 0, 0], 99999);
    // Just verify it runs without error
    assert(commitment != 0, "Commitment should not be zero");
    assert(rarities[0] < 100, "Rarity should be 0-99");
}

#[test]
fn test_three_cards() {
    let seed: Field = 67890;
    let (commitment, rarities) = main(seed, 3, [1, 2, 3, 0, 0], 11111);
    assert(commitment != 0, "Commitment should not be zero");
    for i in 0..3 {
        assert(rarities[i] < 100, "Rarity should be 0-99");
    }
}
