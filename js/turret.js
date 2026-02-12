class Turret {
  constructor(canvasWidth, canvasHeight) {
    this.x = canvasWidth / 2;
    this.y = canvasHeight - 70; // above the buildings
    this.angle = -Math.PI / 2; // pointing up by default
    this.barrelLength = 30;
    this.baseWidth = 20;
    this.baseHeight = 15;
  }

  aimAt(mouseX, mouseY) {
    this.angle = Math.atan2(mouseY - this.y, mouseX - this.x);
    // Clamp to upper hemisphere only (can't aim downward)
    if (this.angle > 0) {
      this.angle = this.angle < Math.PI / 2 ? 0 : -Math.PI;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Draw base (dark green rectangle/trapezoid)
    ctx.fillStyle = '#1a5c1a';
    ctx.fillRect(-this.baseWidth / 2, -5, this.baseWidth, this.baseHeight);

    // Draw rotating barrel
    ctx.rotate(this.angle);
    ctx.fillStyle = '#2d8e2d';
    ctx.fillRect(0, -3, this.barrelLength, 6);

    // Barrel tip
    ctx.fillStyle = '#3cb043';
    ctx.fillRect(this.barrelLength - 4, -4, 8, 8);

    ctx.restore();

    // Draw Tellor-like logo circle on base
    ctx.beginPath();
    ctx.arc(this.x, this.y + 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#1a5c1a';
    ctx.fill();
    ctx.strokeStyle = '#3cb043';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  getBarrelTip() {
    return {
      x: this.x + Math.cos(this.angle) * this.barrelLength,
      y: this.y + Math.sin(this.angle) * this.barrelLength
    };
  }
}
window.Turret = Turret;
