// Card Reveal UI - Canvas-based card flip animation between waves
// Shows the loot card with rarity tier, skill name, and stat boosts

class CardRevealUI {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.card = null;
    this.revealProgress = 0; // 0 = face down, 1 = fully revealed
    this.startTime = 0;
    this.flipDuration = 1200; // ms for flip animation
    this.holdDuration = 5000; // ms to show card before auto-dismiss
    this.phase = 'idle'; // idle, flipping, showing, done
  }

  // Start revealing a card
  reveal(card) {
    this.card = card;
    this.revealProgress = 0;
    this.startTime = Date.now();
    this.phase = 'flipping';
  }

  // Update animation state. Returns true when done.
  update() {
    if (this.phase === 'idle' || this.phase === 'done') return this.phase === 'done';

    var elapsed = Date.now() - this.startTime;

    if (this.phase === 'flipping') {
      this.revealProgress = Math.min(elapsed / this.flipDuration, 1);
      if (this.revealProgress >= 1) {
        this.phase = 'showing';
        this.startTime = Date.now();
      }
    } else if (this.phase === 'showing') {
      if (elapsed > this.holdDuration) {
        this.phase = 'done';
        return true;
      }
    }
    return false;
  }

  // Skip to done (on click)
  skip() {
    if (this.phase === 'flipping' || this.phase === 'showing') {
      this.phase = 'done';
    }
  }

  // Draw the card reveal
  draw(ctx) {
    if (!this.card || this.phase === 'idle' || this.phase === 'done') return;

    var cx = this.canvasWidth / 2;
    var cy = this.canvasHeight / 2 - 20;
    var cardW = 180;
    var cardH = 240;

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Title
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('LOOT CARD REVEALED!', cx, cy - cardH / 2 - 30);

    // Flip animation: scale X based on progress
    var scaleX;
    if (this.revealProgress < 0.5) {
      // First half: shrink card face-down
      scaleX = 1 - this.revealProgress * 2;
      this._drawCardBack(ctx, cx, cy, cardW * scaleX, cardH);
    } else {
      // Second half: expand card face-up
      scaleX = (this.revealProgress - 0.5) * 2;
      this._drawCardFront(ctx, cx, cy, cardW * scaleX, cardH);
    }

    // "Click to continue" hint
    if (this.phase === 'showing') {
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = '#888888';
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillText('Click to continue', cx, cy + cardH / 2 + 30);
      }
    }
  }

  _drawCardBack(ctx, cx, cy, w, h) {
    if (w < 2) return;
    var x = cx - w / 2;
    var y = cy - h / 2;

    // Card border
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Card background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

    // ZK pattern on back
    ctx.font = '10px monospace';
    ctx.fillStyle = '#333355';
    ctx.textAlign = 'center';
    if (w > 30) {
      ctx.fillText('ZK', cx, cy - 10);
      ctx.fillText('?', cx, cy + 15);
    }
  }

  _drawCardFront(ctx, cx, cy, w, h) {
    if (w < 2) return;
    var card = this.card;
    var tier = card.tier;
    var skill = card.skill;

    var x = cx - w / 2;
    var y = cy - h / 2;

    // Glow effect for rare+ cards
    if (tier.name !== 'COMMON') {
      ctx.shadowColor = tier.color;
      ctx.shadowBlur = 15;
    }

    // Card border with tier color
    ctx.strokeStyle = tier.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;

    // Card background
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

    // Only draw text if card is wide enough
    if (w < 80) return;

    // Rarity tier banner at top
    ctx.fillStyle = tier.color;
    ctx.fillRect(x + 2, y + 2, w - 4, 30);

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(tier.name, cx, y + 20);

    // Rarity number
    ctx.font = '32px "Press Start 2P", monospace';
    ctx.fillStyle = tier.color;
    ctx.fillText(card.rarity.toString(), cx, cy - 20);

    // Skill name
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(skill.name, cx, cy + 15);

    // Skill description
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(skill.description, cx, cy + 35);

    // Wave indicator at bottom
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#666666';
    ctx.fillText('Wave ' + card.wave, cx, y + h - 12);
  }

  reset() {
    this.card = null;
    this.phase = 'idle';
    this.revealProgress = 0;
  }
}

window.CardRevealUI = CardRevealUI;
