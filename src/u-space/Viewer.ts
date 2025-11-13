import {
  EventDispatcher,
  WebGPURenderer,
  Scene,
  PerspectiveCamera,
  PostProcessing,
  Timer,
  ACESFilmicToneMapping,
  PCFShadowMap,
} from 'three/webgpu';
import { pass } from 'three/tsl';
import { Inspector } from 'three/addons/inspector/Inspector.js';
import CameraControls from 'camera-controls';

export interface ViewerOptions {
  el: HTMLElement;
}

class Viewer extends EventDispatcher {
  el: HTMLElement;
  renderer: WebGPURenderer;
  inspector: Inspector;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: CameraControls;
  postProcessing: PostProcessing;
  timer: Timer;

  constructor({ el }: ViewerOptions) {
    super();

    this.el = el;
    this.renderer = this._initRenderer();
    this.inspector = this._initInspector();
    this.scene = this._initScene();
    this.camera = this._initCamera();
    this.controls = this._initControls();
    this.postProcessing = this._initPostProcessing();
    this.timer = this._initTimer();

    window.addEventListener('resize', this.onWindowResize);
  }

  onWindowResize = () => {
    const width = this.el.clientWidth;
    const height = this.el.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  };

  animate = (time: number) => {
    this.timer.update(time);

    this.controls.update(this.timer.getDelta());

    this.postProcessing.render();
  };

  private _initRenderer() {
    const renderer = new WebGPURenderer({ logarithmicDepthBuffer: false, antialias: false });
    renderer.setSize(this.el.clientWidth, this.el.clientHeight);
    // renderer.highPrecision = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    // renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setAnimationLoop(this.animate);
    this.el.appendChild(renderer.domElement);
    return renderer;
  }

  private _initInspector() {
    const inspector = new Inspector();
    this.renderer.inspector = inspector;
    return inspector;
  }

  private _initScene() {
    const scene = new Scene();
    return scene;
  }

  private _initCamera() {
    const camera = new PerspectiveCamera(50, this.el.clientWidth / this.el.clientHeight, 0.1, 1000);
    camera.position.setScalar(5);
    return camera;
  }

  private _initControls() {
    const controls = new CameraControls(this.camera, this.renderer.domElement);
    controls.minDistance = 0.2;
    controls.smoothTime = 0.2;
    controls.dollySpeed = 0.2;
    return controls;
  }

  private _initPostProcessing() {
    const postProcessing = new PostProcessing(this.renderer);
    postProcessing.outputNode = pass(this.scene, this.camera);
    return postProcessing;
  }

  private _initTimer() {
    const timer = new Timer();
    return timer;
  }

  dispose() {
    this.el.removeChild(this.renderer.domElement);
    window.removeEventListener('resize', this.onWindowResize);
    // this.renderer.dispose(); // hmr error
    this.postProcessing.dispose();
  }
}

export { Viewer };
