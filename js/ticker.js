class Ticker {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.x = canvasWidth; // start off-screen right
    this.speed = 0.5;
    this.text = 'TELLOR PRICE   TRB/USD $15.58   |   ETH/USD $2054   |   BTC/USD $68803   |   ';
    this.textWidth = 0;
  }

  update() {
    this.x -= this.speed;
    // Reset when fully scrolled past
    if (this.x < -this.textWidth) {
      this.x = this.canvasWidth;
    }
  }

  draw(ctx) {
    ctx.save();

    // Ticker background bar
    var barY = this.canvasHeight - 18;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, barY, this.canvasWidth, 18);

    // Top border of ticker
    ctx.fillStyle = '#00ff41';
    ctx.fillRect(0, barY, this.canvasWidth, 1);

    // Ticker text
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#00ff41';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Recalculate text width (handles font loading delay)
    this.textWidth = ctx.measureText(this.text).width;
    if (this.textWidth === 0) this.textWidth = 600; // fallback

    // Draw text (and repeat for seamless scroll)
    ctx.fillText(this.text, this.x, barY + 10);
    ctx.fillText(this.text, this.x + this.textWidth, barY + 10);

    ctx.restore();
  }
}
window.Ticker = Ticker;
