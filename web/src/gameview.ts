/* The game's own picture, drawn into a canvas: the camera viewfinder, video calls, live streams.
 *
 * FiveM's built-in browser watches for a WebGL texture configured in one specific order and, when it
 * sees it, fills that texture with the game frame on every draw. The order below is the one
 * screenshot-basic's renderer uses. None of this does anything in an ordinary browser. */

const VERT = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
varying vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_texcoord;
}`;

const FRAG = `
varying highp vec2 v_uv;
uniform sampler2D u_game;
void main() {
  gl_FragColor = texture2D(u_game, v_uv);
}`;

export type GameView = {
  /** The current frame as a JPEG, centre-cropped to `aspect` (width / height). */
  photo: (aspect: number) => Promise<Blob | null>;
  /** Start recording the view. `stop` resolves to the finished clip. */
  record: () => { stop: () => Promise<Blob> };
  /** The view as a video stream, for sending to another phone. */
  stream: () => MediaStream;
  /** Stop drawing, and start again. */
  pause: () => void;
  resume: () => void;
  destroy: () => void;
};

export function gameView(canvas: HTMLCanvasElement): GameView | null {
  // Half the window is plenty for a phone-sized picture and keeps the per-frame copy cheap.
  canvas.width = Math.max(640, Math.round(window.innerWidth / 2));
  canvas.height = Math.max(360, Math.round(window.innerHeight / 2));
  const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;

  const shader = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  gl.useProgram(program);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  // The signal: these three values, in this order, mark the texture as "the game frame goes here".
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const attribute = (name: string, data: number[]) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(program, name);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(at);
  };
  attribute('a_position', [-1, -1, 1, -1, -1, 1, 1, 1]);
  // If the picture ever comes out upside down on a FiveM build, swap the two rows here.
  attribute('a_texcoord', [0, 0, 1, 0, 0, 1, 1, 1]);
  gl.uniform1i(gl.getUniformLocation(program, 'u_game'), 0);
  gl.viewport(0, 0, canvas.width, canvas.height);

  let frame = 0;
  const draw = () => {
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    frame = requestAnimationFrame(draw);
  };
  draw();

  const stream = () => canvas.captureStream(24);

  return {
    photo: (aspect) =>
      new Promise((resolve) => {
        const out = document.createElement('canvas');
        out.height = canvas.height;
        out.width = Math.round(Math.min(canvas.width, canvas.height * aspect));
        out.getContext('2d')!.drawImage(canvas, (canvas.width - out.width) / 2, 0, out.width, out.height, 0, 0, out.width, out.height);
        out.toBlob(resolve, 'image/jpeg', 0.88);
      }),
    // ponytail: clips are the full game frame, not the cropped viewfinder. Record a cropped 2D canvas instead if that matters.
    record: () => {
      const recorder = new MediaRecorder(stream(), { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.start();
      return {
        stop: () =>
          new Promise((resolve) => {
            recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
            recorder.stop();
          }),
      };
    },
    stream,
    pause: () => cancelAnimationFrame(frame),
    resume: () => (cancelAnimationFrame(frame), draw()),
    destroy: () => cancelAnimationFrame(frame),
  };
}
