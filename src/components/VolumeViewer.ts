import * as vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import * as vtkVolume from '@kitware/vtk.js/Rendering/Core/Volume';
import * as vtkVolumeMapper from '@kitware/vtk.js/Rendering/Core/VolumeMapper';
import * as vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';
import * as vtkImageResliceMapper from '@kitware/vtk.js/Rendering/Core/ImageResliceMapper';
import * as vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import * as vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import * as vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import { VolumeMetadata } from '../utils/mrcUtils';

export class VolumeViewer {
    private renderWindow: any;
    private renderer: any;
    private volumeActor: any;
    private sliceActors: { [key: string]: any } = {};
    private sliceMappers: { [key: string]: any } = {};
    private vtkImage: any;
    private metadata: VolumeMetadata | null = null;
    private isPlaying: boolean = false;
    private playInterval: NodeJS.Timeout | null = null;
    private currentSliceIndices: { [key: string]: number } = {
        xy: 0,
        yz: 0,
        xz: 0
    };
    private container: HTMLElement;
    private viewMode: 'volume' | 'slice' | 'orthogonal' = 'volume';
    private currentSingleSliceView: 'xy' | 'yz' | 'xz' = 'xy';

    constructor(container: HTMLElement) {
        this.container = container;
        this.initializeViewer();
    }

    private initializeViewer() {
        this.renderWindow = vtkFullScreenRenderWindow.newInstance({
            background: [0, 0, 0] as [number, number, number],
            container: this.container,
        });

        this.renderer = this.renderWindow.getRenderer();
        this.renderWindow.getRenderWindow().render();
    }

    public async loadVolume(imageData: any, metadata: VolumeMetadata) {
        this.vtkImage = imageData;
        this.metadata = metadata;

        // Set initial slice indices to center of volume
        this.currentSliceIndices = {
            xy: Math.floor(metadata.dimensions[2] / 2), // z-axis center
            yz: Math.floor(metadata.dimensions[0] / 2), // x-axis center
            xz: Math.floor(metadata.dimensions[1] / 2)  // y-axis center
        };

        // Clear existing actors
        if (this.volumeActor) {
            this.renderer.removeVolume(this.volumeActor);
        }
        Object.values(this.sliceActors).forEach(actor => {
            if (actor) {
                this.renderer.removeViewProp(actor);
            }
        });

        // Setup volume mapper with improved settings
        const volumeMapper = vtkVolumeMapper.newInstance();
        volumeMapper.setInputData(this.vtkImage);
        volumeMapper.setSampleDistance(0.7);
        volumeMapper.setBlendModeToComposite();

        // Setup volume actor
        this.volumeActor = vtkVolume.newInstance();
        this.volumeActor.setMapper(volumeMapper);

        // Setup color and opacity transfer functions for volume
        const ctfun = vtkColorTransferFunction.newInstance();
        const ofun = vtkPiecewiseFunction.newInstance();
        
        // Set initial color and opacity ranges based on data range
        const dataRange = metadata.dataRange;
        const range = dataRange[1] - dataRange[0];
        const midPoint = (dataRange[0] + dataRange[1]) / 2;

        // Set up color transfer function with a more gradual transition
        ctfun.addRGBPoint(dataRange[0], 0.0, 0.0, 0.0);
        ctfun.addRGBPoint(midPoint - range * 0.25, 0.0, 0.0, 0.5);
        ctfun.addRGBPoint(midPoint, 0.5, 0.5, 0.5);
        ctfun.addRGBPoint(midPoint + range * 0.25, 0.5, 0.5, 1.0);
        ctfun.addRGBPoint(dataRange[1], 1.0, 1.0, 1.0);

        // Set up opacity transfer function with better visibility
        ofun.addPoint(dataRange[0], 0.0);
        ofun.addPoint(midPoint - range * 0.25, 0.1);
        ofun.addPoint(midPoint, 0.3);
        ofun.addPoint(midPoint + range * 0.25, 0.4);
        ofun.addPoint(dataRange[1], 0.5);

        this.volumeActor.getProperty().setRGBTransferFunction(0, ctfun);
        this.volumeActor.getProperty().setScalarOpacity(0, ofun);
        this.volumeActor.getProperty().setInterpolationTypeToLinear();
        this.volumeActor.getProperty().setShade(true);
        this.volumeActor.getProperty().setAmbient(0.2);
        this.volumeActor.getProperty().setDiffuse(0.7);
        this.volumeActor.getProperty().setSpecular(0.3);

        // Setup slice actors for orthogonal views
        const planes = {
            xy: { normal: [0, 0, 1], origin: [0, 0, 0] },
            yz: { normal: [1, 0, 0], origin: [0, 0, 0] },
            xz: { normal: [0, 1, 0], origin: [0, 0, 0] }
        };

        Object.entries(planes).forEach(([planeName, planeConfig]) => {
            const sliceMapper = vtkImageResliceMapper.newInstance();
            sliceMapper.setInputData(this.vtkImage);
            
            const sliceActor = vtkImageSlice.newInstance();
            sliceActor.setMapper(sliceMapper as any); // Cast to any to fix type error

            // Set initial contrast for slice view
            const window = dataRange[1] - dataRange[0];
            const level = (dataRange[0] + dataRange[1]) / 2;
            sliceActor.getProperty().setColorWindow(window);
            sliceActor.getProperty().setColorLevel(level);

            this.sliceMappers[planeName] = sliceMapper;
            this.sliceActors[planeName] = sliceActor;
            this.renderer.addViewProp(sliceActor);
        });

        // Add volume actor to renderer
        this.renderer.addVolume(this.volumeActor);

        // Set view mode based on current mode
        this.setViewMode(this.viewMode);
        this.resetCamera();
        this.renderWindow.getRenderWindow().render();
    }

    public setViewMode(mode: 'volume' | 'slice' | 'orthogonal') {
        if (!this.volumeActor || !this.sliceActors) return;

        this.viewMode = mode;
        if (mode === 'volume') {
            // In volume mode, hide all slice views
            this.volumeActor.setVisibility(true);
            Object.values(this.sliceActors).forEach(actor => {
                actor.setVisibility(false);
            });
            this.resetCamera();
        } else if (mode === 'orthogonal') {
            // In orthogonal mode, show all slice views and hide volume
            this.volumeActor.setVisibility(false);
            Object.values(this.sliceActors).forEach(actor => {
                actor.setVisibility(true);
            });
            this.updateAllSlices();
        } else {
            // In single slice mode, show only the selected slice and hide volume
            this.volumeActor.setVisibility(false);
            Object.entries(this.sliceActors).forEach(([name, actor]) => {
                actor.setVisibility(name === this.currentSingleSliceView);
            });
            this.updateSlice(this.currentSingleSliceView);
        }
        this.renderWindow.getRenderWindow().render();
    }

    private setSliceCameraPosition(plane: 'xy' | 'yz' | 'xz') {
        if (!this.metadata) return;

        const camera = this.renderer.getActiveCamera();
        const dimensions = this.metadata.dimensions;
        const spacing = this.metadata.spacing;
        const origin = this.metadata.origin;

        // Calculate the center of the volume
        const center = [
            origin[0] + (dimensions[0] * spacing[0]) / 2,
            origin[1] + (dimensions[1] * spacing[1]) / 2,
            origin[2] + (dimensions[2] * spacing[2]) / 2
        ];

        // Set camera position and orientation based on the plane
        switch (plane) {
            case 'xy':
                camera.setPosition(center[0], center[1], center[2] + 100);
                camera.setFocalPoint(center[0], center[1], center[2]);
                camera.setViewUp(0, 1, 0);
                break;
            case 'yz':
                camera.setPosition(center[0] + 100, center[1], center[2]);
                camera.setFocalPoint(center[0], center[1], center[2]);
                camera.setViewUp(0, 0, 1);
                break;
            case 'xz':
                camera.setPosition(center[0], center[1] + 100, center[2]);
                camera.setFocalPoint(center[0], center[1], center[2]);
                camera.setViewUp(0, 0, 1);
                break;
        }

        // Reset the camera to fit the view
        this.renderer.resetCamera();
        this.renderWindow.getRenderWindow().render();
    }

    public setSingleSliceView(view: 'xy' | 'yz' | 'xz') {
        if (this.viewMode !== 'slice') return;
        this.currentSingleSliceView = view;
        Object.entries(this.sliceActors).forEach(([name, actor]) => {
            actor.setVisibility(name === view);
        });
        this.setSliceCameraPosition(view);
        this.updateSlice(view);
    }

    public setSingleSliceIndex(index: number) {
        if (this.viewMode !== 'slice') return;
        this.currentSliceIndices[this.currentSingleSliceView] = index;
        this.updateSlice(this.currentSingleSliceView);
    }

    public setSliceIndex(plane: 'xy' | 'yz' | 'xz', index: number) {
        if (this.viewMode !== 'orthogonal') return;
        this.currentSliceIndices[plane] = index;
        this.updateSlice(plane);
    }

    private updateSlice(plane: 'xy' | 'yz' | 'xz') {
        if (!this.sliceActors[plane] || !this.vtkImage || !this.metadata) return;

        const dimensions = this.metadata.dimensions;
        const spacing = this.metadata.spacing;
        const origin = this.metadata.origin;

        let axisIndex: number;
        let position: number;

        switch (plane) {
            case 'xy':
                axisIndex = 2; // z-axis
                position = origin[axisIndex] + this.currentSliceIndices[plane] * spacing[axisIndex];
                break;
            case 'yz':
                axisIndex = 0; // x-axis
                position = origin[axisIndex] + this.currentSliceIndices[plane] * spacing[axisIndex];
                break;
            case 'xz':
                axisIndex = 1; // y-axis
                position = origin[axisIndex] + this.currentSliceIndices[plane] * spacing[axisIndex];
                break;
        }

        const normal = [0, 0, 0] as [number, number, number];
        normal[axisIndex] = 1;

        const planeInstance = vtkPlane.newInstance({
            normal,
            origin: [0, 0, 0] as [number, number, number],
        });
        planeInstance.setOrigin(normal.map((n, i) => n * position) as [number, number, number]);

        this.sliceMappers[plane].setSlicePlane(planeInstance);
        this.renderWindow.getRenderWindow().render();
    }

    private updateAllSlices() {
        if (this.viewMode !== 'orthogonal') return;
        Object.keys(this.sliceActors).forEach(plane => {
            this.updateSlice(plane as 'xy' | 'yz' | 'xz');
        });
    }

    public setContrast(window: number, level: number) {
        Object.values(this.sliceActors).forEach(actor => {
            if (actor) {
                actor.getProperty().setColorWindow(window);
                actor.getProperty().setColorLevel(level);
            }
        });
        this.renderWindow.getRenderWindow().render();
    }

    public setVolumeOpacity(opacity: number) {
        if (!this.volumeActor) return;
        this.volumeActor.getProperty().setScalarOpacity(0, opacity);
        this.renderWindow.getRenderWindow().render();
    }

    public setVolumeColorMap(min: number, max: number) {
        if (!this.volumeActor) return;
        const ctfun = this.volumeActor.getProperty().getRGBTransferFunction(0);
        ctfun.setRange(min, max);
        this.renderWindow.getRenderWindow().render();
    }

    public togglePlay() {
        if (this.isPlaying) {
            if (this.playInterval) {
                clearInterval(this.playInterval);
                this.playInterval = null;
            }
            this.isPlaying = false;
        } else {
            this.isPlaying = true;
            this.playInterval = setInterval(() => {
                if (this.viewMode === 'orthogonal' && this.metadata && this.metadata.dimensions) {
                    Object.keys(this.currentSliceIndices).forEach(plane => {
                        const maxIndex = this.metadata!.dimensions[this.getAxisIndex(plane as 'xy' | 'yz' | 'xz')] - 1;
                        this.currentSliceIndices[plane] = (this.currentSliceIndices[plane] + 1) % maxIndex;
                        this.updateSlice(plane as 'xy' | 'yz' | 'xz');
                    });
                }
            }, 100);
        }
    }

    private getAxisIndex(plane: 'xy' | 'yz' | 'xz'): number {
        switch (plane) {
            case 'xy': return 2; // z-axis
            case 'yz': return 0; // x-axis
            case 'xz': return 1; // y-axis
        }
    }

    public resetCamera() {
        this.renderer.resetCamera();
        this.renderWindow.getRenderWindow().render();
    }

    public resize() {
        this.renderWindow.resize();
    }

    public dispose() {
        if (this.playInterval) {
            clearInterval(this.playInterval);
        }
        this.renderWindow.delete();
    }

    public get playing(): boolean {
        return this.isPlaying;
    }
} 