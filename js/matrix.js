/**
 * MatrixRain - Digital rain background effect for Tellor Defense
 * Renders falling katakana/latin/number characters in green on a dark canvas.
 */
class MatrixRain {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.fontSize = 14;
    this.columns = Math.min(Math.floor(width / this.fontSize), 30);
    this.columnWidth = width / this.columns;

    // Each drop tracks: y position, speed, trail length
    this.drops = [];
    for (var i = 0; i < this.columns; i++) {
      this.drops.push({
        y: Math.random() * this.height / this.fontSize,
        speed: 0.3 + Math.random() * 0.7,
        trail: 8 + Math.floor(Math.random() * 12)
      });
    }

    // Pre-build a character pool for variety
    this.charPool = [];
    // Katakana (primary)
    for (var c = 0x30A0; c <= 0x30FF; c++) {
      this.charPool.push(String.fromCharCode(c));
    }
    // Some digits
    for (var d = 0; d <= 9; d++) {
      this.charPool.push(String(d));
    }
    // Some latin chars
    var latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var l = 0; l < latin.length; l++) {
      this.charPool.push(latin[l]);
    }

    // Store a grid of characters so trails show consistent chars that change occasionally
    this.charGrid = [];
    var rows = Math.ceil(this.height / this.fontSize) + 2;
    for (var ci = 0; ci < this.columns; ci++) {
      this.charGrid[ci] = [];
      for (var ri = 0; ri < rows; ri++) {
        this.charGrid[ci][ri] = this._randomChar();
      }
    }
  }

  _randomChar() {
    return this.charPool[Math.floor(Math.random() * this.charPool.length)];
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    var newColumns = Math.min(Math.floor(width / this.fontSize), 30);
    this.columnWidth = width / newColumns;

    // Add or remove columns as needed
    while (this.drops.length < newColumns) {
      this.drops.push({
        y: Math.random() * height / this.fontSize,
        speed: 0.3 + Math.random() * 0.7,
        trail: 8 + Math.floor(Math.random() * 12)
      });
    }
    this.drops.length = newColumns;
    this.columns = newColumns;

    // Rebuild char grid
    var rows = Math.ceil(height / this.fontSize) + 2;
    this.charGrid = [];
    for (var ci = 0; ci < this.columns; ci++) {
      this.charGrid[ci] = [];
      for (var ri = 0; ri < rows; ri++) {
        this.charGrid[ci][ri] = this._randomChar();
      }
    }
  }

  update() {
    var maxRow = Math.ceil(this.height / this.fontSize);
    for (var i = 0; i < this.columns; i++) {
      var drop = this.drops[i];
      drop.y += drop.speed;

      // Randomly mutate a character in the trail for the flickering effect
      if (Math.random() < 0.02) {
        var mutateRow = Math.floor(drop.y) - Math.floor(Math.random() * drop.trail);
        if (mutateRow >= 0 && mutateRow < (this.charGrid[i] ? this.charGrid[i].length : 0)) {
          this.charGrid[i][mutateRow] = this._randomChar();
        }
      }

      // Reset drop when it falls past the bottom (with random chance for stagger)
      if (drop.y * this.fontSize > this.height + drop.trail * this.fontSize) {
        if (Math.random() > 0.975) {
          drop.y = -Math.floor(Math.random() * 6);
          drop.speed = 0.3 + Math.random() * 0.7;
          drop.trail = 8 + Math.floor(Math.random() * 12);

          // Refresh chars for this column
          var rows = this.charGrid[i] ? this.charGrid[i].length : maxRow + 2;
          for (var r = 0; r < rows; r++) {
            this.charGrid[i][r] = this._randomChar();
          }
        }
      }

      // Update the head character
      var headRow = Math.floor(drop.y);
      if (headRow >= 0 && this.charGrid[i] && headRow < this.charGrid[i].length) {
        this.charGrid[i][headRow] = this._randomChar();
      }
    }
  }

  draw(ctx) {
    ctx.font = this.fontSize + 'px monospace';
    ctx.textAlign = 'center';

    for (var i = 0; i < this.columns; i++) {
      var drop = this.drops[i];
      var headRow = Math.floor(drop.y);
      var x = i * this.columnWidth + this.columnWidth / 2;

      // Draw trail characters (from tail to head)
      for (var t = drop.trail; t >= 0; t--) {
        var row = headRow - t;
        if (row < 0) continue;

        var py = row * this.fontSize;
        if (py > this.height) continue;

        // Get character from grid, fallback to random
        var ch;
        if (this.charGrid[i] && row < this.charGrid[i].length) {
          ch = this.charGrid[i][row];
        } else {
          ch = this._randomChar();
        }

        if (t === 0) {
          // Head of the trail: bright white-green
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.9;
        } else if (t === 1) {
          // Just behind head: bright green
          ctx.fillStyle = '#00ff41';
          ctx.globalAlpha = 0.85;
        } else if (t <= 3) {
          // Near head: green
          ctx.fillStyle = '#00ff41';
          ctx.globalAlpha = 0.6;
        } else {
          // Trail body: fading green
          var fade = 1 - (t / drop.trail);
          ctx.fillStyle = '#0f0';
          ctx.globalAlpha = Math.max(0.05, fade * 0.4);
        }

        ctx.fillText(ch, x, py);
      }
    }

    // Reset alpha
    ctx.globalAlpha = 1.0;
  }
}

window.MatrixRain = MatrixRain;
