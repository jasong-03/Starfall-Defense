// Stellar/Soroban wallet integration for ZK Loot card game
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  isConnected,
  requestAccess,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api';

const TESTNET_RPC = 'https://soroban-testnet.stellar.org';
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const STELLAR_EXPERT_BASE = 'https://stellar.expert/explorer/testnet';
const STELLARCHAIN_BASE = 'https://testnet.stellarchain.io';

// Deployed contracts on testnet
const GAME_CONTRACT_ID = 'CDDAPNA2OVZKNAUQ5LNUNE5F6WRITDOOITTQ6YIV67X4XRPAMM7ALFUV';

let server = null;
let walletPublicKey = null;

function getServer() {
  if (!server) {
    server = new StellarSdk.rpc.Server(TESTNET_RPC);
  }
  return server;
}

async function isFreighterInstalled() {
  try {
    var result = await isConnected();
    return result.isConnected;
  } catch (e) {
    return false;
  }
}

async function connectFreighter() {
  var connected = await isFreighterInstalled();
  if (!connected) {
    throw new Error('Freighter wallet not installed. Get it at freighter.app');
  }

  console.log('%c[Stellar] Connecting to Freighter wallet...', 'color: #00bfff');
  var accessResult = await requestAccess();
  if (accessResult.error) {
    throw new Error('Freighter denied access: ' + accessResult.error);
  }

  var addressResult = await getAddress();
  if (addressResult.error) {
    throw new Error('Failed to get address: ' + addressResult.error);
  }

  walletPublicKey = addressResult.address;
  console.log('%c[Stellar] Connected: %c' + walletPublicKey, 'color: #00bfff', 'color: #00ff41; font-weight: bold');
  console.log('%c  Explorer: ' + STELLAR_EXPERT_BASE + '/account/' + walletPublicKey, 'color: #888');
  return walletPublicKey;
}

function getWalletAddress() {
  return walletPublicKey;
}

// Hash a proof to 32 bytes using SHA-256
async function hashProof(proofBytes) {
  var hashBuffer = await crypto.subtle.digest('SHA-256', proofBytes);
  return new Uint8Array(hashBuffer);
}

// Sign a transaction XDR via Freighter
async function freighterSign(txXdr) {
  var result = await signTransaction(txXdr, {
    network: 'TESTNET',
    networkPassphrase: TESTNET_PASSPHRASE,
    address: walletPublicKey,
  });
  if (result.error) {
    throw new Error('Freighter signing failed: ' + result.error);
  }
  return result.signedTxXdr;
}

// ──── start_game: commit seed on-chain BEFORE gameplay ────
async function startGame(commitmentHex) {
  if (!walletPublicKey) {
    throw new Error('Wallet not connected');
  }

  console.log('%c╔══════════════════════════════════════════╗', 'color: #00bfff; font-weight: bold');
  console.log('%c║     START GAME — ON-CHAIN COMMIT         ║', 'color: #00bfff; font-weight: bold; font-size: 14px');
  console.log('%c╚══════════════════════════════════════════╝', 'color: #00bfff; font-weight: bold');
  console.log('%c  Contract: ' + GAME_CONTRACT_ID, 'color: #888');

  var rpcServer = getServer();
  var account = await rpcServer.getAccount(walletPublicKey);
  var contract = new StellarSdk.Contract(GAME_CONTRACT_ID);

  var commitmentBytes = hexToBytes(commitmentHex || '0'.repeat(64));
  console.log('%c  seed_commitment: 0x' + (commitmentHex || '').substring(0, 24) + '...', 'color: #00ffcc');

  var startTx = new StellarSdk.TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: TESTNET_PASSPHRASE,
  })
    .addOperation(contract.call(
      'start_game',
      StellarSdk.Address.fromString(walletPublicKey).toScVal(),
      StellarSdk.nativeToScVal(commitmentBytes, { type: 'bytes' }),
    ))
    .setTimeout(300)
    .build();

  var startSim = await rpcServer.simulateTransaction(startTx);
  if (StellarSdk.rpc.Api.isSimulationError(startSim)) {
    throw new Error('start_game simulation failed: ' + JSON.stringify(startSim.error));
  }
  console.log('%c  Simulation OK. Requesting Freighter signature...', 'color: #00ffcc');

  var startAssembled = StellarSdk.rpc.assembleTransaction(startTx, startSim).build();
  var startSignedXdr = await freighterSign(startAssembled.toXDR());
  console.log('%c  Signed! Submitting to Soroban RPC...', 'color: #00ffcc');
  var startSignedTx = StellarSdk.TransactionBuilder.fromXDR(startSignedXdr, TESTNET_PASSPHRASE);

  var startResult = await rpcServer.sendTransaction(startSignedTx);
  var startConfirm = await waitForTransaction(startResult.hash);
  if (!startConfirm.success) {
    throw new Error('start_game failed: ' + startConfirm.error);
  }

  var sessionId = 0;
  if (startConfirm.result && startConfirm.result.returnValue) {
    sessionId = Number(startConfirm.result.returnValue.value());
  }

  console.log('%c  start_game TX confirmed! Session #' + sessionId, 'color: #00ff41; font-weight: bold');
  console.log('%c  TX: ' + startResult.hash, 'color: #00ff41');
  console.log('%c  StellarChain: ' + STELLARCHAIN_BASE + '/transactions/' + startResult.hash, 'color: #00bfff; text-decoration: underline');

  return { sessionId: sessionId, hash: startResult.hash };
}

// ──── end_game: submit ZK proof + score on-chain AFTER gameplay ────
async function endGame(sessionId, proofResult, lootData) {
  if (!walletPublicKey) {
    throw new Error('Wallet not connected');
  }

  console.log('%c╔══════════════════════════════════════════╗', 'color: #00bfff; font-weight: bold');
  console.log('%c║     END GAME — ON-CHAIN SUBMISSION       ║', 'color: #00bfff; font-weight: bold; font-size: 14px');
  console.log('%c╚══════════════════════════════════════════╝', 'color: #00bfff; font-weight: bold');

  var rpcServer = getServer();
  var account = await rpcServer.getAccount(walletPublicKey);
  var contract = new StellarSdk.Contract(GAME_CONTRACT_ID);

  var proofHash = await hashProof(proofResult.proof);
  console.log('%c  session: #' + sessionId + ' | score: ' + (lootData.score || 0) + ' | cards: ' + (lootData.numCards || 0), 'color: #00ffcc');

  var cardRaritiesScVal = StellarSdk.xdr.ScVal.scvVec(
    (lootData.cardRarities || []).map(function(r) {
      return StellarSdk.nativeToScVal(Number(r), { type: 'u32' });
    })
  );
  var cardWavesScVal = StellarSdk.xdr.ScVal.scvVec(
    (lootData.cardWaves || []).map(function(w) {
      return StellarSdk.nativeToScVal(Number(w), { type: 'u32' });
    })
  );

  var endTx = new StellarSdk.TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: TESTNET_PASSPHRASE,
  })
    .addOperation(contract.call(
      'end_game',
      StellarSdk.Address.fromString(walletPublicKey).toScVal(),
      StellarSdk.nativeToScVal(sessionId, { type: 'u32' }),
      StellarSdk.nativeToScVal(lootData.numCards || 0, { type: 'u32' }),
      cardRaritiesScVal,
      cardWavesScVal,
      StellarSdk.nativeToScVal(proofHash, { type: 'bytes' }),
      StellarSdk.nativeToScVal(lootData.gameSeed || 0, { type: 'u64' }),
      StellarSdk.nativeToScVal(lootData.score || 0, { type: 'u32' }),
    ))
    .setTimeout(300)
    .build();

  var endSim = await rpcServer.simulateTransaction(endTx);
  if (StellarSdk.rpc.Api.isSimulationError(endSim)) {
    throw new Error('end_game simulation failed: ' + JSON.stringify(endSim.error));
  }
  console.log('%c  Simulation OK. Requesting Freighter signature...', 'color: #00ffcc');

  var endAssembled = StellarSdk.rpc.assembleTransaction(endTx, endSim).build();
  var endSignedXdr = await freighterSign(endAssembled.toXDR());
  console.log('%c  Signed! Submitting to Soroban RPC...', 'color: #00ffcc');
  var endSignedTx = StellarSdk.TransactionBuilder.fromXDR(endSignedXdr, TESTNET_PASSPHRASE);

  var endResult = await rpcServer.sendTransaction(endSignedTx);
  var endConfirm = await waitForTransaction(endResult.hash);

  if (endConfirm.success) {
    console.log('%c  end_game TX confirmed!', 'color: #00ff41; font-weight: bold');
    console.log('%c  TX: ' + endResult.hash, 'color: #00ff41');
    console.log('%c  StellarChain: ' + STELLARCHAIN_BASE + '/transactions/' + endResult.hash, 'color: #00bfff; text-decoration: underline');
    console.log('%c╔══════════════════════════════════════════╗', 'color: #00ff41; font-weight: bold');
    console.log('%c║  GAME SESSION COMPLETE ON-CHAIN          ║', 'color: #00ff41; font-weight: bold; font-size: 14px');
    console.log('%c╚══════════════════════════════════════════╝', 'color: #00ff41; font-weight: bold');
  }

  endConfirm.hash = endResult.hash;
  endConfirm.sessionId = sessionId;
  return endConfirm;
}

// Get leaderboard from contract
async function getLeaderboard() {
  var rpcServer = getServer();
  var contract = new StellarSdk.Contract(GAME_CONTRACT_ID);

  var publicKey = walletPublicKey || 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
  var account = await rpcServer.getAccount(publicKey);

  var tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: TESTNET_PASSPHRASE,
  })
    .addOperation(contract.call('get_leaderboard'))
    .setTimeout(300)
    .build();

  var simResult = await rpcServer.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simResult)) {
    return [];
  }

  return simResult.result?.retval || [];
}

// Wait for a transaction to be confirmed
async function waitForTransaction(hash) {
  var rpcServer = getServer();
  var maxAttempts = 30;
  for (var i = 0; i < maxAttempts; i++) {
    var result = await rpcServer.getTransaction(hash);
    if (result.status === 'SUCCESS') {
      return { success: true, hash: hash, result: result };
    }
    if (result.status === 'FAILED') {
      return { success: false, hash: hash, error: 'Transaction failed' };
    }
    await new Promise(function(resolve) { setTimeout(resolve, 2000); });
  }
  return { success: false, hash: hash, error: 'Transaction timed out' };
}

// Hex string to Uint8Array
function hexToBytes(hex) {
  var bytes = new Uint8Array(hex.length / 2);
  for (var i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Export for use by the game
window.StellarWallet = {
  isFreighterInstalled: isFreighterInstalled,
  connect: connectFreighter,
  getAddress: getWalletAddress,
  startGame: startGame,
  endGame: endGame,
  getLeaderboard: getLeaderboard,
  GAME_CONTRACT_ID: GAME_CONTRACT_ID,
};

export {
  isFreighterInstalled,
  connectFreighter,
  getWalletAddress,
  startGame,
  endGame,
  getLeaderboard,
  GAME_CONTRACT_ID,
};
