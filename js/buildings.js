class Buildings {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.buildings = [];
    this.health = 5; // max 5 hits before game over
    this.maxHealth = 5;

    // Create 7 buildings evenly spaced along the bottom
    var count = 7;
    var spacing = canvasWidth / (count + 1);
    for (var i = 0; i < count; i++) {
      this.buildings.push({
        x: spacing * (i + 1),
        y: canvasHeight - 40,
        width: 40 + Math.random() * 20,
        height: 35 + Math.random() * 15,
        type: Math.floor(Math.random() * 4), // different building styles
        damaged: false,
        color: this._randomBuildingColor()
      });
    }
  }

  _randomBuildingColor() {
    var colors = ['#2a1f3d', '#1f2d3d', '#2d1f1f', '#1f3d2d', '#3d2d1f'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  takeDamage() {
    this.health--;
    // Damage a random building
    var intact = this.buildings.filter(function(b) { return !b.damaged; });
    if (intact.length > 0) {
      intact[Math.floor(Math.random() * intact.length)].damaged = true;
    }
    return this.health <= 0;
  }

  reset() {
    this.health = this.maxHealth;
    this.buildings.forEach(function(b) { b.damaged = false; });
  }

  draw(ctx) {
    this.buildings.forEach(function(b) {
      ctx.save();

      if (b.damaged) {
        ctx.globalAlpha = 0.4;
      }

      var x = b.x - b.width / 2;
      var y = b.y;

      // Main building body
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, b.width, b.height);

      // Building details based on type
      switch (b.type) {
        case 0: // Server rack
          ctx.fillStyle = '#0a2a0a';
          ctx.fillRect(x + 3, y + 3, b.width - 6, b.height - 6);
          // LED rows
          for (var row = 0; row < 4; row++) {
            ctx.fillStyle = b.damaged ? '#331111' : '#00ff41';
            ctx.fillRect(x + 6, y + 6 + row * 8, 3, 2);
            ctx.fillStyle = b.damaged ? '#331111' : '#ffaa00';
            ctx.fillRect(x + 11, y + 6 + row * 8, 3, 2);
          }
          break;
        case 1: // Tower
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(x + b.width / 4, y - 10, b.width / 2, 10);
          // Antenna
          ctx.strokeStyle = b.damaged ? '#333' : '#00ff41';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(b.x, y - 10);
          ctx.lineTo(b.x, y - 20);
          ctx.stroke();
          // Blinking light
          if (!b.damaged) {
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(b.x - 1, y - 21, 3, 3);
          }
          break;
        case 2: // Data center
          ctx.fillStyle = '#0f1923';
          ctx.fillRect(x + 2, y + 2, b.width - 4, b.height - 4);
          // Window grid
          for (var wy = 0; wy < 3; wy++) {
            for (var wx = 0; wx < 3; wx++) {
              ctx.fillStyle = b.damaged ? '#1a1a1a' : '#003366';
              ctx.fillRect(x + 5 + wx * 12, y + 5 + wy * 10, 8, 6);
            }
          }
          break;
        case 3: // Blockchain node
          ctx.fillStyle = '#1a0a2e';
          ctx.fillRect(x + 2, y + 2, b.width - 4, b.height - 4);
          // Chain links
          ctx.strokeStyle = b.damaged ? '#333' : '#9966ff';
          ctx.lineWidth = 1;
          for (var ci = 0; ci < 3; ci++) {
            ctx.strokeRect(x + 8 + ci * 10, y + 8, 8, 8);
          }
          break;
      }

      // Top border highlight
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x, y, b.width, 2);

      ctx.restore();
    });

    // Draw health bar
    var barWidth = 100;
    var barX = this.canvasWidth / 2 - barWidth / 2;
    var barY = this.canvasHeight - 28;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, 6);

    var healthPct = this.health / this.maxHealth;
    var hpColor = healthPct > 0.6 ? '#00ff41' : healthPct > 0.3 ? '#ffaa00' : '#ff3333';
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barWidth * healthPct, 6);
  }
}
window.Buildings = Buildings;
