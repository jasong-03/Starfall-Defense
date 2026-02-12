class Projectile {
  constructor(startX, startY, targetX, targetY, speed) {
    this.x = startX;
    this.y = startY;
    this.speed = speed || 8;
    this.alive = true;
    this.radius = 2;

    // Calculate direction
    var dx = targetX - startX;
    var dy = targetY - startY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    this.vx = (dx / dist) * this.speed;
    this.vy = (dy / dist) * this.speed;

    // Store target for line drawing
    this.targetX = targetX;
    this.targetY = targetY;
    this.startX = startX;
    this.startY = startY;

    // Trail
    this.trail = [];
    this.maxTrailLength = 8;
  }

  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) this.trail.shift();

    this.x += this.vx;
    this.y += this.vy;

    // Check if reached target area or off screen
    var dx = this.x - this.targetX;
    var dy = this.y - this.targetY;
    if (Math.sqrt(dx * dx + dy * dy) < 10) {
      this.alive = false;
    }
  }

  draw(ctx) {
    if (!this.alive) return;

    // Draw trail (green laser line)
    if (this.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (var i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.lineTo(this.x, this.y);
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw projectile head
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff66';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  isOffScreen(canvasWidth, canvasHeight) {
    return this.x < -10 || this.x > canvasWidth + 10 ||
           this.y < -10 || this.y > canvasHeight + 10;
  }
}
window.Projectile = Projectile;
