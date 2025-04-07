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
    private sliceActor: any;
    private vtkImage: any;
    private metadata: VolumeMetadata | null = null;
    private isPlaying: boolean = false;
    private playInterval: number | null = null;
    private currentAxis: 'x' | 'y' | 'z' = 'z';
    private currentSliceIndex: number = 0;
    private container: HTMLElement;
    private viewMode: 'volume' | 'slice' = 'volume';

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

        // Clear existing actors
        if (this.volumeActor) {
            this.renderer.removeVolume(this.volumeActor);
        }
        if (this.sliceActor) {
            this.renderer.removeViewProp(this.sliceActor);
        }

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

        // Setup slice actor
        const sliceMapper = vtkImageResliceMapper.newInstance();
        sliceMapper.setInputData(this.vtkImage);
        this.sliceActor = vtkImageSlice.newInstance();
        this.sliceActor.setMapper(sliceMapper);

        // Set initial contrast for slice view
        const window = dataRange[1] - dataRange[0];
        const level = (dataRange[0] + dataRange[1]) / 2;
        this.sliceActor.getProperty().setColorWindow(window);
        this.sliceActor.getProperty().setColorLevel(level);

        // Add actors to renderer
        this.renderer.addVolume(this.volumeActor);
        this.renderer.addViewProp(this.sliceActor);

        // Set view mode based on current mode
        this.setViewMode(this.viewMode);
        this.resetCamera();
        this.renderWindow.getRenderWindow().render();
    }

    public setViewMode(mode: 'volume' | 'slice') {
        if (!this.volumeActor || !this.sliceActor) return;

        this.viewMode = mode;
        if (mode === 'volume') {
            // In volume mode, completely disable slice view
            this.volumeActor.setVisibility(true);
            this.sliceActor.setVisibility(false);
            // Reset camera to show the full volume
            this.resetCamera();
        } else {
            // In slice mode, show slice and hide volume
            this.volumeActor.setVisibility(false);
            this.sliceActor.setVisibility(true);
            
            // Ensure slice is properly initialized
            if (this.vtkImage && this.metadata) {
                const dimensions = this.metadata.dimensions;
                const spacing = this.metadata.spacing;
                const origin = this.metadata.origin;
                const axisIndex = this.getAxisIndex();
                const position = origin[axisIndex] + this.currentSliceIndex * spacing[axisIndex];

                const normal = [0, 0, 0] as [number, number, number];
                normal[axisIndex] = 1;

                const plane = vtkPlane.newInstance({
                    normal,
                    origin: [0, 0, 0] as [number, number, number],
                });
                plane.setOrigin(normal.map((n, i) => n * position) as [number, number, number]);

                this.sliceActor.getMapper().setSlicePlane(plane);
            }
        }
        this.renderWindow.getRenderWindow().render();
    }

    public setSliceAxis(axis: 'x' | 'y' | 'z') {
        if (this.viewMode !== 'slice') return;
        this.currentAxis = axis;
        this.updateSlice();
    }

    public setSliceIndex(index: number) {
        if (this.viewMode !== 'slice') return;
        this.currentSliceIndex = index;
        this.updateSlice();
    }

    private updateSlice() {
        if (this.viewMode !== 'slice' || !this.sliceActor || !this.vtkImage || !this.metadata) return;

        const dimensions = this.metadata.dimensions;
        const spacing = this.metadata.spacing;
        const origin = this.metadata.origin;

        const axisIndex = this.getAxisIndex();
        const position = origin[axisIndex] + this.currentSliceIndex * spacing[axisIndex];

        const normal = [0, 0, 0] as [number, number, number];
        normal[axisIndex] = 1;

        const plane = vtkPlane.newInstance({
            normal,
            origin: [0, 0, 0] as [number, number, number],
        });
        plane.setOrigin(normal.map((n, i) => n * position) as [number, number, number]);

        this.sliceActor.getMapper().setSlicePlane(plane);
        this.renderWindow.getRenderWindow().render();
    }

    private getAxisIndex(): number {
        switch (this.currentAxis) {
            case 'x': return 0;
            case 'y': return 1;
            case 'z': return 2;
        }
    }

    public setContrast(window: number, level: number) {
        if (!this.sliceActor) return;
        this.sliceActor.getProperty().setColorWindow(window);
        this.sliceActor.getProperty().setColorLevel(level);
        this.renderWindow.getRenderWindow().render();
    }

    public setVolumeOpacity(opacity: number) {
        if (!this.volumeActor) return;
        const ofun = vtkPiecewiseFunction.newInstance();
        ofun.addPoint(0, 0);
        ofun.addPoint(255, opacity);
        this.volumeActor.getProperty().setScalarOpacity(0, ofun);
        this.renderWindow.getRenderWindow().render();
    }

    public setVolumeColorMap(min: number, max: number) {
        if (!this.volumeActor) return;
        const ctfun = vtkColorTransferFunction.newInstance();
        ctfun.addRGBPoint(min, 0.0, 0.0, 0.0);
        ctfun.addRGBPoint(max, 1.0, 1.0, 1.0);
        this.volumeActor.getProperty().setRGBTransferFunction(0, ctfun);
        this.renderWindow.getRenderWindow().render();
    }

    public togglePlay() {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            this.playInterval = window.setInterval(() => {
                if (!this.metadata) return;
                const maxIndex = this.metadata.dimensions[this.getAxisIndex()] - 1;
                this.currentSliceIndex = (this.currentSliceIndex + 1) % maxIndex;
                this.updateSlice();
            }, 100);
        } else if (this.playInterval !== null) {
            clearInterval(this.playInterval);
            this.playInterval = null;
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
        if (this.playInterval !== null) {
            clearInterval(this.playInterval);
        }
        this.renderWindow.delete();
    }
} 