import '@kitware/vtk.js/Rendering/Profiles/Volume';
import { VolumeViewer } from './components/VolumeViewer';
import { loadMRCFile } from './utils/mrcUtils';
import { createTestVolume } from './utils/testData';

// Initialize the volume viewer
const container = document.querySelector('#container');
if (!container) {
    throw new Error('Container element not found');
}

const viewer = new VolumeViewer(container as HTMLElement);

// Load test volume by default
const { imageData, metadata } = createTestVolume();
viewer.loadVolume(imageData, metadata);

// File input handling
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
fileInput.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const { imageData, metadata } = await loadMRCFile(file);
            viewer.loadVolume(imageData, metadata);
            updateSliceControls(metadata);
        } catch (error) {
            console.error('Error loading MRC file:', error);
            alert('Error loading MRC file. Please try again.');
        }
    }
});

// 3D View button
const view3DButton = document.getElementById('view3D') as HTMLButtonElement;
view3DButton.addEventListener('click', () => {
    // TODO: Implement 3D view
    console.log('3D view clicked');
});

// Zoom control
const zoomLevelInput = document.getElementById('zoomLevel') as HTMLInputElement;
zoomLevelInput.addEventListener('change', () => {
    viewer.setZoomLevel(parseFloat(zoomLevelInput.value));
});

// Pattern toggle
const patternToggle = document.getElementById('togglePattern') as HTMLButtonElement;
patternToggle.addEventListener('click', () => {
    viewer.togglePattern();
    patternToggle.classList.toggle('active');
});

// Z-Projection controls
const zProjectionCheckbox = document.getElementById('zProjection') as HTMLInputElement;
const sumValueInput = document.getElementById('sumValue') as HTMLInputElement;

zProjectionCheckbox.addEventListener('change', () => {
    viewer.setZProjection(zProjectionCheckbox.checked);
});

sumValueInput.addEventListener('change', () => {
    viewer.setSumValue(parseInt(sumValueInput.value));
});

// Slice controls
const xSlider = document.getElementById('xSlider') as HTMLInputElement;
const ySlider = document.getElementById('ySlider') as HTMLInputElement;
const zSlider = document.getElementById('zSlider') as HTMLInputElement;

let maxSliceIndices = {
    xy: 0,
    yz: 0,
    xz: 0
};

function updateSliceControls(metadata: any) {
    maxSliceIndices = {
        xy: metadata.dimensions[2] - 1, // z-axis
        yz: metadata.dimensions[0] - 1, // x-axis
        xz: metadata.dimensions[1] - 1  // y-axis
    };

    // Calculate center positions
    const centerPositions = {
        xy: Math.floor(metadata.dimensions[2] / 2), // z-axis center
        yz: Math.floor(metadata.dimensions[0] / 2), // x-axis center
        xz: Math.floor(metadata.dimensions[1] / 2)  // y-axis center
    };

    // Update sliders
    xSlider.max = maxSliceIndices.yz.toString();
    ySlider.max = maxSliceIndices.xz.toString();
    zSlider.max = maxSliceIndices.xy.toString();

    // Set initial positions to center
    xSlider.value = centerPositions.yz.toString();
    ySlider.value = centerPositions.xz.toString();
    zSlider.value = centerPositions.xy.toString();
}

xSlider.addEventListener('input', () => {
    viewer.setSliceIndex('yz', parseInt(xSlider.value));
});

ySlider.addEventListener('input', () => {
    viewer.setSliceIndex('xz', parseInt(ySlider.value));
});

zSlider.addEventListener('input', () => {
    viewer.setSliceIndex('xy', parseInt(zSlider.value));
});

// Step right button
const stepRightButton = document.getElementById('stepRight') as HTMLButtonElement;
stepRightButton.addEventListener('click', () => {
    // TODO: Implement step right functionality
    console.log('Step right clicked');
});

// Contrast controls
const contrastWindowInput = document.getElementById('contrastWindow') as HTMLInputElement;
const contrastLevelInput = document.getElementById('contrastLevel') as HTMLInputElement;

contrastWindowInput.addEventListener('input', () => {
    viewer.setContrast(
        parseFloat(contrastWindowInput.value),
        parseFloat(contrastLevelInput.value)
    );
});

contrastLevelInput.addEventListener('input', () => {
    viewer.setContrast(
        parseFloat(contrastWindowInput.value),
        parseFloat(contrastLevelInput.value)
    );
});

// Camera reset
const resetCameraButton = document.getElementById('resetCamera') as HTMLButtonElement;
resetCameraButton.addEventListener('click', () => {
    viewer.resize();
});

// Handle window resize
window.addEventListener('resize', () => {
    viewer.resize();
}); 