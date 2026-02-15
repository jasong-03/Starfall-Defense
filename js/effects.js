import { animate, stagger } from 'motion';

// ============================================================
//  Starfall Defense — Visual Effects System
//  Background particles, cursor glow, CRT power-on, screen shake
// ============================================================

class StarfieldCanvas {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'starfield';
    this.ctx = this.canvas.getContext('2d');
    this.stars = [];
    this.shootingStars = [];
    this.lastShootingStar = 0;

    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '-1',
      pointerEvents: 'none',
    });

    document.body.insertBefore(this.canvas, document.body.firstChild);
    this._resize();
    this._initStars();

    window.addEventListener('resize', () => this._resize());
    this._animate();
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this._initStars();
  }

  _initStars() {
    this.stars = [];
    var count = Math.floor((this.canvas.width * this.canvas.height) / 3000);
    for (var i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.3 + 0.05,
        opacity: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        color: this._starColor(),
      });
    }
  }

  _starColor() {
    var r = Math.random();
    if (r < 0.6) return { r: 180, g: 220, b: 255 }; // blue-white
    if (r < 0.8) return { r: 255, g: 240, b: 200 }; // warm white
    if (r < 0.9) return { r: 100, g: 255, b: 180 }; // green tint
    return { r: 200, g: 150, b: 255 };                // purple tint
  }

  _spawnShootingStar() {
    this.shootingStars.push({
      x: Math.random() * this.canvas.width * 0.8,
      y: Math.random() * this.canvas.height * 0.4,
      vx: 4 + Math.random() * 6,
      vy: 2 + Math.random() * 3,
      life: 1.0,
      decay: 0.01 + Math.random() * 0.02,
      length: 40 + Math.random() * 60,
    });
  }

  _animate() {
    var ctx = this.ctx;
    var now = Date.now();

    ctx.fillStyle = 'rgba(5, 5, 15, 0.15)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Stars
    for (var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i];
      s.twinklePhase += s.twinkleSpeed;
      var twinkle = (Math.sin(s.twinklePhase) + 1) * 0.5;
      var alpha = s.opacity * (0.3 + twinkle * 0.7);

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (0.8 + twinkle * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + s.color.r + ',' + s.color.g + ',' + s.color.b + ',' + alpha + ')';
      ctx.fill();

      // Glow for brighter stars
      if (s.size > 1.2) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + s.color.r + ',' + s.color.g + ',' + s.color.b + ',' + (alpha * 0.1) + ')';
        ctx.fill();
      }

      s.y += s.speed;
      if (s.y > this.canvas.height + 5) {
        s.y = -5;
        s.x = Math.random() * this.canvas.width;
      }
    }

    // Shooting stars
    if (now - this.lastShootingStar > 4000 + Math.random() * 8000) {
      this._spawnShootingStar();
      this.lastShootingStar = now;
    }

    for (var j = this.shootingStars.length - 1; j >= 0; j--) {
      var ss = this.shootingStars[j];
      ss.life -= ss.decay;
      if (ss.life <= 0) {
        this.shootingStars.splice(j, 1);
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x - ss.vx * ss.length * 0.15, ss.y - ss.vy * ss.length * 0.15);
      ctx.strokeStyle = 'rgba(200, 240, 255, ' + (ss.life * 0.8) + ')';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Head glow
      ctx.beginPath();
      ctx.arc(ss.x, ss.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + ss.life + ')';
      ctx.fill();

      ss.x += ss.vx;
      ss.y += ss.vy;
    }

    requestAnimationFrame(() => this._animate());
  }
}

// ============================================================
//  Cursor Glow Blob — glowing orb follows mouse on page
// ============================================================

class CursorGlow {
  constructor() {
    // Outer glow
    this.glow = document.createElement('div');
    this.glow.className = 'cursor-glow';
    document.body.appendChild(this.glow);

    // Inner bright core
    this.core = document.createElement('div');
    this.core.className = 'cursor-glow-core';
    document.body.appendChild(this.core);

    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.targetX = this.x;
    this.targetY = this.y;

    document.addEventListener('mousemove', (e) => {
      this.targetX = e.clientX;
      this.targetY = e.clientY;
    });

    this._animate();
  }

  _animate() {
    this.x += (this.targetX - this.x) * 0.12;
    this.y += (this.targetY - this.y) * 0.12;

    this.glow.style.transform = 'translate(' + (this.x - 100) + 'px, ' + (this.y - 100) + 'px)';
    this.core.style.transform = 'translate(' + (this.x - 15) + 'px, ' + (this.y - 15) + 'px)';

    requestAnimationFrame(() => this._animate());
  }
}

// ============================================================
//  CRT Power-On Animation (using Motion.dev)
// ============================================================

function powerOnAnimation() {
  var container = document.querySelector('.crt-container');
  var screen = document.querySelector('.crt-screen');
  var bezel = document.querySelector('.crt-bezel');
  var base = document.querySelector('.crt-base');
  var ticker = document.querySelector('.ticker-bar');

  if (!container) return;

  // Initial states
  container.style.opacity = '0';
  container.style.transform = 'scale(0.8) translateY(40px)';

  // Phase 1: Monitor appears with spring-like bounce
  animate(
    container,
    {
      opacity: [0, 1],
      transform: ['scale(0.8) translateY(40px)', 'scale(1.02) translateY(-5px)', 'scale(1) translateY(0px)'],
    },
    {
      duration: 1.0,
      easing: [0.34, 1.56, 0.64, 1],  // cubic-bezier overshoot
    }
  );

  // Phase 2: Screen powers on with horizontal line
  if (screen) {
    var powerLine = document.createElement('div');
    powerLine.className = 'crt-power-line';
    screen.appendChild(powerLine);

    setTimeout(function() {
      animate(
        powerLine,
        { height: ['2px', '100%'], opacity: [1, 0] },
        { duration: 0.5, easing: 'ease-out' }
      ).then(function() {
        if (powerLine.parentNode) powerLine.parentNode.removeChild(powerLine);
      });
    }, 600);
  }

  // Phase 3: Bezel glow pulse
  if (bezel) {
    setTimeout(function() {
      animate(
        bezel,
        {
          boxShadow: [
            '-3px -3px 0 0 #e0e0e0, 3px 3px 0 0 #707070, 0 8px 30px rgba(0,0,0,0.7), 0 0 60px rgba(0,0,0,0.4)',
            '-3px -3px 0 0 #e0e0e0, 3px 3px 0 0 #707070, 0 8px 30px rgba(0,0,0,0.7), 0 0 80px rgba(0,255,80,0.15)',
            '-3px -3px 0 0 #e0e0e0, 3px 3px 0 0 #707070, 0 8px 30px rgba(0,0,0,0.7), 0 0 60px rgba(0,0,0,0.4)',
          ],
        },
        { duration: 1.5, easing: 'ease-in-out' }
      );
    }, 800);
  }

  // Phase 4: Ticker slides in
  if (ticker) {
    ticker.style.opacity = '0';
    ticker.style.transform = 'translateY(10px)';
    setTimeout(function() {
      animate(
        ticker,
        { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0)'] },
        { duration: 0.4, easing: 'ease-out' }
      );
    }, 1000);
  }

  // Phase 5: Base slides in
  if (base) {
    base.style.opacity = '0';
    setTimeout(function() {
      animate(
        base,
        { opacity: [0, 1] },
        { duration: 0.3, easing: 'ease-out' }
      );
    }, 500);
  }
}

// ============================================================
//  Screen Shake — call when buildings take damage
// ============================================================

function screenShake(intensity) {
  var screen = document.querySelector('.crt-screen');
  if (!screen) return;

  var str = intensity || 4;
  var offsets = [];
  for (var i = 0; i < 6; i++) {
    offsets.push(
      'translate(' + (Math.random() * str * 2 - str).toFixed(1) + 'px, ' + (Math.random() * str * 2 - str).toFixed(1) + 'px)'
    );
  }
  offsets.push('translate(0, 0)');

  animate(
    screen,
    { transform: offsets },
    { duration: 0.3, easing: 'ease-out' }
  );
}

// ============================================================
//  Floating Particles — ambient particles around the monitor
// ============================================================

class AmbientParticles {
  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'ambient-particles';
    document.body.appendChild(this.container);

    this.particles = [];
    // Spawn a few immediately
    for (var i = 0; i < 5; i++) {
      setTimeout(() => this._spawn(), i * 400);
    }
    setInterval(() => this._spawn(), 2000);
  }

  _spawn() {
    if (this.particles.length > 25) return;

    var p = document.createElement('div');
    p.className = 'ambient-particle';

    var size = 2 + Math.random() * 4;
    var startX = Math.random() * window.innerWidth;
    var startY = window.innerHeight + 10;
    var drift = (Math.random() - 0.5) * 200;
    var duration = 6 + Math.random() * 8;

    var colors = [
      'rgba(0, 255, 204, 0.6)',
      'rgba(0, 255, 100, 0.5)',
      'rgba(100, 200, 255, 0.5)',
      'rgba(200, 150, 255, 0.4)',
      'rgba(255, 200, 100, 0.3)',
    ];

    var color = colors[Math.floor(Math.random() * colors.length)];
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.background = color;
    p.style.left = startX + 'px';
    p.style.top = startY + 'px';
    p.style.boxShadow = '0 0 ' + (size * 2) + 'px ' + color;

    this.container.appendChild(p);
    this.particles.push(p);

    var self = this;
    animate(
      p,
      {
        transform: [
          'translateY(0) translateX(0) scale(1)',
          'translateY(-' + (window.innerHeight + 50) + 'px) translateX(' + drift + 'px) scale(0)',
        ],
        opacity: [0, 0.8, 0.6, 0],
      },
      { duration: duration, easing: 'ease-in-out' }
    ).then(function() {
      if (p.parentNode) p.parentNode.removeChild(p);
      var idx = self.particles.indexOf(p);
      if (idx > -1) self.particles.splice(idx, 1);
    });
  }
}

// ============================================================
//  Nebula Glow — subtle colored nebula patches on background
// ============================================================

class NebulaGlow {
  constructor() {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '-1',
      overflow: 'hidden',
    });
    document.body.insertBefore(this.container, document.body.firstChild);

    var nebulae = [
      { x: '15%', y: '20%', color: 'rgba(0, 100, 255, 0.03)', size: 400 },
      { x: '75%', y: '30%', color: 'rgba(100, 0, 200, 0.025)', size: 350 },
      { x: '50%', y: '70%', color: 'rgba(0, 200, 150, 0.02)', size: 500 },
      { x: '85%', y: '80%', color: 'rgba(200, 100, 0, 0.015)', size: 300 },
    ];

    for (var i = 0; i < nebulae.length; i++) {
      var n = nebulae[i];
      var el = document.createElement('div');
      Object.assign(el.style, {
        position: 'absolute',
        left: n.x,
        top: n.y,
        width: n.size + 'px',
        height: n.size + 'px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, ' + n.color + ' 0%, transparent 70%)',
        filter: 'blur(40px)',
        transform: 'translate(-50%, -50%)',
      });
      this.container.appendChild(el);

      // Slow breathing animation
      animate(
        el,
        {
          opacity: [0.5, 1, 0.5],
          transform: ['translate(-50%, -50%) scale(0.9)', 'translate(-50%, -50%) scale(1.1)', 'translate(-50%, -50%) scale(0.9)'],
        },
        { duration: 8 + i * 3, easing: 'ease-in-out', repeat: Infinity }
      );
    }
  }
}

// ============================================================
//  CRT Glitch Effect — periodic screen glitch
// ============================================================

function startGlitchEffect() {
  var screen = document.querySelector('.crt-screen');
  if (!screen) return;

  setInterval(function() {
    if (Math.random() > 0.85) {
      screen.classList.add('crt-glitch');
      setTimeout(function() {
        screen.classList.remove('crt-glitch');
      }, 80 + Math.random() * 120);
    }
  }, 3000);
}

// ============================================================
//  Initialize all effects
// ============================================================

function initEffects() {
  new StarfieldCanvas();
  new CursorGlow();
  new NebulaGlow();
  powerOnAnimation();
  new AmbientParticles();
  startGlitchEffect();

  window.screenShake = screenShake;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEffects);
} else {
  initEffects();
}

window.Effects = { screenShake: screenShake };
