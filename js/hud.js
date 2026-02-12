class HUD {
  constructor(canvasWidth) {
    this.canvasWidth = canvasWidth;
    this.score = 0;
    this.ammo = 10;
    this.maxAmmo = 10;
    this.wave = 1;
    this.soundOn = true;
    this.ammoBonus = 0;  // from loot cards
    this.speedBonus = 0;
    this.dmgBonus = 0;
    this.hasAoE = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.font = '12px "Press Start 2P", monospace';

    // SCORE - top left
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + this.score, 15, 25);

    // AMMO - top center with bonus indicator
    ctx.textAlign = 'center';
    var ammoColor = this.ammo > 3 ? '#ffffff' : '#ff3333';
    ctx.fillStyle = ammoColor;
    var ammoText = 'AMMO: ' + this.ammo;
    ctx.fillText(ammoText, this.canvasWidth / 2, 25);

    // Show bonus next to ammo if active
    if (this.ammoBonus > 0) {
      var ammoW = ctx.measureText(ammoText).width;
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = '#00ff41';
      ctx.textAlign = 'left';
      ctx.fillText('+' + this.ammoBonus, this.canvasWidth / 2 + ammoW / 2 + 4, 25);
    }

    // WAVE - top right
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('WAVE: ' + this.wave, this.canvasWidth - 15, 25);

    // Speed/Dmg/AoE indicators below wave
    ctx.font = '7px "Press Start 2P", monospace';
    var indicatorY = 38;
    if (this.speedBonus > 0) {
      ctx.fillStyle = '#00ccff';
      ctx.fillText('SPD+' + this.speedBonus + '%', this.canvasWidth - 15, indicatorY);
      indicatorY += 11;
    }
    if (this.dmgBonus > 0) {
      ctx.fillStyle = '#ff6666';
      ctx.fillText('DMG+' + this.dmgBonus, this.canvasWidth - 15, indicatorY);
      indicatorY += 11;
    }
    if (this.hasAoE) {
      ctx.fillStyle = '#ffaa00';
      ctx.fillText('AOE', this.canvasWidth - 15, indicatorY);
      indicatorY += 11;
    }

    // Sound indicator
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText('[M] SOUND: ' + (this.soundOn ? 'ON' : 'OFF'), this.canvasWidth - 15, Math.max(indicatorY, 40));

    ctx.restore();
  }

  reset() {
    this.score = 0;
    this.ammo = 10;
    this.maxAmmo = 10;
    this.wave = 1;
  }
}
window.HUD = HUD;
