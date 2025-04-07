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
    const mode = viewModeSelect.value as 'volume' | 'slice' | 'orthogonal';
    viewer.setViewMode(mode);
    
    // Show/hide appropriate controls
    const singleSliceControls = document.getElementById('singleSliceControls') as HTMLElement;
    const orthogonalSliceControls = document.getElementById('orthogonalSliceControls') as HTMLElement;
    
    if (mode === 'slice') {
        singleSliceControls.style.display = 'block';
        orthogonalSliceControls.style.display = 'none';
    } else if (mode === 'orthogonal') {
        singleSliceControls.style.display = 'none';
        orthogonalSliceControls.style.display = 'block';
    } else {
        singleSliceControls.style.display = 'none';
        orthogonalSliceControls.style.display = 'none';
    }
});

// Single slice controls
const sliceViewSelect = document.getElementById('sliceView') as HTMLSelectElement;
const singleSlicePositionInput = document.getElementById('singleSlicePosition') as HTMLInputElement;

// Get value label elements
const singleSlicePositionValue = document.getElementById('singleSlicePositionValue') as HTMLSpanElement;

sliceViewSelect.addEventListener('change', () => {
    viewer.setSingleSliceView(sliceViewSelect.value as 'xy' | 'yz' | 'xz');
    if (maxSliceIndices) {
        updateSingleSliceControls();
    }
});

singleSlicePositionInput.addEventListener('input', () => {
    singleSlicePositionValue.textContent = singleSlicePositionInput.value;
    viewer.setSingleSliceIndex(parseInt(singleSlicePositionInput.value));
});

function updateSingleSliceControls() {
    const currentView = sliceViewSelect.value as 'xy' | 'yz' | 'xz';
    singleSlicePositionInput.max = maxSliceIndices[currentView].toString();
    const centerValue = Math.floor(parseInt(singleSlicePositionInput.max) / 2).toString();
    singleSlicePositionInput.value = centerValue;
    singleSlicePositionValue.textContent = centerValue;
}

// Slice controls
const xySlicePositionInput = document.getElementById('xySlicePosition') as HTMLInputElement;
const yzSlicePositionInput = document.getElementById('yzSlicePosition') as HTMLInputElement;
const xzSlicePositionInput = document.getElementById('xzSlicePosition') as HTMLInputElement;
const playPauseButton = document.getElementById('playPause') as HTMLButtonElement;

// Get value label elements
const xySlicePositionValue = document.getElementById('xySlicePositionValue') as HTMLSpanElement;
const yzSlicePositionValue = document.getElementById('yzSlicePositionValue') as HTMLSpanElement;
const xzSlicePositionValue = document.getElementById('xzSlicePositionValue') as HTMLSpanElement;

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

    // Update orthogonal slice controls
    xySlicePositionInput.max = maxSliceIndices.xy.toString();
    yzSlicePositionInput.max = maxSliceIndices.yz.toString();
    xzSlicePositionInput.max = maxSliceIndices.xz.toString();

    // Set initial positions to center and update value labels
    xySlicePositionInput.value = centerPositions.xy.toString();
    xySlicePositionValue.textContent = centerPositions.xy.toString();
    
    yzSlicePositionInput.value = centerPositions.yz.toString();
    yzSlicePositionValue.textContent = centerPositions.yz.toString();
    
    xzSlicePositionInput.value = centerPositions.xz.toString();
    xzSlicePositionValue.textContent = centerPositions.xz.toString();

    // Update single slice controls
    updateSingleSliceControls();
}

xySlicePositionInput.addEventListener('input', () => {
    xySlicePositionValue.textContent = xySlicePositionInput.value;
    viewer.setSliceIndex('xy', parseInt(xySlicePositionInput.value));
});

yzSlicePositionInput.addEventListener('input', () => {
    yzSlicePositionValue.textContent = yzSlicePositionInput.value;
    viewer.setSliceIndex('yz', parseInt(yzSlicePositionInput.value));
});

xzSlicePositionInput.addEventListener('input', () => {
    xzSlicePositionValue.textContent = xzSlicePositionInput.value;
    viewer.setSliceIndex('xz', parseInt(xzSlicePositionInput.value));
});

playPauseButton.addEventListener('click', () => {
    viewer.togglePlay();
    playPauseButton.textContent = viewer.playing ? 'Pause' : 'Play';
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