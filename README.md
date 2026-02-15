# Oracle Defense - ZK Loot Gaming on Stellar

A Missile Command-style browser game where players defend smart contracts from bad oracle data, with **ZK-proven loot cards** that grant skills and power-ups. Built on Stellar/Soroban with Noir ZK proofs.

## How It Works

1. **Gameplay**: Falling crypto price data points appear on screen. Some show real prices (cyan), others are manipulated (red). Players aim and shoot to intercept bad data before it reaches the smart contracts below.

2. **ZK Loot Cards**: Between waves, players receive loot cards with rarities derived from a committed seed using Poseidon2 hashing. Cards grant skills like extra ammo, faster shots, bonus damage, and area-of-effect attacks.

3. **ZK Proof**: After the game, players generate a Zero-Knowledge proof (UltraHonk) proving their loot rarities were fairly derived from the committed seed — without revealing the seed itself.

4. **On-Chain Verification**: The seed commitment is stored on-chain at game start. Game results with proof hashes and card data are submitted via the Game Hub contract.

## ZK Loot System

```
Game Start:
  1. Generate random seed
  2. Compute poseidon2(seed) commitment
  3. Submit commitment on-chain via start_game()

Between Waves:
  4. Derive card rarity = poseidon2(seed, wave, cardIndex) % 100
  5. Map rarity to tier: Common(0-49) / Rare(50-79) / Epic(80-94) / Legendary(95-99)
  6. Apply skill boost: ammo, speed, damage, AoE

Game Over:
  7. Generate ZK proof: "rarities correctly derived from committed seed"
  8. Submit proof hash + card data on-chain via end_game()
```

### Card Tiers & Skills

| Rarity | Tier | Chance | Skill |
|--------|------|--------|-------|
| 0-49 | Common | 50% | +2 ammo |
| 50-79 | Rare | 30% | +3 ammo, 15% faster |
| 80-94 | Epic | 15% | +4 ammo, 25% faster, +5 dmg |
| 95-99 | Legendary | 5% | +6 ammo, 35% faster, +10 dmg, AoE |

## Architecture

```
Browser Game (Vanilla JS + Canvas)
    │
    ├── Game Logic: Missile Command-style shooter + loot cards
    ├── Poseidon2 Hash: @aztec/bb.js Barretenberg WASM
    ├── Seeded RNG: Deterministic gameplay
    │
    ├── ZK Proof (Noir + Barretenberg)
    │   ├── Circuit: zk/loot_reveal/src/main.nr
    │   ├── Witness: @noir-lang/noir_js (browser WASM)
    │   └── Proof:   @aztec/bb.js (UltraHonk, keccak)
    │
    └── Stellar/Soroban
        ├── Game Contract: start_game() + end_game() with Game Hub
        ├── Seed Commitment: poseidon2(seed) stored on-chain
        └── Freighter Wallet: Transaction signing
```

## The ZK Circuit

The Noir circuit (`zk/loot_reveal/src/main.nr`) proves:

- **Private input**: The secret seed (never revealed)
- **Public inputs**: Seed commitment, card waves, card rarities, game seed
- **Constraints**:
  1. `poseidon2(seed) == seed_commitment` (seed matches on-chain commitment)
  2. For each card: `poseidon2(seed, wave, cardIndex) % 100 == rarity` (rarity correctly derived)

This ensures loot is deterministic, fair, and verifiable — without trusting the client or server.

## Deployed Contracts (Stellar Testnet)

| Contract | ID | Description |
|----------|-----|-------------|
| Game Contract | `CCSUZSBEX2KSRT45XX2GDQY4H7XJLOG23MTQCYLIT2364HGEBNMDJTM7` | ZK loot game with start/end + Game Hub |
| Game Hub (hackathon) | `CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG` | Hackathon game session registry |

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:8083
```

### Test ZK Circuit (CLI)

```bash
# Install Noir and Barretenberg
noirup -v 1.0.0-beta.9

# Compile and test
cd zk/loot_reveal
nargo test

# Compile for browser
nargo compile
```

## Tech Stack

- **Frontend**: HTML5 Canvas, Vanilla JavaScript, CSS (CRT effects)
- **ZK Circuit**: [Noir](https://noir-lang.org/) v1.0.0-beta.9 with Poseidon2 hash
- **Proving System**: [Barretenberg](https://github.com/AztecProtocol/aztec-packages) v0.87.0 (UltraHonk)
- **Blockchain**: [Stellar Soroban](https://soroban.stellar.org/) with Game Hub integration
- **Wallet**: [Freighter](https://freighter.app/) browser extension
- **Build Tool**: [Vite](https://vitejs.dev/)

## Game Controls

- **Mouse**: Aim turret
- **Click**: Fire projectile / Navigate menus / Dismiss cards
- **[M]**: Toggle sound
- **[Z]**: Generate ZK proof (game over screen)
- **[S]**: Submit to Stellar (after proof generated)

## Project Structure

```
├── index.html              # Game entry point
├── css/style.css           # CRT monitor styling
├── js/
│   ├── game.js             # Game state machine + loot integration
│   ├── loot-system.js      # Card rarity tiers + skill definitions
│   ├── card-ui.js          # Card reveal animation (canvas)
│   ├── poseidon2.js        # Poseidon2 hash via bb.js WASM
│   ├── matrix.js           # Matrix digital rain background
│   ├── audio.js            # Web Audio API sound effects
│   ├── turret.js           # Mouse-aimed turret
│   ├── datapoint.js        # Falling price data entities
│   ├── projectile.js       # Laser projectiles (speed boost support)
│   ├── explosion.js        # Hit/miss explosions
│   ├── buildings.js        # Pixel art buildings (5 HP)
│   ├── hud.js              # Score, ammo, wave display
│   ├── ticker.js           # Price ticker bar
│   ├── seeded-random.js    # Deterministic PRNG (mulberry32)
│   ├── game-logger.js      # Game event tracker for ZK
│   ├── zk-prover.js        # Browser ZK proof generation
│   └── stellar-wallet.js   # Freighter + Soroban integration
├── zk/loot_reveal/         # ZK Loot Reveal circuit
│   ├── src/main.nr         # Poseidon2 commitment + rarity verification
│   ├── Nargo.toml          # Circuit config + poseidon dependency
│   └── target/             # Compiled artifacts
├── contracts/
│   └── game-leaderboard/   # Soroban game contract (start/end + Game Hub)
└── vite.config.js          # Dev server config
```

## License

MIT
