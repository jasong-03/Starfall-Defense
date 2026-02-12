class Explosion {
  constructor(x, y, isGoodHit) {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.maxRadius = isGoodHit ? 25 : 35;
    this.alpha = 1;
    this.alive = true;
    this.growSpeed = 2;
    this.isGoodHit = isGoodHit;
    // Good hit (shot bad data) = orange explosion
    // Bad hit (shot good data) = red flash
    this.color = isGoodHit ? '255, 165, 0' : '255, 0, 0';
  }

  update() {
    this.radius += this.growSpeed;
    this.alpha -= 0.04;
    if (this.alpha <= 0 || this.radius >= this.maxRadius) {
      this.alive = false;
    }
  }

  draw(ctx) {
    if (!this.alive) return;

    // Outer glow
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + this.color + ', ' + (this.alpha * 0.3) + ')';
    ctx.fill();

    // Inner bright core
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + this.color + ', ' + (this.alpha * 0.7) + ')';
    ctx.fill();

    // Center flash
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, ' + this.alpha + ')';
    ctx.fill();
  }
}
window.Explosion = Explosion;
