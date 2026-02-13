// Oracle Defense ZK Circuit
// Proves: "I correctly identified bad oracle price data"
//
// The game shows falling crypto prices. Some are real (good data),
// some are manipulated (bad data). The player must shoot bad data
// and let good data through.
//
// This circuit proves the player's classification accuracy without
// revealing their specific detection strategy.

global MAX_DATA_POINTS: u32 = 20;

fn is_price_bad(price_cents: u64, real_price_cents: u64) -> bool {
    // Bad = deviates >40% from real price
    // price < real*60/100 OR price > real*140/100
    let lower_bound = real_price_cents * 60 / 100;
    let upper_bound = real_price_cents * 140 / 100;
    (price_cents < lower_bound) | (price_cents > upper_bound)
}

fn main(
    // === Private inputs (witness) ===
    prices: [u64; 20],
    token_types: [u8; 20],
    player_shot: [bool; 20],
    num_active: u8,

    // === Public inputs (on-chain) ===
    real_trb: pub u64,
    real_eth: pub u64,
    real_btc: pub u64,
    correct_shots: pub u8,
    incorrect_shots: pub u8,
    missed_bad: pub u8,
    total_data_points: pub u8,
    game_seed: pub u64,
) {
    assert(num_active == total_data_points, "Active count mismatch");
    assert(num_active as u32 <= MAX_DATA_POINTS, "Too many data points");

    let mut computed_correct: u8 = 0;
    let mut computed_incorrect: u8 = 0;
    let mut computed_missed: u8 = 0;

    for i in 0..20 {
        if (i as u8) < num_active {
            let real_price = if token_types[i] == 0 {
                real_trb
            } else if token_types[i] == 1 {
                real_eth
            } else {
                real_btc
            };

            let actually_bad = is_price_bad(prices[i], real_price);

            if player_shot[i] {
                if actually_bad {
                    computed_correct += 1;
                } else {
                    computed_incorrect += 1;
                }
            } else if actually_bad {
                computed_missed += 1;
            }
        }
    }

    assert(computed_correct == correct_shots, "Correct shots mismatch");
    assert(computed_incorrect == incorrect_shots, "Incorrect shots mismatch");
    assert(computed_missed == missed_bad, "Missed bad data mismatch");
}

#[test]
fn test_perfect_game() {
    let mut prices: [u64; 20] = [0; 20];
    let mut token_types: [u8; 20] = [0; 20];
    let mut player_shot: [bool; 20] = [false; 20];

    prices[0] = 1558;       // TRB good
    prices[1] = 231;        // TRB bad (way low)
    prices[2] = 205400;     // ETH good
    prices[3] = 20000000;   // BTC bad (3x real)
    prices[4] = 50000;      // ETH bad (way low)

    token_types[0] = 0;
    token_types[1] = 0;
    token_types[2] = 1;
    token_types[3] = 2;
    token_types[4] = 1;

    player_shot[1] = true;  // shot bad TRB
    player_shot[3] = true;  // shot bad BTC
    player_shot[4] = true;  // shot bad ETH

    main(prices, token_types, player_shot, 5, 1558, 205400, 6880300, 3, 0, 0, 5, 12345);
}

#[test]
fn test_mixed_game() {
    let mut prices: [u64; 20] = [0; 20];
    let mut token_types: [u8; 20] = [0; 20];
    let mut player_shot: [bool; 20] = [false; 20];

    prices[0] = 1560;       // TRB good - accidentally shot
    prices[1] = 231;        // TRB bad - correctly shot
    prices[2] = 6880000;    // BTC good - ignored
    prices[3] = 50000;      // ETH bad - missed

    token_types[0] = 0;
    token_types[1] = 0;
    token_types[2] = 2;
    token_types[3] = 1;

    player_shot[0] = true;
    player_shot[1] = true;

    main(prices, token_types, player_shot, 4, 1558, 205400, 6880300, 1, 1, 1, 4, 99999);
}
