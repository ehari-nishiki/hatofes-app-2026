import { useEffect, useRef } from 'react'

interface WebGLAuroraProps {
  className?: string
  intensity?: 'subtle' | 'normal' | 'vibrant'
  colorScheme?: 'default' | 'gold' | 'purple'
}

const VERTEX_SHADER = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision highp float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform float u_intensity;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform vec3 u_color3;

  mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, s, -s, c);
  }

  float noise(vec2 p) {
    return sin(p.x) * sin(p.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      p *= rot(0.5);
      v += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 mouse = u_mouse / u_resolution;
    float dist = distance(uv, mouse);

    vec2 p = (uv * 2.0 - 1.0);
    p.x *= u_resolution.x / u_resolution.y;

    float t = u_time * 0.08;
    vec2 flow = p;

    // Subtle mouse pull
    vec2 dir = normalize(uv - mouse + 0.001);
    float strength = 0.3 / (dist + 0.5);
    flow += dir * strength * 0.1;

    for(int i = 0; i < 3; i++) {
      flow.x += 0.3 * sin(flow.y * 1.2 + t + float(i));
      flow.y += 0.2 * cos(flow.x * 1.1 + t * 0.6 + float(i));
    }

    float pattern = fbm(flow * 1.2 + t);
    float pattern2 = fbm(flow * 2.4 - t * 0.3);

    float sheen = smoothstep(0.2, 0.0, abs(pattern - 0.1));
    sheen += smoothstep(0.3, 0.0, abs(pattern2 - 0.15)) * 0.5;

    vec3 black = vec3(0.01, 0.01, 0.02);

    vec3 baseColor = mix(black, u_color1, clamp(pattern * 2.0 + 0.3, 0.0, 1.0));
    baseColor = mix(baseColor, u_color2, clamp(pattern2 * 1.4, 0.0, 1.0));

    float accentMask = smoothstep(0.1, 0.4, pattern * pattern2);
    baseColor = mix(baseColor, u_color3, accentMask * 0.5);

    vec3 finalColor = baseColor + sheen * mix(u_color1, u_color3, uv.x) * 0.3;

    // Glow around mouse
    finalColor += (1.0 - smoothstep(0.0, 0.6, dist)) * vec3(0.04, 0.04, 0.12);

    float mask = smoothstep(1.8, 0.0, length(p));
    finalColor *= mask * u_intensity;

    gl_FragColor = vec4(pow(finalColor * 1.6, vec3(1.1)), 1.0);
  }
`

const COLOR_SCHEMES = {
  default: {
    color1: [0.02, 0.15, 0.5],   // Deep blue
    color2: [0.35, 0.0, 0.5],    // Purple
    color3: [0.9, 0.45, 0.1],    // Orange/Gold
  },
  gold: {
    color1: [0.15, 0.1, 0.02],   // Dark gold
    color2: [0.5, 0.25, 0.0],    // Orange
    color3: [1.0, 0.77, 0.0],    // Bright gold
  },
  purple: {
    color1: [0.1, 0.0, 0.2],     // Deep purple
    color2: [0.4, 0.0, 0.6],     // Purple
    color3: [0.7, 0.3, 1.0],     // Light purple
  },
}

const INTENSITY_VALUES = {
  subtle: 0.4,
  normal: 0.7,
  vibrant: 1.0,
}

export function WebGLAurora({
  className = '',
  intensity = 'normal',
  colorScheme = 'default'
}: WebGLAuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true
    })
    if (!gl) {
      console.warn('WebGL not supported')
      return
    }
    glRef.current = gl

    // Create shaders
    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vertexShader = createShader(gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vertexShader || !fragmentShader) return

    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program))
      return
    }

    programRef.current = program
    gl.useProgram(program)

    // Set up geometry
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    // Get uniform locations
    const timeLoc = gl.getUniformLocation(program, 'u_time')
    const resLoc = gl.getUniformLocation(program, 'u_resolution')
    const mouseLoc = gl.getUniformLocation(program, 'u_mouse')
    const intensityLoc = gl.getUniformLocation(program, 'u_intensity')
    const color1Loc = gl.getUniformLocation(program, 'u_color1')
    const color2Loc = gl.getUniformLocation(program, 'u_color2')
    const color3Loc = gl.getUniformLocation(program, 'u_color3')

    // Set colors
    const colors = COLOR_SCHEMES[colorScheme]
    gl.uniform3fv(color1Loc, colors.color1)
    gl.uniform3fv(color2Loc, colors.color2)
    gl.uniform3fv(color3Loc, colors.color3)
    gl.uniform1f(intensityLoc, INTENSITY_VALUES[intensity])

    // Initialize mouse position
    mouseRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

    // Handle resize
    const handleResize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    // Handle mouse move
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = {
        x: (e.clientX - rect.left) * window.devicePixelRatio,
        y: (canvas.height - (e.clientY - rect.top) * window.devicePixelRatio),
      }
    }

    // Handle touch move
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect()
        mouseRef.current = {
          x: (e.touches[0].clientX - rect.left) * window.devicePixelRatio,
          y: (canvas.height - (e.touches[0].clientY - rect.top) * window.devicePixelRatio),
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    // Animation loop
    const render = (time: number) => {
      if (!gl || !canvas) return

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform1f(timeLoc, time * 0.001)
      gl.uniform2f(resLoc, canvas.width, canvas.height)
      gl.uniform2f(mouseLoc, mouseRef.current.x, mouseRef.current.y)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      animationRef.current = requestAnimationFrame(render)
    }

    animationRef.current = requestAnimationFrame(render)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [intensity, colorScheme])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ zIndex: 0 }}
    />
  )
}
