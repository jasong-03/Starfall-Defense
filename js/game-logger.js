class GameLogger {
  constructor() {
    this.reset();
  }

  reset() {
    this.seed = 0;
    this.events = [];          // chronological event log
    this.dataPoints = [];      // all data points spawned
    this.playerActions = [];   // all player actions (shot results)
    this.waveResults = [];     // per-wave summaries
    this.currentWave = 1;
    this.finalScore = 0;
    this.finalWave = 0;

    // Counters for ZK proof public inputs
    this.totalBadData = 0;
    this.correctShots = 0;     // bad data successfully shot
    this.incorrectShots = 0;   // good data accidentally shot
    this.missedBadData = 0;    // bad data that reached buildings
    this.totalDataPoints = 0;
  }

  setSeed(seed) {
    this.seed = seed;
  }

  logDataSpawn(dataPoint) {
    var entry = {
      index: this.totalDataPoints,
      token: dataPoint.token.symbol,
      price: parseFloat(dataPoint.price),
      isBad: dataPoint.isBad,
      wave: this.currentWave,
      timestamp: Date.now()
    };
    this.dataPoints.push(entry);
    dataPoint._logIdx = this.totalDataPoints; // store index for logShot lookup
    this.totalDataPoints++;
    if (dataPoint.isBad) this.totalBadData++;
  }

  logShot(dataPoint, wasHit) {
    if (!wasHit) return; // missed shot, no ZK relevance

    var action = {
      dataIndex: dataPoint._logIdx !== undefined ? dataPoint._logIdx : this.dataPoints.length - 1,
      token: dataPoint.token.symbol,
      price: parseFloat(dataPoint.price),
      isBad: dataPoint.isBad,
      action: 'shot',
      correct: dataPoint.isBad, // correct if we shot bad data
      wave: this.currentWave,
      timestamp: Date.now()
    };
    this.playerActions.push(action);

    if (dataPoint.isBad) {
      this.correctShots++;
    } else {
      this.incorrectShots++;
    }
  }

  logDataReachedBuildings(dataPoint) {
    var action = {
      token: dataPoint.token.symbol,
      price: parseFloat(dataPoint.price),
      isBad: dataPoint.isBad,
      action: 'reached_buildings',
      wave: this.currentWave,
      timestamp: Date.now()
    };
    this.playerActions.push(action);

    if (dataPoint.isBad) {
      this.missedBadData++;
    }
  }

  logWaveComplete(waveNum, score) {
    this.waveResults.push({
      wave: waveNum,
      score: score,
      timestamp: Date.now()
    });
    this.currentWave = waveNum + 1;
  }

  logGameOver(finalScore, finalWave) {
    this.finalScore = finalScore;
    this.finalWave = finalWave;
  }

  // Get the data needed for ZK proof generation
  getProofInputs() {
    // Collect all prices shown (as integers, multiply by 100 to avoid decimals)
    var prices = [];
    var classifications = []; // true = player classified as bad (shot it)
    var tokenTypes = [];      // 0=TRB, 1=ETH, 2=BTC

    // Map each data point to whether the player shot it
    var shotIndices = {};
    for (var i = 0; i < this.playerActions.length; i++) {
      var a = this.playerActions[i];
      if (a.action === 'shot') {
        shotIndices[a.dataIndex] = true;
      }
    }

    for (var j = 0; j < this.dataPoints.length; j++) {
      var dp = this.dataPoints[j];
      prices.push(Math.round(dp.price * 100)); // price in cents
      classifications.push(!!shotIndices[j]);   // true if player shot this

      var tokenMap = { TRB: 0, ETH: 1, BTC: 2 };
      tokenTypes.push(tokenMap[dp.token] || 0);
    }

    return {
      // Private inputs (witness)
      prices: prices,
      classifications: classifications,
      tokenTypes: tokenTypes,

      // Public inputs
      publicInputs: {
        real_trb_price: Math.round(REAL_PRICES.TRB.price * 100),
        real_eth_price: Math.round(REAL_PRICES.ETH.price * 100),
        real_btc_price: Math.round(REAL_PRICES.BTC.price * 100),
        correct_shots: this.correctShots,
        incorrect_shots: this.incorrectShots,
        missed_bad_data: this.missedBadData,
        total_bad_data: this.totalBadData,
        total_data_points: this.totalDataPoints,
        final_wave: this.finalWave,
        final_score: this.finalScore,
        game_seed: this.seed
      }
    };
  }

  // Export full game log as JSON (for debugging / proof generation)
  exportJSON() {
    return JSON.stringify({
      seed: this.seed,
      proofInputs: this.getProofInputs(),
      dataPoints: this.dataPoints,
      playerActions: this.playerActions,
      waveResults: this.waveResults,
      summary: {
        totalDataPoints: this.totalDataPoints,
        totalBadData: this.totalBadData,
        correctShots: this.correctShots,
        incorrectShots: this.incorrectShots,
        missedBadData: this.missedBadData,
        finalScore: this.finalScore,
        finalWave: this.finalWave
      }
    }, null, 2);
  }
}
window.GameLogger = GameLogger;
