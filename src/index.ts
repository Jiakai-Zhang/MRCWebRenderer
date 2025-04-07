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

// View mode controls
const viewModeSelect = document.getElementById('viewMode') as HTMLSelectElement;
viewModeSelect.addEventListener('change', () => {
    viewer.setViewMode(viewModeSelect.value as 'volume' | 'slice');
});

// Slice controls
const sliceAxisSelect = document.getElementById('sliceAxis') as HTMLSelectElement;
const slicePositionInput = document.getElementById('slicePosition') as HTMLInputElement;
const playPauseButton = document.getElementById('playPause') as HTMLButtonElement;

let maxSliceIndex = 0;

function updateSliceControls(metadata: any) {
    maxSliceIndex = metadata.dimensions[getAxisIndex()] - 1;
    slicePositionInput.max = maxSliceIndex.toString();
    slicePositionInput.value = '0';
}

function getAxisIndex(): number {
    switch (sliceAxisSelect.value) {
        case 'x': return 0;
        case 'y': return 1;
        case 'z': return 2;
        default: return 2;
    }
}

sliceAxisSelect.addEventListener('change', () => {
    viewer.setSliceAxis(sliceAxisSelect.value as 'x' | 'y' | 'z');
    if (maxSliceIndex > 0) {
        updateSliceControls({ dimensions: [maxSliceIndex + 1, maxSliceIndex + 1, maxSliceIndex + 1] });
    }
});

slicePositionInput.addEventListener('input', () => {
    viewer.setSliceIndex(parseInt(slicePositionInput.value));
});

playPauseButton.addEventListener('click', () => {
    viewer.togglePlay();
    playPauseButton.textContent = playPauseButton.textContent === 'Play' ? 'Pause' : 'Play';
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

// Volume opacity control
const volumeOpacityInput = document.getElementById('volumeOpacity') as HTMLInputElement;
volumeOpacityInput.addEventListener('input', () => {
    viewer.setVolumeOpacity(parseFloat(volumeOpacityInput.value));
});

// Camera reset
const resetCameraButton = document.getElementById('resetCamera') as HTMLButtonElement;
resetCameraButton.addEventListener('click', () => {
    viewer.resetCamera();
});

// Handle window resize
window.addEventListener('resize', () => {
    viewer.resize();
}); 