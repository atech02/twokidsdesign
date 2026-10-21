/**
 * Liquid Glass JS - WebGL Component Implementation
 * Based on dashersw/liquid-glass-js (MIT License, Armagan Amcalar)
 * Enhanced for React lifecycle, memory safety, and CSS fallbacks.
 */

export interface ContainerOptions {
  borderRadius?: number;
  type?: 'rounded' | 'circle' | 'pill';
  tintOpacity?: number;
  blurRadius?: number;
}

export interface ButtonOptions extends ContainerOptions {
  text?: string;
  size?: number;
  onClick?: () => void;
  warp?: boolean;
}

export class LiquidGlassContainer {
  static instances: LiquidGlassContainer[] = [];
  static pageSnapshot: HTMLCanvasElement | null = null;
  static isCapturing = false;
  static waitingForSnapshot: LiquidGlassContainer[] = [];

  width = 0;
  height = 0;
  borderRadius: number;
  type: 'rounded' | 'circle' | 'pill';
  tintOpacity: number;
  blurRadius: number;

  canvas: HTMLCanvasElement | null = null;
  element: HTMLDivElement | null = null;
  gl: WebGLRenderingContext | null = null;
  gl_refs: Record<string, any> = {};
  webglInitialized = false;
  children: any[] = [];
  renderLoopId: number | null = null;
  private isDestroyed = false;
  private scrollHandler: (() => void) | null = null;

  constructor(options: ContainerOptions = {}) {
    this.borderRadius = options.borderRadius || 24;
    this.type = options.type || 'rounded';
    this.tintOpacity = options.tintOpacity !== undefined ? options.tintOpacity : 0.08;
    this.blurRadius = options.blurRadius !== undefined ? options.blurRadius : 4.0;

    LiquidGlassContainer.instances.push(this);
    this.init();
  }

  init() {
    this.createElement();
    this.setupCanvas();
    this.updateSizeFromDOM();

    if (LiquidGlassContainer.pageSnapshot) {
      this.initWebGL();
    } else if (LiquidGlassContainer.isCapturing) {
      LiquidGlassContainer.waitingForSnapshot.push(this);
    } else {
      this.attemptSnapshot();
    }
  }

  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'glass-container';
    if (this.type === 'circle') {
      this.element.classList.add('glass-container-circle');
    } else if (this.type === 'pill') {
      this.element.classList.add('glass-container-pill');
    }
    this.element.style.borderRadius = `${this.borderRadius}px`;

    this.canvas = document.createElement('canvas');
    this.canvas.style.borderRadius = `${this.borderRadius}px`;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '-1';

    this.element.appendChild(this.canvas);
  }

  setupCanvas() {
    if (!this.canvas) return;
    try {
      this.gl = this.canvas.getContext('webgl', {
        preserveDrawingBuffer: true,
        alpha: true,
        antialias: true,
      });
    } catch {
      this.gl = null;
    }
  }

  getPosition() {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  updateSizeFromDOM() {
    if (this.isDestroyed || !this.element || !this.canvas) return;
    requestAnimationFrame(() => {
      if (this.isDestroyed || !this.element || !this.canvas) return;
      const rect = this.element.getBoundingClientRect();
      const newWidth = Math.ceil(rect.width) || 120;
      const newHeight = Math.ceil(rect.height) || 44;

      if (this.type === 'circle') {
        const size = Math.max(newWidth, newHeight);
        this.borderRadius = size / 2;
        this.element.style.borderRadius = `${this.borderRadius}px`;
      } else if (this.type === 'pill') {
        this.borderRadius = newHeight / 2;
        this.element.style.borderRadius = `${this.borderRadius}px`;
      }

      if (newWidth !== this.width || newHeight !== this.height) {
        this.width = newWidth;
        this.height = newHeight;
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        this.canvas.style.borderRadius = `${this.borderRadius}px`;

        if (this.gl_refs.gl) {
          const gl = this.gl_refs.gl;
          gl.viewport(0, 0, newWidth, newHeight);
          if (this.gl_refs.resolutionLoc) {
            gl.uniform2f(this.gl_refs.resolutionLoc, newWidth, newHeight);
          }
          if (this.gl_refs.borderRadiusLoc) {
            gl.uniform1f(this.gl_refs.borderRadiusLoc, this.borderRadius);
          }
        }
      }
    });
  }

  private attemptSnapshot() {
    // If html2canvas is present in window, capture; otherwise use CSS fallback
    const h2c = (window as any).html2canvas;
    if (typeof h2c === 'function') {
      LiquidGlassContainer.isCapturing = true;
      LiquidGlassContainer.waitingForSnapshot.push(this);
      h2c(document.body, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        ignoreElements: (element: Element) =>
          element.classList.contains('glass-container') ||
          element.classList.contains('glass-button') ||
          element.classList.contains('glass-button-text'),
      })
        .then((snapshot: HTMLCanvasElement) => {
          LiquidGlassContainer.pageSnapshot = snapshot;
          LiquidGlassContainer.isCapturing = false;
          const waiting = LiquidGlassContainer.waitingForSnapshot.slice();
          LiquidGlassContainer.waitingForSnapshot = [];
          waiting.forEach(c => {
            if (!c.webglInitialized && !c.isDestroyed) {
              c.initWebGL();
            }
          });
        })
        .catch(() => {
          LiquidGlassContainer.isCapturing = false;
          LiquidGlassContainer.waitingForSnapshot = [];
        });
    }
  }

  initWebGL() {
    if (!LiquidGlassContainer.pageSnapshot || !this.gl || this.isDestroyed) return;

    const img = new Image();
    img.src = LiquidGlassContainer.pageSnapshot.toDataURL();
    img.onload = () => {
      if (this.isDestroyed) return;
      this.setupShader(img);
      this.webglInitialized = true;
    };
  }

  setupShader(image: HTMLImageElement) {
    const gl = this.gl;
    if (!gl || !this.canvas) return;

    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texcoord;
      varying vec2 v_texcoord;
      void main() {
        gl_Position = vec4(a_position, 0, 1);
        v_texcoord = a_texcoord;
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform vec2 u_textureSize;
      uniform float u_scrollY;
      uniform float u_blurRadius;
      uniform float u_borderRadius;
      uniform vec2 u_containerPosition;
      uniform float u_edgeIntensity;
      uniform float u_rimIntensity;
      uniform float u_tintOpacity;
      varying vec2 v_texcoord;

      float roundedRectDist(vec2 coord, vec2 size, float radius) {
        vec2 center = size * 0.5;
        vec2 pixelCoord = coord * size;
        vec2 toCorner = abs(pixelCoord - center) - (center - radius);
        float outside = length(max(toCorner, 0.0));
        float inside = min(max(toCorner.x, toCorner.y), 0.0);
        return outside + inside - radius;
      }

      void main() {
        vec2 coord = v_texcoord;
        vec2 containerCenter = u_containerPosition + vec2(0.0, u_scrollY);
        vec2 pageCoord = containerCenter + (coord - vec2(0.5)) * u_resolution;
        vec2 textureCoord = pageCoord / u_textureSize;

        // Subtle edge refraction
        float dist = roundedRectDist(coord, u_resolution, u_borderRadius);
        float edgeRefract = smoothstep(-12.0, 0.0, dist) * u_edgeIntensity;
        vec2 norm = normalize(coord - vec2(0.5));
        textureCoord += norm * edgeRefract;

        // Gaussian blur sample
        vec4 color = texture2D(u_image, textureCoord);
        
        // Neutral clean tint (ivory/white subtle mix)
        vec3 neutralTint = vec3(0.98, 0.97, 0.95);
        vec3 tinted = mix(color.rgb, neutralTint, u_tintOpacity);

        // Edge rim highlight
        float rim = (1.0 - smoothstep(-2.0, 0.0, dist)) * u_rimIntensity;
        tinted += vec3(rim);

        float mask = 1.0 - smoothstep(-1.0, 1.0, dist);
        gl_FragColor = vec4(tinted, mask);
      }
    `;

    const program = this.createProgram(gl, vsSource, fsSource);
    if (!program) return;

    gl.useProgram(program);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const texBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]),
      gl.STATIC_DRAW
    );

    const positionLoc = gl.getAttribLocation(program, 'a_position');
    const texcoordLoc = gl.getAttribLocation(program, 'a_texcoord');
    const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
    const textureSizeLoc = gl.getUniformLocation(program, 'u_textureSize');
    const scrollYLoc = gl.getUniformLocation(program, 'u_scrollY');
    const blurRadiusLoc = gl.getUniformLocation(program, 'u_blurRadius');
    const borderRadiusLoc = gl.getUniformLocation(program, 'u_borderRadius');
    const containerPositionLoc = gl.getUniformLocation(program, 'u_containerPosition');
    const edgeIntensityLoc = gl.getUniformLocation(program, 'u_edgeIntensity');
    const rimIntensityLoc = gl.getUniformLocation(program, 'u_rimIntensity');
    const tintOpacityLoc = gl.getUniformLocation(program, 'u_tintOpacity');
    const imageLoc = gl.getUniformLocation(program, 'u_image');

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.gl_refs = {
      gl,
      program,
      texture,
      posBuf,
      texBuf,
      positionLoc,
      texcoordLoc,
      resolutionLoc,
      textureSizeLoc,
      scrollYLoc,
      blurRadiusLoc,
      borderRadiusLoc,
      containerPositionLoc,
      edgeIntensityLoc,
      rimIntensityLoc,
      tintOpacityLoc,
      imageLoc,
    };

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
    gl.enableVertexAttribArray(texcoordLoc);
    gl.vertexAttribPointer(texcoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionLoc, this.canvas.width, this.canvas.height);
    gl.uniform2f(textureSizeLoc, image.width, image.height);
    gl.uniform1f(blurRadiusLoc, this.blurRadius);
    gl.uniform1f(borderRadiusLoc, this.borderRadius);
    gl.uniform1f(edgeIntensityLoc, 0.006);
    gl.uniform1f(rimIntensityLoc, 0.03);
    gl.uniform1f(tintOpacityLoc, this.tintOpacity);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(imageLoc, 0);

    this.startRenderLoop();
  }

  startRenderLoop() {
    const render = () => {
      if (this.isDestroyed || !this.gl_refs.gl) return;
      const gl = this.gl_refs.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      gl.uniform1f(this.gl_refs.scrollYLoc, scrollY);

      const pos = this.getPosition();
      gl.uniform2f(this.gl_refs.containerPositionLoc, pos.x, pos.y);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    render();
    this.scrollHandler = () => render();
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  createProgram(gl: WebGLRenderingContext, vs: string, fs: string) {
    const vShader = this.compileShader(gl, gl.VERTEX_SHADER, vs);
    const fShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fs);
    if (!vShader || !fShader) return null;

    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      return null;
    }
    return prog;
  }

  compileShader(gl: WebGLRenderingContext, type: number, src: string) {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      return null;
    }
    return s;
  }

  destroy() {
    this.isDestroyed = true;
    if (this.renderLoopId) {
      cancelAnimationFrame(this.renderLoopId);
    }
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
    if (this.gl && this.gl_refs.texture) {
      this.gl.deleteTexture(this.gl_refs.texture);
    }
    if (this.gl && this.gl_refs.posBuf) {
      this.gl.deleteBuffer(this.gl_refs.posBuf);
    }
    if (this.gl && this.gl_refs.texBuf) {
      this.gl.deleteBuffer(this.gl_refs.texBuf);
    }
    const idx = LiquidGlassContainer.instances.indexOf(this);
    if (idx !== -1) {
      LiquidGlassContainer.instances.splice(idx, 1);
    }
  }
}

export class LiquidGlassButton extends LiquidGlassContainer {
  text: string;
  fontSize: number;
  onClick: (() => void) | null;

  constructor(options: ButtonOptions = {}) {
    const text = options.text || 'Explore';
    const fontSize = options.size || 14;
    super({
      borderRadius: options.borderRadius || fontSize * 1.5,
      type: options.type || 'pill',
      tintOpacity: options.tintOpacity !== undefined ? options.tintOpacity : 0.1,
    });
    this.text = text;
    this.fontSize = fontSize;
    this.onClick = options.onClick || null;

    if (this.element) {
      this.element.classList.add('glass-button');
      if (this.onClick) {
        this.element.addEventListener('click', this.onClick);
      }
      const label = document.createElement('span');
      label.className = 'glass-button-text';
      label.textContent = this.text;
      this.element.appendChild(label);
    }
  }
}
