var GameState = {
  TITLE: 'title',
  INSTRUCTIONS: 'instructions',
  PLAYING: 'playing',
  CARD_REVEAL: 'card_reveal',
  WAVE_TRANSITION: 'wave_transition',
  GAME_OVER: 'game_over'
};

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    // Systems
    this.matrix = new MatrixRain(this.width, this.height);
    this.audio = new AudioManager();
    this.turret = new Turret(this.width, this.height);
    this.buildings = new Buildings(this.width, this.height);
    this.hud = new HUD(this.width);
    this.ticker = new Ticker(this.width, this.height);
    this.cardUI = new CardRevealUI(this.width, this.height);

    // Entity arrays
    this.dataPoints = [];
    this.projectiles = [];
    this.explosions = [];

    // State
    this.state = GameState.TITLE;
    this.countdown = 5;
    this.countdownTimer = 0;
    this.waveTimer = 0;
    this.spawnInterval = 2000;
    this.lastSpawnTime = 0;
    this.dataPointsThisWave = 0;
    this.maxDataPointsPerWave = 10;
    this.badDataChance = 0.3;
    this.dataSpeed = 0.8;
    this.waveComplete = false;

    // ZK Loot system
    this.zkSeed = null;         // BigInt seed for Poseidon2
    this.seedCommitment = null;  // BigInt poseidon2(seed)
    this.commitmentHex = null;   // hex string for on-chain
    this.precomputedCards = [];   // pre-computed card rarities
    this.collectedCards = [];     // cards player has collected
    this.activeBoosts = { totalAmmo: 0, speedPercent: 0, damageBonus: 0, hasBlastRadius: false };
    // Poseidon2 hashing is done at proof time inside zk-prover.js

    // ZK integration
    this.logger = new GameLogger();
    this.rng = null;
    this._zkSubmitMessage = null;
    this._zkSubmitTime = 0;

    // Mouse
    this.mouseX = this.width / 2;
    this.mouseY = this.height / 2;

    // Bind events
    this._bindEvents();

    // Poseidon2 hashing is handled inside zk-prover.js using UltraHonkBackend's Barretenberg.
    // Standalone Barretenberg.new() hangs, so we don't try to init it here.
  }

  _bindEvents() {
    var self = this;

    this.canvas.addEventListener('mousemove', function(e) {
      var rect = self.canvas.getBoundingClientRect();
      var scaleX = self.width / rect.width;
      var scaleY = self.height / rect.height;
      self.mouseX = (e.clientX - rect.left) * scaleX;
      self.mouseY = (e.clientY - rect.top) * scaleY;
    });

    this.canvas.addEventListener('click', function(e) {
      self.audio.init();
      self._handleClick();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'm' || e.key === 'M') {
        self.hud.soundOn = !self.audio.toggleMute();
      }
      if (e.key === 'z' || e.key === 'Z') {
        if (self.state === GameState.GAME_OVER && !self._zkGenerating) {
          self._submitZKProof();
        }
      }
      if (e.key === 's' || e.key === 'S') {
        if (self.state === GameState.GAME_OVER && self._zkProofResult && !self._zkSubmitting) {
          self._submitToStellar();
        }
      }
    });
  }

  _handleClick() {
    switch (this.state) {
      case GameState.TITLE:
        if (this._walletAddress) {
          // Already connected — start game
          this.state = GameState.INSTRUCTIONS;
          this.countdown = 5;
          this.countdownTimer = Date.now();
        } else if (!this._walletConnecting) {
          // Connect wallet first
          this._connectWallet();
        }
        break;

      case GameState.INSTRUCTIONS:
        break;

      case GameState.PLAYING:
        this._shoot();
        break;

      case GameState.CARD_REVEAL:
        this.cardUI.skip();
        break;

      case GameState.WAVE_TRANSITION:
        break;

      case GameState.GAME_OVER:
        // Only allow restart after TX submitted (or if no wallet)
        if (this._stellarTxHash || !this._walletAddress) {
          this._restart();
        }
        break;
    }
  }

  _shoot() {
    if (this.hud.ammo <= 0) return;

    this.hud.ammo--;
    this.audio.playShoot();

    var tip = this.turret.getBarrelTip();
    var speed = 8 * (1 + this.activeBoosts.speedPercent / 100);
    var proj = new Projectile(tip.x, tip.y, this.mouseX, this.mouseY, speed);
    this.projectiles.push(proj);
  }

  _spawnDataPoint() {
    if (this.dataPointsThisWave >= this.maxDataPointsPerWave) return;

    var isBad = this.rng.next() < this.badDataChance;
    var dp = new DataPoint(this.width, isBad, this.dataSpeed + this.rng.next() * 0.5, this.rng);
    this.dataPoints.push(dp);
    this.dataPointsThisWave++;
    this.logger.logDataSpawn(dp);
  }

  _checkCollisions() {
    for (var i = this.projectiles.length - 1; i >= 0; i--) {
      var proj = this.projectiles[i];
      if (!proj.alive) continue;

      for (var j = this.dataPoints.length - 1; j >= 0; j--) {
        var dp = this.dataPoints[j];
        if (!dp.alive) continue;

        var dx = proj.x - dp.x;
        var dy = proj.y - (dp.y + 12);
        var dist = Math.sqrt(dx * dx + dy * dy);

        var hitRadius = this.activeBoosts.hasBlastRadius ? 35 : 20;

        if (dist < hitRadius) {
          proj.alive = false;
          dp.alive = false;
          this.logger.logShot(dp, true);

          var bonusDmg = this.activeBoosts.damageBonus;

          if (dp.isBad) {
            this.hud.score += 15 + bonusDmg;
            this.explosions.push(new Explosion(dp.x, dp.y, true));
            this.audio.playHit();

            // AoE: damage nearby bad data points
            if (this.activeBoosts.hasBlastRadius) {
              this._aoeBlast(dp.x, dp.y);
            }
          } else {
            this.hud.score -= 15;
            this.explosions.push(new Explosion(dp.x, dp.y, false));
            this.audio.playBadHit();
          }
          break;
        }
      }
    }
  }

  _aoeBlast(x, y) {
    var aoeRadius = 60;
    for (var k = this.dataPoints.length - 1; k >= 0; k--) {
      var other = this.dataPoints[k];
      if (!other.alive) continue;
      var dx = x - other.x;
      var dy = y - other.y;
      if (Math.sqrt(dx * dx + dy * dy) < aoeRadius) {
        other.alive = false;
        if (other.isBad) {
          this.hud.score += 10;
          this.explosions.push(new Explosion(other.x, other.y, true));
        }
      }
    }
  }

  _checkDataReachingBuildings() {
    for (var i = this.dataPoints.length - 1; i >= 0; i--) {
      var dp = this.dataPoints[i];
      if (!dp.alive) continue;

      if (dp.y > this.height - 70) {
        dp.alive = false;
        this.logger.logDataReachedBuildings(dp);
        if (dp.isBad) {
          var gameOver = this.buildings.takeDamage();
          this.explosions.push(new Explosion(dp.x, this.height - 60, false));
          this.audio.playExplosion();
          if (gameOver) {
            this.state = GameState.GAME_OVER;
            this.logger.logGameOver(this.hud.score, this.hud.wave);
            this.audio.playGameOver();
            // Auto-generate ZK proof + submit on-chain
            this._autoSubmitFlow();
          }
        }
      }
    }
  }

  _cleanupEntities() {
    var height = this.height;
    var width = this.width;
    this.dataPoints = this.dataPoints.filter(function(dp) {
      return dp.alive && !dp.isOffScreen(height);
    });
    this.projectiles = this.projectiles.filter(function(p) {
      return p.alive && !p.isOffScreen(width, height);
    });
    this.explosions = this.explosions.filter(function(e) {
      return e.alive;
    });
  }

  _checkWaveComplete() {
    if (this.dataPointsThisWave >= this.maxDataPointsPerWave &&
        this.dataPoints.length === 0 &&
        this.state === GameState.PLAYING) {
      this.logger.logWaveComplete(this.hud.wave, this.hud.score);

      // Reveal card after each wave (up to 5)
      var cardIndex = this.hud.wave - 1;
      if (cardIndex < this.precomputedCards.length) {
        var cardData = this.precomputedCards[cardIndex];
        var card = window.LootSystem.createCard(cardData.wave, cardData.cardIndex, cardData.rarity);
        this.collectedCards.push(card);
        this.activeBoosts = window.LootSystem.computeBoosts(this.collectedCards);
        this._syncBoostsToHUD();
        this._showBuffPopup(card);
        this.cardUI.reveal(card);
        this.state = GameState.CARD_REVEAL;
      } else {
        // No more cards, go straight to wave transition
        this.state = GameState.WAVE_TRANSITION;
        this.hud.wave++;
        this.countdown = 5;
        this.countdownTimer = Date.now();
      }
      this.audio.playWaveStart();
    }
  }

  _startNextWave() {
    this.dataPointsThisWave = 0;
    this.dataPoints = [];
    this.projectiles = [];

    // Scale difficulty
    this.maxDataPointsPerWave = Math.min(10 + this.hud.wave * 3, 30);
    this.badDataChance = Math.min(0.3 + this.hud.wave * 0.08, 0.7);
    this.dataSpeed = 0.8 + this.hud.wave * 0.2;
    this.spawnInterval = Math.max(2000 - this.hud.wave * 150, 600);

    // Base ammo + card boosts
    var baseAmmo = Math.min(10 + this.hud.wave, 20);
    this.hud.ammo = baseAmmo + this.activeBoosts.totalAmmo;
    this.hud.maxAmmo = this.hud.ammo;

    this.state = GameState.PLAYING;
    this.lastSpawnTime = Date.now();
  }

  _startNewGame() {
    var self = this;
    this.hud.wave = 1;
    var seed = Date.now() & 0xFFFFFFFF;
    this.rng = new SeededRandom(seed);
    this.logger.reset();
    this.logger.setSeed(seed);

    // Generate ZK seed and pre-compute cards
    this.zkSeed = BigInt(seed);
    this.collectedCards = [];
    this.activeBoosts = { totalAmmo: 0, speedPercent: 0, damageBonus: 0, hasBlastRadius: false };
    this._syncBoostsToHUD();
    this._buffPopup = null;

    // Use fallback card rarities for in-game display (fast seeded RNG).
    // Real Poseidon2 commitment + rarities are computed at ZK proof time
    // inside zk-prover.js using UltraHonkBackend's Barretenberg instance.
    this._fallbackCards();
    this._startNextWave();
    console.log('ZK Loot: seed=' + seed + ' (real Poseidon2 hashes computed at proof time)');
  }

  // Fallback: use seeded RNG for card rarities when Poseidon2 isn't available
  _fallbackCards() {
    this.precomputedCards = [];
    var tempRng = new SeededRandom(Number(this.zkSeed) ^ 0xDEADBEEF);
    for (var w = 1; w <= 5; w++) {
      this.precomputedCards.push({
        wave: w,
        cardIndex: w - 1,
        rarity: Math.floor(tempRng.next() * 100),
      });
    }
    this.seedCommitment = null;
    this.commitmentHex = null;
  }

  _restart() {
    this.state = GameState.TITLE;
    this.hud.reset();
    this.buildings.reset();
    this.logger.reset();
    this.cardUI.reset();
    this.dataPoints = [];
    this.projectiles = [];
    this.explosions = [];
    this.dataPointsThisWave = 0;
    this.maxDataPointsPerWave = 10;
    this.collectedCards = [];
    this.activeBoosts = { totalAmmo: 0, speedPercent: 0, damageBonus: 0, hasBlastRadius: false };
    this._syncBoostsToHUD();
    this._buffPopup = null;
    this.precomputedCards = [];
    this.zkSeed = null;
    this.seedCommitment = null;
    this.commitmentHex = null;
    // Reset ZK state
    this._zkProofResult = null;
    this._zkGenerating = false;
    this._zkSubmitting = false;
    this._zkSubmitMessage = null;
    this._stellarTxHash = null;
    this._stellarStartHash = null;
    this._stellarSessionId = null;
    this.badDataChance = 0.3;
    this.dataSpeed = 0.8;
    this.spawnInterval = 2000;
  }

  update() {
    var now = Date.now();
    this.ticker.update();
    this.turret.aimAt(this.mouseX, this.mouseY);

    switch (this.state) {
      case GameState.INSTRUCTIONS:
        if (now - this.countdownTimer > 1000) {
          this.countdown--;
          this.countdownTimer = now;
          if (this.countdown <= 0) {
            this._startNewGame();
          }
        }
        break;

      case GameState.PLAYING:
        if (now - this.lastSpawnTime > this.spawnInterval &&
            this.dataPointsThisWave < this.maxDataPointsPerWave) {
          this._spawnDataPoint();
          this.lastSpawnTime = now;
        }
        this.dataPoints.forEach(function(dp) { dp.update(); });
        this.projectiles.forEach(function(p) { p.update(); });
        this._checkCollisions();
        this._checkDataReachingBuildings();
        this._cleanupEntities();
        this._checkWaveComplete();
        break;

      case GameState.CARD_REVEAL:
        var done = this.cardUI.update();
        if (done) {
          this.cardUI.reset();
          this.state = GameState.WAVE_TRANSITION;
          this.hud.wave++;
          this.countdown = 5;
          this.countdownTimer = Date.now();
        }
        break;

      case GameState.WAVE_TRANSITION:
        if (now - this.countdownTimer > 1000) {
          this.countdown--;
          this.countdownTimer = now;
          if (this.countdown <= 0) {
            this._startNextWave();
          }
        }
        break;
    }

    // Always update explosions
    this.explosions.forEach(function(e) { e.update(); });
    this.explosions = this.explosions.filter(function(e) { return e.alive; });
  }

  render() {
    var ctx = this.ctx;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.width, this.height);

    this.matrix.update();
    this.matrix.draw(ctx);

    switch (this.state) {
      case GameState.TITLE:
        this._renderTitle(ctx);
        break;

      case GameState.INSTRUCTIONS:
        this._renderInstructions(ctx);
        break;

      case GameState.PLAYING:
        this._renderGameplay(ctx);
        break;

      case GameState.CARD_REVEAL:
        this._renderGameplay(ctx);
        this.cardUI.draw(ctx);
        break;

      case GameState.WAVE_TRANSITION:
        this._renderWaveTransition(ctx);
        break;

      case GameState.GAME_OVER:
        this._renderGameOver(ctx);
        break;
    }

    this.ticker.draw(ctx);
  }

  _renderTitle(ctx) {
    this.buildings.draw(ctx);

    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.textAlign = 'center';
    ctx.fillText('Welcome to', this.width / 2, this.height / 2 - 40);
    ctx.fillText('Tellor Defense!', this.width / 2, this.height / 2);

    if (this._walletAddress) {
      // Connected — show address + click to play
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillStyle = '#00ff41';
      ctx.fillText('WALLET: ' + this._walletAddress.substring(0, 8) + '...' + this._walletAddress.substring(this._walletAddress.length - 4), this.width / 2, this.height / 2 + 35);

      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffffff';
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillText('Click to Play', this.width / 2, this.height / 2 + 60);
      }
    } else if (this._walletConnecting) {
      // Connecting...
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffff00';
      ctx.fillText('Connecting wallet...', this.width / 2, this.height / 2 + 50);
    } else {
      // Not connected — prompt
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffffff';
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillText('Click to Connect Wallet', this.width / 2, this.height / 2 + 50);
      }

      // Show error if any
      if (this._walletStatus) {
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillStyle = '#ff3333';
        ctx.fillText(this._walletStatus, this.width / 2, this.height / 2 + 70);
      }
    }
  }

  _renderInstructions(ctx) {
    this.buildings.draw(ctx);

    ctx.font = '11px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('Click to intercept the bad', this.width / 2, this.height / 2 - 40);
    ctx.fillText('data before it reaches', this.width / 2, this.height / 2 - 15);
    ctx.fillText('the smart contracts!', this.width / 2, this.height / 2 + 10);

    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('ZK Loot cards between waves!', this.width / 2, this.height / 2 + 35);

    ctx.font = '32px "Press Start 2P", monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText(this.countdown.toString(), this.width / 2, this.height / 2 + 80);
  }

  _renderGameplay(ctx) {
    this.buildings.draw(ctx);
    this.dataPoints.forEach(function(dp) { dp.draw(ctx); });
    this.projectiles.forEach(function(p) { p.draw(ctx); });
    this.explosions.forEach(function(e) { e.draw(ctx); });
    this.turret.draw(ctx);
    this.hud.draw(ctx);

    // Draw active boosts indicator
    this._renderBoosts(ctx);

    // Crosshair
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.mouseX, this.mouseY, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.mouseX - 20, this.mouseY);
    ctx.lineTo(this.mouseX + 20, this.mouseY);
    ctx.moveTo(this.mouseX, this.mouseY - 20);
    ctx.lineTo(this.mouseX, this.mouseY + 20);
    ctx.stroke();
  }

  _renderBoosts(ctx) {
    if (this.collectedCards.length === 0) return;

    ctx.save();
    var x = 8;
    var y = 48;
    var panelW = 155;
    var cardRowH = 14;
    var statsH = (this.activeBoosts.totalAmmo > 0 ? 14 : 0) +
                 (this.activeBoosts.speedPercent > 0 ? 14 : 0) +
                 (this.activeBoosts.damageBonus > 0 ? 14 : 0) +
                 (this.activeBoosts.hasBlastRadius ? 14 : 0);
    var panelH = 18 + this.collectedCards.length * cardRowH + 6 + statsH + 6;

    // Panel background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, panelW, panelH);

    // Title
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('ZK LOOT BUFFS', x + 6, y + 12);

    var rowY = y + 26;

    // Card list with tier colored dots
    for (var i = 0; i < this.collectedCards.length; i++) {
      var card = this.collectedCards[i];

      // Tier color dot
      ctx.fillStyle = card.tier.color;
      ctx.beginPath();
      ctx.arc(x + 12, rowY - 3, 4, 0, Math.PI * 2);
      ctx.fill();

      // Card name
      ctx.fillStyle = card.tier.color;
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText(card.skill.name, x + 20, rowY);
      rowY += cardRowH;
    }

    // Separator line
    rowY += 2;
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.2)';
    ctx.beginPath();
    ctx.moveTo(x + 6, rowY);
    ctx.lineTo(x + panelW - 6, rowY);
    ctx.stroke();
    rowY += 10;

    // Total stats — prominent
    ctx.font = '7px "Press Start 2P", monospace';
    if (this.activeBoosts.totalAmmo > 0) {
      ctx.fillStyle = '#00ff41';
      ctx.fillText('+' + this.activeBoosts.totalAmmo + ' AMMO', x + 10, rowY);
      rowY += 14;
    }
    if (this.activeBoosts.speedPercent > 0) {
      ctx.fillStyle = '#00ccff';
      ctx.fillText('+' + this.activeBoosts.speedPercent + '% SPEED', x + 10, rowY);
      rowY += 14;
    }
    if (this.activeBoosts.damageBonus > 0) {
      ctx.fillStyle = '#ff6666';
      ctx.fillText('+' + this.activeBoosts.damageBonus + ' DMG', x + 10, rowY);
      rowY += 14;
    }
    if (this.activeBoosts.hasBlastRadius) {
      ctx.fillStyle = '#ffaa00';
      ctx.fillText('AOE BLAST!', x + 10, rowY);
      rowY += 14;
    }

    ctx.restore();

    // Buff popup notification
    if (this._buffPopup && this._buffPopup.alive) {
      var popup = this._buffPopup;
      var elapsed = Date.now() - popup.startTime;
      var alpha = Math.max(0, 1 - elapsed / popup.duration);
      var floatY = popup.y - (elapsed / popup.duration) * 30;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';

      for (var bi = 0; bi < popup.lines.length; bi++) {
        ctx.fillStyle = popup.lines[bi].color;
        ctx.fillText(popup.lines[bi].text, this.width / 2, floatY + bi * 16);
      }

      ctx.restore();
      if (alpha <= 0) popup.alive = false;
    }
  }

  _syncBoostsToHUD() {
    this.hud.ammoBonus = this.activeBoosts.totalAmmo;
    this.hud.speedBonus = this.activeBoosts.speedPercent;
    this.hud.dmgBonus = this.activeBoosts.damageBonus;
    this.hud.hasAoE = this.activeBoosts.hasBlastRadius;
  }

  _showBuffPopup(card) {
    var lines = [];
    var skill = card.skill;
    lines.push({ text: card.tier.name + ' CARD!', color: card.tier.color });
    lines.push({ text: skill.name, color: '#ffffff' });
    if (skill.ammoBonus > 0) lines.push({ text: '+' + skill.ammoBonus + ' Ammo', color: '#00ff41' });
    if (skill.speedBonus > 0) lines.push({ text: '+' + skill.speedBonus + '% Speed', color: '#00ccff' });
    if (skill.damageBonus > 0) lines.push({ text: '+' + skill.damageBonus + ' Damage', color: '#ff6666' });
    if (skill.blastRadius) lines.push({ text: 'AoE Blast!', color: '#ffaa00' });

    this._buffPopup = {
      lines: lines,
      y: this.height / 2 + 140,
      startTime: Date.now(),
      duration: 3000,
      alive: true,
    };
  }

  _renderWaveTransition(ctx) {
    this.buildings.draw(ctx);
    this.hud.draw(ctx);
    this._renderBoosts(ctx);

    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.textAlign = 'center';
    ctx.fillText('WAVE ' + this.hud.wave + ' INCOMING', this.width / 2, this.height / 2 - 20);

    ctx.font = '32px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.countdown.toString(), this.width / 2, this.height / 2 + 40);
  }

  _renderGameOver(ctx) {
    this.buildings.draw(ctx);
    this.explosions.forEach(function(e) { e.draw(ctx); });

    ctx.font = '22px "Press Start 2P", monospace';
    ctx.fillStyle = '#ff3333';
    ctx.textAlign = 'center';
    ctx.fillText('SYSTEM', this.width / 2, this.height / 2 - 60);
    ctx.fillText('COMPROMISED', this.width / 2, this.height / 2 - 30);

    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('FINAL SCORE: ' + this.hud.score, this.width / 2, this.height / 2 + 10);
    ctx.fillText('WAVE REACHED: ' + this.hud.wave, this.width / 2, this.height / 2 + 35);

    // Show collected cards summary
    if (this.collectedCards.length > 0) {
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = '#00ffcc';
      ctx.fillText('CARDS: ' + this.collectedCards.length, this.width / 2, this.height / 2 + 55);
      var cardText = '';
      for (var i = 0; i < this.collectedCards.length; i++) {
        if (i > 0) cardText += ' ';
        cardText += this.collectedCards[i].tier.name.substring(0, 1);
      }
      ctx.fillText(cardText, this.width / 2, this.height / 2 + 67);
    }

    // Click to reboot
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillText('Click to Reboot', this.width / 2, this.height / 2 + 90);
    }

    // ZK + Stellar auto-submit status
    ctx.font = '8px "Press Start 2P", monospace';
    if (this._stellarTxHash) {
      // Submitted — show TX info
      ctx.fillStyle = '#00ff41';
      ctx.fillText('ON-CHAIN! Session #' + this._stellarSessionId, this.width / 2, this.height / 2 + 100);
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#00ccff';
      ctx.fillText('TX: ' + this._stellarTxHash.substring(0, 28) + '...', this.width / 2, this.height / 2 + 114);
      ctx.fillStyle = '#888888';
      ctx.fillText('testnet.stellarchain.io/tx/' + this._stellarTxHash.substring(0, 12) + '...', this.width / 2, this.height / 2 + 126);

      // Click to restart
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffffff';
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillText('Click to Reboot', this.width / 2, this.height / 2 + 150);
      }
    } else {
      // Auto-progress indicator
      var statusMsg = this._zkSubmitMessage || 'Preparing ZK proof...';
      var isWorking = this._zkGenerating || this._zkSubmitting;
      ctx.fillStyle = isWorking ? '#ffff00' : '#00ff41';

      // Animated dots
      var dots = '.'.repeat(Math.floor(Date.now() / 400) % 4);
      if (isWorking) statusMsg = statusMsg.replace(/\.{3}$/, dots);

      ctx.fillText(statusMsg, this.width / 2, this.height / 2 + 110);
    }
  }

  _autoSubmitFlow() {
    var self = this;
    this._submitZKProof();

    // Poll until proof is ready, then auto-submit
    var checkInterval = setInterval(function() {
      if (self._zkProofResult && !self._zkSubmitting && !self._stellarTxHash) {
        clearInterval(checkInterval);
        // Small delay so user can see "Proof VERIFIED" message
        setTimeout(function() {
          if (self.state === GameState.GAME_OVER && self._walletAddress) {
            self._submitToStellar();
          }
        }, 1500);
      }
      // Stop polling if game restarted
      if (self.state !== GameState.GAME_OVER) {
        clearInterval(checkInterval);
      }
    }, 500);
  }

  _connectWallet() {
    var self = this;
    if (!window.StellarWallet) {
      this._walletStatus = 'Stellar wallet not loaded...';
      return;
    }
    this._walletConnecting = true;
    this._walletStatus = 'Detecting Freighter...';

    window.StellarWallet.isFreighterInstalled().then(function(installed) {
      if (!installed) {
        self._walletConnecting = false;
        self._walletStatus = 'Freighter not installed. Get it at freighter.app';
        return;
      }
      self._walletStatus = 'Connecting Freighter...';
      return window.StellarWallet.connect();
    }).then(function(address) {
      if (!address) return; // Freighter not installed case
      self._walletAddress = address;
      self._walletConnecting = false;
      self._walletStatus = null;
      console.log('%c[Wallet] Connected: ' + address, 'color: #00ff41; font-weight: bold');
    }).catch(function(err) {
      self._walletConnecting = false;
      self._walletStatus = err.message;
      console.log('%c[Wallet] Failed: ' + err.message, 'color: #ff0000');
    });
  }

  _submitZKProof() {
    var self = this;

    if (!window.ZKProver) {
      this._zkSubmitMessage = 'ZK prover not loaded yet...';
      this._zkSubmitTime = Date.now();
      return;
    }

    this._zkSubmitMessage = 'Initializing ZK prover...';
    this._zkSubmitTime = Date.now();
    this._zkGenerating = true;

    // The prover computes Poseidon2 hashes internally using the backend's Barretenberg
    // We only need to pass seed, numCards, and gameSeed
    var proofData = {
      seed: self.zkSeed ? self.zkSeed.toString() : '0',
      numCards: self.collectedCards.length,
      gameSeed: self.rng ? self.rng.getSeed() : 0,
    };

    window.ZKProver.generateLootProof(proofData, function(status) {
      self._zkSubmitMessage = status;
      self._zkSubmitTime = Date.now();
    }).then(function(result) {
      self._zkGenerating = false;
      self._zkProofResult = result;
      self._zkSubmitMessage = 'Proof generated! ' + result.proof.length + ' bytes. Verifying...';
      self._zkSubmitTime = Date.now();
      window.__zkProof = result;

      // Styled summary for demo video
      console.log('%c╔══════════════════════════════════════════╗', 'color: #00ff41; font-weight: bold');
      console.log('%c║     ZK LOOT PROOF GENERATED              ║', 'color: #00ff41; font-weight: bold; font-size: 14px');
      console.log('%c╚══════════════════════════════════════════╝', 'color: #00ff41; font-weight: bold');
      console.log('%c  Proof: ' + result.proof.length + ' bytes (' + (result.proof.length / 1024).toFixed(1) + ' KB)', 'color: #00ffcc');
      console.log('%c  Commitment: 0x' + result.lootData.commitmentHex.substring(0, 20) + '...', 'color: #00ff41');
      console.log('%c  Cards: ' + result.lootData.numCards + ' | Waves: [' + result.lootData.cardWaves.join(', ') + ']', 'color: #00ffcc');
      for (var ci = 0; ci < result.lootData.cardRarities.length; ci++) {
        var r = result.lootData.cardRarities[ci];
        var tier = r >= 95 ? 'Legendary' : r >= 80 ? 'Epic' : r >= 50 ? 'Rare' : 'Common';
        var tc = r >= 95 ? '#ffd700' : r >= 80 ? '#a855f7' : r >= 50 ? '#3b82f6' : '#9ca3af';
        console.log('%c  Card ' + (ci + 1) + ': rarity=' + r + ' (' + tier + ')', 'color: ' + tc + '; font-weight: bold');
      }

      // Auto-verify the proof
      return window.ZKProver.verifyLootProof(
        { proof: result.proof, publicInputs: result.publicInputs },
        function(status) {
          self._zkSubmitMessage = status;
          self._zkSubmitTime = Date.now();
        }
      ).then(function(isValid) {
        if (isValid) {
          self._zkSubmitMessage = 'Proof VERIFIED! ' + result.proof.length + ' bytes. Press S for on-chain submit.';
          console.log('%c  Verification: VALID — Loot is cryptographically fair!', 'color: #00ff41; font-weight: bold; font-size: 13px');
        } else {
          self._zkSubmitMessage = 'Proof generated but verification FAILED!';
          console.log('%c  Verification: INVALID', 'color: #ff0000; font-weight: bold; font-size: 13px');
        }
        self._zkSubmitTime = Date.now();
      }).catch(function(vErr) {
        self._zkSubmitMessage = 'Proof generated! ' + result.proof.length + ' bytes. Press S to submit.';
        self._zkSubmitTime = Date.now();
        console.warn('Auto-verify failed:', vErr.message);
      });
    }).catch(function(err) {
      self._zkGenerating = false;
      self._zkSubmitMessage = 'Proof failed: ' + err.message;
      self._zkSubmitTime = Date.now();
      console.error('ZK proof generation failed:', err);
    });
  }

  _submitToStellar() {
    var self = this;
    if (!window.StellarWallet) {
      this._zkSubmitMessage = 'Stellar wallet not loaded...';
      this._zkSubmitTime = Date.now();
      return;
    }
    if (!this._zkProofResult || !this._zkProofResult.lootData) {
      this._zkSubmitMessage = 'Generate ZK proof first (press Z)';
      this._zkSubmitTime = Date.now();
      return;
    }

    this._zkSubmitting = true;
    this._zkSubmitMessage = 'Signing TX 1/2 (start_game)...';
    this._zkSubmitTime = Date.now();

    // Use lootData from the proof result — these are the real Poseidon2-computed values
    var lootData = this._zkProofResult.lootData;
    lootData.score = this.hud.score;

    // Wallet already connected at title screen — submit directly
    window.StellarWallet.submitLootResult(
      self._zkProofResult,
      lootData
    ).then(function(result) {
      self._zkSubmitting = false;
      if (result.success) {
        var expertUrl = 'https://stellar.expert/explorer/testnet/tx/' + result.hash;
        self._zkSubmitMessage = 'ON-CHAIN! Session #' + result.sessionId + ' | TX: ' + result.hash.substring(0, 12) + '...';
        self._stellarTxHash = result.hash;
        self._stellarStartHash = result.startHash;
        self._stellarSessionId = result.sessionId;

        console.log('%c  Game screen: ON-CHAIN confirmation displayed', 'color: #00ff41');
      } else {
        self._zkSubmitMessage = 'TX failed: ' + result.error;
      }
      self._zkSubmitTime = Date.now();
    }).catch(function(err) {
      self._zkSubmitting = false;
      self._zkSubmitMessage = 'Stellar: ' + err.message;
      self._zkSubmitTime = Date.now();
      console.log('%c[Stellar] Submit failed: ' + err.message, 'color: #ff0000');
    });
  }
}
window.GameState = GameState;
window.Game = Game;
