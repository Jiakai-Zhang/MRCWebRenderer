import * as vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import * as vtkVolume from '@kitware/vtk.js/Rendering/Core/Volume';
import * as vtkVolumeMapper from '@kitware/vtk.js/Rendering/Core/VolumeMapper';
import * as vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';
import * as vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper';
import * as vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import * as vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import * as vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import { VolumeMetadata } from '../utils/mrcUtils';
import vtkInteractorStyleManipulator from '@kitware/vtk.js/Interaction/Style/InteractorStyleManipulator';
import vtkMouseCameraTrackballPanManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballPanManipulator';
import vtkMouseCameraTrackballZoomManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballZoomManipulator';
import { calculateContrastNormalization } from '../utils/imageProcessing';

// Removed incorrect/duplicate imports from previous attempts

export class VolumeViewer {
    private renderWindows: {[key: string]: any} = {};
    private renderers: {[key: string]: any} = {};
    // Use correct type for sliceActors
    private sliceActors: { [view: string]: vtkImageSlice.vtkImageSlice } = {};
    // Use any for sliceMappers type for now
    private sliceMappers: { [view: string]: any } = {};
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
    private zoomLevel: number = 1.0;
    private showPattern: boolean = false;
    private zProjection: boolean = false;
    private sumValue: number = 1;
    private crosshairElements: {[key: string]: {horizontal: HTMLElement, vertical: HTMLElement}} = {};
    private baseParallelScale: number = 1.0; // Added for global zoom

    constructor(container: HTMLElement) {
        this.container = container;
        this.initializeViewer();
        this.initializeCrosshairs();
    }

    private initializeViewer() {
        // Create render windows for each view
        const xyView = document.getElementById('xy-view')!;
        const xzView = document.getElementById('xz-view')!;
        const yzView = document.getElementById('yz-view')!;

        // Initialize render windows
        this.renderWindows.xy = vtkGenericRenderWindow.newInstance();
        this.renderWindows.xz = vtkGenericRenderWindow.newInstance();
        this.renderWindows.yz = vtkGenericRenderWindow.newInstance();

        // Set up containers
        this.renderWindows.xy.setContainer(xyView);
        this.renderWindows.xz.setContainer(xzView);
        this.renderWindows.yz.setContainer(yzView);

        // Get renderers
        this.renderers.xy = this.renderWindows.xy.getRenderer();
        this.renderers.xz = this.renderWindows.xz.getRenderer();
        this.renderers.yz = this.renderWindows.yz.getRenderer();

        // Set background color
        Object.values(this.renderers).forEach(renderer => {
            renderer.setBackground(0.1, 0.1, 0.1);
        });

        // Initialize interactors and set manipulator style
        Object.values(this.renderWindows).forEach(renderWindow => {
            const interactor = renderWindow.getInteractor();
            
            // Use vtkInteractorStyleManipulator
            const interactorStyle = vtkInteractorStyleManipulator.newInstance();
            interactor.setInteractorStyle(interactorStyle);

            // Create and add manipulators for mouse buttons
            // Middle button (2) pans
            const panManipulator = vtkMouseCameraTrackballPanManipulator.newInstance({ button: 2 });
            interactorStyle.addMouseManipulator(panManipulator);

            // Right button (3) zooms
            const zoomManipulator = vtkMouseCameraTrackballZoomManipulator.newInstance({ button: 3 });
            interactorStyle.addMouseManipulator(zoomManipulator);

            // Initialize and bind events after setting the style
            interactor.initialize();
            interactor.bindEvents(renderWindow.getContainer());
            interactor.setDesiredUpdateRate(15.0);
        });
    }

    private initializeCrosshairs() {
        const views = ['xy', 'xz', 'yz'];
        views.forEach(view => {
            const container = document.getElementById(`${view}-view`)!;
            const horizontal = container.querySelector('.crosshair-horizontal') as HTMLElement;
            const vertical = container.querySelector('.crosshair-vertical') as HTMLElement;
            this.crosshairElements[view] = { horizontal, vertical };
        });
    }

    public async loadVolume(imageData: any, metadata: VolumeMetadata) {
        this.vtkImage = imageData;
        this.metadata = metadata;
        const dataRange = metadata.dataRange;

        // Set initial slice indices to center of volume
        this.currentSliceIndices = {
            xy: Math.floor(metadata.dimensions[2] / 2), // Z index
            xz: Math.floor(metadata.dimensions[1] / 2), // Y index
            yz: Math.floor(metadata.dimensions[0] / 2)  // X index
        };

        // Clear existing actors and references
        Object.values(this.renderers).forEach(renderer => {
            renderer.removeAllViewProps();
        });
        this.sliceActors = {};
        this.sliceMappers = {};

        // Setup slice actors for each view
        const viewConfigs = {
            // viewName: { planeAxis, sliceOrientation (X=0, Y=1, Z=2), initialSliceIndex }
            // SWAPPED: xy view now shows XZ slice, xz view shows XY slice
            xy: { planeAxis: 'y' as const, sliceOrientation: vtkImageMapper.default.SlicingMode.Y, initialSliceIndex: this.currentSliceIndices.xz }, // Was XZ
            xz: { planeAxis: 'z' as const, sliceOrientation: vtkImageMapper.default.SlicingMode.Z, initialSliceIndex: this.currentSliceIndices.xy }, // Was XY
            yz: { planeAxis: 'x' as const, sliceOrientation: vtkImageMapper.default.SlicingMode.X, initialSliceIndex: this.currentSliceIndices.yz }
        };

        Object.entries(viewConfigs).forEach(([viewName, config]) => {
            // Use newInstance from namespace
            const sliceMapper = vtkImageMapper.newInstance();
            sliceMapper.setInputData(this.vtkImage);
            sliceMapper.setSlicingMode(config.sliceOrientation);

            // Set initial slice position using the correct method based on orientation
            // Access SlicingMode via default export
            switch (config.sliceOrientation) {
                case vtkImageMapper.default.SlicingMode.X:
                    sliceMapper.setXSlice(config.initialSliceIndex);
                    break;
                case vtkImageMapper.default.SlicingMode.Y:
                    sliceMapper.setYSlice(config.initialSliceIndex);
                    break;
                case vtkImageMapper.default.SlicingMode.Z:
                    sliceMapper.setZSlice(config.initialSliceIndex);
                    break;
            }

            // Use newInstance from namespace
            const sliceActor = vtkImageSlice.newInstance();
            sliceActor.setMapper(sliceMapper);

            // Defer setting contrast until after all actors are added and normalization is calculated

            // Store the mapper and actor directly by view name
            this.sliceMappers[viewName] = sliceMapper;
            this.sliceActors[viewName] = sliceActor;

            // Add to the correct renderer
            this.renderers[viewName].addActor(sliceActor);
        });

        // Calculate contrast normalization after image data is processed by VTK
        const { vmin, vmax } = calculateContrastNormalization(this.vtkImage);
        const initialWindow = vmax - vmin;
        const initialLevel = (vmax + vmin) / 2;

        // Apply the calculated contrast to all slice actors
        Object.values(this.sliceActors).forEach(actor => {
            if (actor) {
                actor.getProperty().setColorWindow(initialWindow);
                actor.getProperty().setColorLevel(initialLevel);
            }
        });

        // Set up orthogonal views
        this.setupOrthogonalViews();
        this.updateCrosshairs();
        this.resize(); // Ensure initial size is correct after layout
    }

    private setupOrthogonalViews() {
        if (!this.metadata) return;

        const dimensions = this.metadata.dimensions;
        const spacing = this.metadata.spacing;
        const origin = this.metadata.origin;

        // Calculate bounds
        const bounds = {
            xMin: origin[0],
            xMax: origin[0] + dimensions[0] * spacing[0],
            yMin: origin[1],
            yMax: origin[1] + dimensions[1] * spacing[1],
            zMin: origin[2],
            zMax: origin[2] + dimensions[2] * spacing[2]
        };

        // Calculate center
        const center = [
            (bounds.xMin + bounds.xMax) / 2,
            (bounds.yMin + bounds.yMax) / 2,
            (bounds.zMin + bounds.zMax) / 2
        ];

        // Calculate world dimensions for scaling
        const worldDimX = dimensions[0] * spacing[0];
        const worldDimY = dimensions[1] * spacing[1];
        const worldDimZ = dimensions[2] * spacing[2];

        // Determine the scale needed to fit the tallest slice vertically
        // XY slice height is worldDimY
        // XZ slice height is worldDimZ
        // YZ slice height is worldDimZ
        const maxSliceHeight = Math.max(worldDimY, worldDimZ);
        const parallelScale = maxSliceHeight / 2; // Use half-height for parallelScale
        this.baseParallelScale = parallelScale; // Store the base scale

        // Calculate a fallback camera distance if needed (e.g., for perspective)
        const maxDim = Math.max(worldDimX, worldDimY, worldDimZ);

        // SWAPPED: Setup XY view (now showing XZ slice, like front view)
        const xyCamera = this.renderers.xy.getActiveCamera();
        xyCamera.setParallelProjection(true);
        xyCamera.setPosition(center[0], bounds.yMax + maxDim, center[2]); // Position away along Y
        xyCamera.setFocalPoint(center[0], center[1], center[2]);
        xyCamera.setViewUp(0, 0, 1); // View Up along Z for XZ slice
        xyCamera.setParallelScale(parallelScale); // Set calculated scale

        // SWAPPED: Setup XZ view (now showing XY slice, like top-down view)
        const xzCamera = this.renderers.xz.getActiveCamera();
        xzCamera.setParallelProjection(true);
        xzCamera.setPosition(center[0], center[1], bounds.zMax + maxDim); // Position away along Z
        xzCamera.setFocalPoint(center[0], center[1], center[2]);
        xzCamera.setViewUp(0, 1, 0); // View Up along Y for XY slice
        xzCamera.setParallelScale(parallelScale); // Set calculated scale

        // Setup YZ view (side)
        const yzCamera = this.renderers.yz.getActiveCamera();
        yzCamera.setParallelProjection(true);
        yzCamera.setPosition(bounds.xMax + maxDim, center[1], center[2]); // Position away along X
        yzCamera.setFocalPoint(center[0], center[1], center[2]);
        yzCamera.setViewUp(0, 1, 0); // View Up along Y for 90-degree CCW rotation
        yzCamera.setParallelScale(parallelScale); // Set calculated scale

        // Reset cameras and render
        Object.values(this.renderers).forEach(renderer => {
            renderer.resetCamera();
        });

        // Apply initial zoom level after setting base scale
        this.setZoomLevel(this.zoomLevel);

        this.renderAllViews();
    }

    private updateCrosshairs() {
        if (!this.metadata) return;

        const dimensions = this.metadata.dimensions;
        const views = ['xy', 'xz', 'yz'];
        
        views.forEach(view => {
            const { horizontal, vertical } = this.crosshairElements[view];
            const container = document.getElementById(`${view}-view`)!;
            const rect = container.getBoundingClientRect();
            
            // Update crosshair positions based on current slice indices
            const xPos = rect.width > 0 ? (this.currentSliceIndices.yz / dimensions[0]) * rect.width : 0;
            const yPos = rect.height > 0 ? (this.currentSliceIndices.xz / dimensions[1]) * rect.height : 0;
            const zPos = rect.height > 0 ? (this.currentSliceIndices.xy / dimensions[2]) * rect.height : 0;
            
            // SWAPPED: Adjust crosshair logic for swapped views
            switch (view) {
                case 'xy': // Now shows XZ slice
                    horizontal.style.top = `${zPos}px`; // Based on Z index (xy plane)
                    vertical.style.left = `${xPos}px`; // Based on X index (yz plane)
                    break;
                case 'xz': // Now shows XY slice
                    horizontal.style.top = `${yPos}px`; // Based on Y index (xz plane)
                    vertical.style.left = `${xPos}px`; // Based on X index (yz plane)
                    break;
                case 'yz': // Shows YZ slice (remains the same)
                    horizontal.style.top = `${zPos}px`; // Based on Z index (xy plane)
                    vertical.style.left = `${yPos}px`; // Based on Y index (xz plane)
                    break;
            }
        });
    }

    public setZoomLevel(level: number) {
        this.zoomLevel = Math.max(0.1, level); // Ensure zoom level is positive
        const actualScale = this.baseParallelScale / this.zoomLevel;

        // Apply the same scale to all orthogonal cameras
        Object.values(this.renderers).forEach(renderer => {
            const camera = renderer.getActiveCamera();
            if (camera && camera.getParallelProjection()) {
                camera.setParallelScale(actualScale);
            }
        });

        this.updateCrosshairs(); // Update crosshair size/position relative to zoom
        this.renderAllViews();
    }

    public togglePattern() {
        this.showPattern = !this.showPattern;
        // TODO: Implement pattern overlay
        this.renderAllViews();
    }

    public setZProjection(enabled: boolean) {
        this.zProjection = enabled;
        // TODO: Implement Z-projection
        this.renderAllViews();
    }

    public setSumValue(value: number) {
        this.sumValue = value;
        if (this.zProjection) {
            // TODO: Update Z-projection with new sum value
            this.renderAllViews();
        }
    }

    public setSliceIndex(plane: 'xy' | 'yz' | 'xz', index: number) {
        if (!this.metadata) return;

        const maxIndex = this.getMaxSliceIndex(plane);
        // Clamp index to valid range
        const clampedIndex = Math.max(0, Math.min(index, maxIndex));

        this.currentSliceIndices[plane] = clampedIndex;

        // Update the slice position on the corresponding mapper using the correct method
        // SWAPPED: Adjust logic for swapped views
        switch (plane) {
            case 'xy': // Controls Z slice, update the mapper in the XZ view container (this.sliceMappers.xz)
                if (this.sliceMappers.xz) {
                    this.sliceMappers.xz.setZSlice(clampedIndex);
                }
                break;
            case 'xz': // Controls Y slice, update the mapper in the XY view container (this.sliceMappers.xy)
                if (this.sliceMappers.xy) {
                    this.sliceMappers.xy.setYSlice(clampedIndex);
                }
                break;
            case 'yz': // Controls X slice, update the mapper in the YZ view container (this.sliceMappers.yz)
                 if (this.sliceMappers.yz) {
                    this.sliceMappers.yz.setXSlice(clampedIndex);
                }
                break;
        }

        this.updateCrosshairs();
        this.renderAllViews();
    }

    private getMaxSliceIndex(plane: 'xy' | 'yz' | 'xz'): number {
        if (!this.metadata) return 0;
        switch (plane) {
            case 'xy': return this.metadata.dimensions[2] - 1;
            case 'yz': return this.metadata.dimensions[0] - 1;
            case 'xz': return this.metadata.dimensions[1] - 1;
        }
    }

    public setContrast(window: number, level: number) {
        // Use the simplified storage
        Object.values(this.sliceActors).forEach(actor => {
            if (actor) { // Check if actor exists
                actor.getProperty().setColorWindow(window);
                actor.getProperty().setColorLevel(level);
            }
        });
        this.renderAllViews();
    }

    private renderAllViews() {
        Object.values(this.renderWindows).forEach(renderWindow => {
            renderWindow.getRenderWindow().render();
        });
    }

    public resize() {
        Object.values(this.renderWindows).forEach(renderWindow => {
            renderWindow.resize();
        });
        this.updateCrosshairs();
    }

    public dispose() {
        if (this.playInterval) {
            clearInterval(this.playInterval);
        }
        Object.values(this.renderWindows).forEach(renderWindow => {
            renderWindow.delete();
        });
    }

    /**
     * Gets the current contrast window and level settings.
     * Assumes all slice actors have the same settings.
     * Returns null if no volume/actors are loaded.
     */
    public getContrastSettings(): { window: number, level: number } | null {
        // Find the first valid slice actor to get properties from
        const firstActorKey = Object.keys(this.sliceActors).find(key => this.sliceActors[key]);
        const firstActor = firstActorKey ? this.sliceActors[firstActorKey] : null;

        if (firstActor) {
            const prop = firstActor.getProperty();
            return {
                window: prop.getColorWindow(),
                level: prop.getColorLevel(),
            };
        } else {
            return null;
        }
    }
} 