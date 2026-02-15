(function() {
  var canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('Canvas not found!');
    return;
  }

  var game = new Game(canvas);
  window._game = game; // Expose for debugging/testing

  // Hide cursor over canvas
  canvas.style.cursor = 'none';

  function gameLoop() {
    game.update();
    game.render();
    requestAnimationFrame(gameLoop);
  }

  // Start the loop
  requestAnimationFrame(gameLoop);

  console.log('Starfall Defense loaded! Click to start.');
})();
