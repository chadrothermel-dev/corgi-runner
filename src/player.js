import { AudioSystem } from './audio.js';

export class CorgiPlayer {
  constructor(groundY = 350) {
    this.groundY = groundY;
    this.normalHeight = 50;
    this.duckHeight = 25;
    this.width = 60;
    this.height = this.normalHeight;

    this.x = 80;
    this.y = this.groundY - this.height;

    this.vy = 0;
    this.gravity = 1200;
    this.jumpImpulse = -550;

    this.state = 'RUNNING';
    this.isGrounded = true;
    this.isDucking = false;
    this.animTime = 0;
  }

  reset() {
    this.height = this.normalHeight;
    this.y = this.groundY - this.height;
    this.vy = 0;
    this.state = 'RUNNING';
    this.isGrounded = true;
    this.isDucking = false;
    this.animTime = 0;
  }

  jump() {
    if (this.isGrounded) {
      this.vy = this.jumpImpulse;
      this.isGrounded = false;
      this.state = 'JUMPING';
      AudioSystem.play('jump');
      return true;
    }
    return false; // Ignored double-jump
  }

  duck() {
    this.isDucking = true;
    const oldHeight = this.height;
    this.height = this.duckHeight;

    if (this.isGrounded) {
      this.y = this.groundY - this.duckHeight;
      this.state = 'DUCKING';
    } else {
      // Mid-air fast fall
      this.vy += 800 * 0.016; // increase downward velocity
    }
  }

  stopDuck() {
    this.isDucking = false;
    this.height = this.normalHeight;

    if (this.isGrounded) {
      this.y = this.groundY - this.normalHeight;
      this.state = 'RUNNING';
    }
  }

  update(dt) {
    this.animTime += dt;

    // Apply gravity if airborne
    if (!this.isGrounded) {
      this.vy += this.gravity * dt;
      if (this.isDucking) {
        this.vy += 1200 * dt; // Extra fast fall weight
      }
      this.y += this.vy * dt;

      // Check ground collision
      if (this.y + this.height >= this.groundY) {
        this.y = this.groundY - this.height;
        this.vy = 0;
        this.isGrounded = true;
        this.state = this.isDucking ? 'DUCKING' : 'RUNNING';
      }
    } else {
      // Grounded state alignment
      this.y = this.groundY - this.height;
      this.state = this.isDucking ? 'DUCKING' : 'RUNNING';
    }
  }

  draw(ctx) {
    ctx.save();
    
    const x = this.x;
    const y = this.y;
    const w = this.width;
    const h = this.height;
    
    // Animate legs if running
    let legOffset = 0;
    if (this.state === 'RUNNING') {
      legOffset = Math.sin(this.animTime * 15) * 8;
    }
    
    // 1. Draw Tail (Cute fluffy tail on the left)
    ctx.fillStyle = '#D2691E'; // Orange-brown
    ctx.beginPath();
    ctx.arc(x + 6, y + h * 0.55, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF'; // White tail tip
    ctx.beginPath();
    ctx.arc(x + 3, y + h * 0.5, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // 2. Draw Legs (Stubby legs)
    ctx.fillStyle = '#D2691E';
    
    if (this.isDucking) {
      // Ducking legs: flat/crawling
      ctx.fillRect(x + 10, y + h - 5, 12, 5);
      ctx.fillRect(x + w - 22, y + h - 5, 12, 5);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 14, y + h - 3, 5, 3);
      ctx.fillRect(x + w - 18, y + h - 3, 5, 3);
    } else if (!this.isGrounded) {
      // Jumping legs: extended outward
      ctx.fillRect(x + 6, y + h - 8, 8, 10);
      ctx.fillRect(x + w - 20, y + h - 8, 8, 10);
      // White paws
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 4, y + h + 1, 6, 3);
      ctx.fillRect(x + w - 22, y + h + 1, 6, 3);
    } else {
      // Running legs: animated oscillation
      // Back Leg
      ctx.fillRect(x + 12 + legOffset * 0.5, y + h - 10, 8, 10);
      // Front Leg
      ctx.fillRect(x + w - 20 - legOffset * 0.5, y + h - 10, 8, 10);
      
      // Paws
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 12 + legOffset * 0.5, y + h, 8, 3);
      ctx.fillRect(x + w - 20 - legOffset * 0.5, y + h, 8, 3);
    }
    
    // 3. Draw Main Body (Orange-brown)
    ctx.fillStyle = '#D2691E';
    ctx.fillRect(x + 12, y + h * 0.3, w - 24, h * 0.5);
    
    // Left & Right body roundness
    ctx.beginPath();
    ctx.arc(x + 12, y + h * 0.55, h * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w - 12, y + h * 0.55, h * 0.25, 0, Math.PI * 2);
    ctx.fill();
    
    // White Belly Patch
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 16, y + h * 0.6, w - 32, h * 0.2);
    ctx.beginPath();
    ctx.arc(x + 16, y + h * 0.7, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w - 16, y + h * 0.7, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
    
    // White Chest (Fluffy chest on the front right)
    ctx.beginPath();
    ctx.arc(x + w - 16, y + h * 0.5, h * 0.2, 0, Math.PI * 2);
    ctx.fill();
    
    // 4. Draw Head
    const headRadius = this.isDucking ? h * 0.35 : h * 0.3;
    const headX = x + w - 16;
    const headY = this.isDucking ? y + h * 0.45 : y + h * 0.35;
    
    ctx.fillStyle = '#D2691E';
    ctx.beginPath();
    ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // White muzzle (Snout)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(headX + headRadius * 0.5, headY + headRadius * 0.3, headRadius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    // White blaze on forehead
    ctx.beginPath();
    ctx.arc(headX, headY - headRadius * 0.3, headRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Black nose
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(headX + headRadius * 0.9, headY + headRadius * 0.2, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // 5. Ears (Iconic corgi ears)
    // Back Ear
    ctx.fillStyle = '#8B4513'; // Darker brown
    ctx.beginPath();
    ctx.moveTo(headX - headRadius * 0.6, headY - headRadius * 0.4);
    ctx.lineTo(headX - headRadius * 0.7, headY - headRadius * 1.5);
    ctx.lineTo(headX - headRadius * 0.1, headY - headRadius * 0.8);
    ctx.closePath();
    ctx.fill();
    
    // Front Ear
    ctx.fillStyle = '#D2691E';
    ctx.beginPath();
    ctx.moveTo(headX - headRadius * 0.3, headY - headRadius * 0.5);
    ctx.lineTo(headX - headRadius * 0.4, headY - headRadius * 1.6);
    ctx.lineTo(headX + headRadius * 0.2, headY - headRadius * 0.8);
    ctx.closePath();
    ctx.fill();
    
    // Inner Ear (Pink)
    ctx.fillStyle = '#FFC0CB';
    ctx.beginPath();
    ctx.moveTo(headX - headRadius * 0.2, headY - headRadius * 0.7);
    ctx.lineTo(headX - headRadius * 0.3, headY - headRadius * 1.4);
    ctx.lineTo(headX + headRadius * 0.1, headY - headRadius * 0.9);
    ctx.closePath();
    ctx.fill();
    
    // 6. Draw Eye
    const eyeX = headX + headRadius * 0.1;
    const eyeY = headY - headRadius * 0.2;
    
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(eyeX + 0.8, eyeY, 2.2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(eyeX + 1.4, eyeY - 0.6, 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}
