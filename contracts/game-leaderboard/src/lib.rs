#![no_std]
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, symbol_short, Address,
    BytesN, Env, Vec,
};

// Game Hub contract interface
#[contractclient(name = "GameHubClient")]
pub trait GameHub {
    fn start_game(
        env: Env,
        game_id: Address,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
    );

    fn end_game(env: Env, session_id: u32, player1_won: bool);
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GameSession {
    pub player: Address,
    pub seed_commitment: BytesN<32>, // poseidon2(seed) committed at start
    pub started: bool,
    pub ended: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GameResult {
    pub player: Address,
    pub seed_commitment: BytesN<32>,
    pub num_cards: u32,
    pub card_rarities: Vec<u32>,     // rarity 0-99 for each card
    pub card_waves: Vec<u32>,        // wave number for each card
    pub proof_hash: BytesN<32>,      // SHA-256 of ZK proof
    pub game_seed: u64,
    pub score: u32,                  // game score (correct shots etc)
    pub timestamp: u64,
}

#[contracttype]
enum DataKey {
    Admin,
    Count,
    Session(u32),
    Result(u32),
    GameHub,
}

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotAdmin = 1,
    InvalidSession = 2,
    SessionAlreadyEnded = 3,
    CommitmentMismatch = 4,
    TooManyCards = 5,
}

#[contract]
pub struct OracleDefenseGame;

#[contractimpl]
impl OracleDefenseGame {
    /// Initialize with admin address and game hub contract
    pub fn __constructor(env: Env, admin: Address, game_hub: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GameHub, &game_hub);
        env.storage().instance().set(&DataKey::Count, &0u32);
    }

    /// Start a new game session — player commits poseidon2(seed)
    /// Returns session_id
    pub fn start_game(
        env: Env,
        player: Address,
        seed_commitment: BytesN<32>,
    ) -> Result<u32, Error> {
        player.require_auth();

        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let session_id = count;

        // Store session with commitment
        let session = GameSession {
            player: player.clone(),
            seed_commitment,
            started: true,
            ended: false,
        };
        env.storage().instance().set(&DataKey::Session(session_id), &session);
        env.storage().instance().set(&DataKey::Count, &(count + 1));

        // Register with Game Hub
        let game_hub_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::GameHub)
            .expect("GameHub not set");
        let hub = GameHubClient::new(&env, &game_hub_addr);
        hub.start_game(
            &env.current_contract_address(),
            &session_id,
            &player,
            &env.current_contract_address(),
            &0i128,
            &0i128,
        );

        // Emit event for Stellar Expert visibility
        env.events()
            .publish((symbol_short!("gm_start"),), (player, session_id));

        env.storage().instance().extend_ttl(50000, 100000);
        Ok(session_id)
    }

    /// End a game session — submit ZK-proven card rarities + proof hash
    pub fn end_game(
        env: Env,
        player: Address,
        session_id: u32,
        num_cards: u32,
        card_rarities: Vec<u32>,
        card_waves: Vec<u32>,
        proof_hash: BytesN<32>,
        game_seed: u64,
        score: u32,
    ) -> Result<u32, Error> {
        player.require_auth();

        // Verify session exists and hasn't ended
        let mut session: GameSession = env
            .storage()
            .instance()
            .get(&DataKey::Session(session_id))
            .ok_or(Error::InvalidSession)?;

        if session.ended {
            return Err(Error::SessionAlreadyEnded);
        }

        if num_cards > 5 {
            return Err(Error::TooManyCards);
        }

        // Mark session as ended
        session.ended = true;
        env.storage().instance().set(&DataKey::Session(session_id), &session);

        // Store game result with ZK proof data
        let result = GameResult {
            player: player.clone(),
            seed_commitment: session.seed_commitment,
            num_cards,
            card_rarities,
            card_waves,
            proof_hash,
            game_seed,
            score,
            timestamp: env.ledger().timestamp(),
        };
        env.storage().instance().set(&DataKey::Result(session_id), &result);

        // End game on Game Hub
        let game_hub_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::GameHub)
            .expect("GameHub not set");
        let hub = GameHubClient::new(&env, &game_hub_addr);
        hub.end_game(&session_id, &true);

        // Emit event with score + card count for Stellar Expert
        env.events()
            .publish((symbol_short!("gm_end"),), (player, session_id, score, num_cards));

        env.storage().instance().extend_ttl(50000, 100000);
        Ok(session_id)
    }

    /// Get a game result by session index
    pub fn get_result(env: Env, index: u32) -> Option<GameResult> {
        env.storage().instance().get(&DataKey::Result(index))
    }

    /// Get a game session by index
    pub fn get_session(env: Env, index: u32) -> Option<GameSession> {
        env.storage().instance().get(&DataKey::Session(index))
    }

    /// Get total number of sessions
    pub fn get_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    /// Get the top results (last 10)
    pub fn get_leaderboard(env: Env) -> Vec<GameResult> {
        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let mut results: Vec<GameResult> = Vec::new(&env);
        let start = if count > 10 { count - 10 } else { 0 };
        for i in start..count {
            if let Some(r) = env.storage().instance().get::<_, GameResult>(&DataKey::Result(i)) {
                results.push_back(r);
            }
        }
        results
    }

    /// Get the Game Hub address
    pub fn get_hub(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::GameHub)
            .expect("GameHub not set")
    }

    /// Set a new Game Hub address (admin only)
    pub fn set_hub(env: Env, new_hub: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.storage().instance().set(&DataKey::GameHub, &new_hub);
    }
}
