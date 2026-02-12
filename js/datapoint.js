var REAL_PRICES = {
  TRB: { price: 15.58, symbol: 'TRB' },
  ETH: { price: 2054, symbol: 'ETH' },
  BTC: { price: 68803, symbol: 'BTC' }
};

class DataPoint {
  constructor(canvasWidth, isBad, speed, rng) {
    var r = rng ? function() { return rng.next(); } : Math.random;
    this.x = 30 + r() * (canvasWidth - 60);
    this.y = -20;
    this.speed = speed || (0.5 + r() * 1);
    this.isBad = isBad;
    this.alive = true;
    this.radius = 4;

    // Pick random token
    var tokens = Object.keys(REAL_PRICES);
    var token = tokens[Math.floor(r() * tokens.length)];
    this.token = REAL_PRICES[token];

    if (isBad) {
      // Generate wrong price: either way too low (5-30%) or way too high (200-500%)
      var factor = r() > 0.5
        ? 0.05 + r() * 0.25
        : 2 + r() * 3;
      this.price = (this.token.price * factor).toFixed(2);
      this.color = '#ff3333';
      this.glowColor = 'rgba(255, 50, 50, 0.6)';
    } else {
      // Slight natural variation for good data (+/- 0.5%)
      var variation = 1 + (r() - 0.5) * 0.01;
      this.price = (this.token.price * variation).toFixed(2);
      this.color = '#00ffcc';
      this.glowColor = 'rgba(0, 255, 200, 0.4)';
    }

    this.label = this.token.symbol + ' $' + this.price;
  }

  update() {
    this.y += this.speed;
  }

  draw(ctx) {
    if (!this.alive) return;

    // Glow effect
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = 8;

    // Dot
    ctx.beginPath();
    ctx.arc(this.x, this.y + 12, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // Label
    ctx.shadowBlur = 0;
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.fillText(this.label, this.x, this.y);

    ctx.shadowBlur = 0;
  }

  isOffScreen(canvasHeight) {
    return this.y > canvasHeight + 20;
  }
}
window.REAL_PRICES = REAL_PRICES;
window.DataPoint = DataPoint;
