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

// --- Contrast UI Elements (Define these early) ---
const contrastWindowSlider = document.getElementById('contrastWindow') as HTMLInputElement;
const contrastLevelSlider = document.getElementById('contrastLevel') as HTMLInputElement;
const contrastWindowValueSpan = document.getElementById('contrastWindowValue') as HTMLSpanElement;
const contrastWindowRangeSpan = document.getElementById('contrastWindowRange') as HTMLSpanElement;
const contrastLevelValueSpan = document.getElementById('contrastLevelValue') as HTMLSpanElement;
const contrastLevelRangeSpan = document.getElementById('contrastLevelRange') as HTMLSpanElement;

// Function to update the text display for contrast sliders
function updateContrastDisplay() {
    // Check if elements exist before updating
    if (contrastWindowSlider && contrastWindowValueSpan && contrastWindowRangeSpan) {
        contrastWindowValueSpan.textContent = `Value: ${Number(contrastWindowSlider.value).toFixed(2)}`;
        contrastWindowRangeSpan.textContent = `Range: [${contrastWindowSlider.min}, ${contrastWindowSlider.max}]`;
    }
    if (contrastLevelSlider && contrastLevelValueSpan && contrastLevelRangeSpan) {
        contrastLevelValueSpan.textContent = `Value: ${Number(contrastLevelSlider.value).toFixed(2)}`;
        contrastLevelRangeSpan.textContent = `Range: [${contrastLevelSlider.min}, ${contrastLevelSlider.max}]`;
    }
}

// --- Initial Load --- Need to make this async to wait for loadVolume
async function initializeViewer() {
    // Load test volume by default
    const { imageData, metadata } = createTestVolume();
    await viewer.loadVolume(imageData, metadata); // Wait for load to complete

    // Update slice controls (you might have this logic elsewhere too)
    updateSliceControls(metadata); // Make sure this function exists and works

    // Update contrast display based on initial auto-contrast
    const initialContrast = viewer.getContrastSettings();
    if (initialContrast && contrastWindowSlider && contrastLevelSlider) {
        const dataRange = metadata.dataRange;
        const rangeSpan = dataRange[1] - dataRange[0];
        contrastWindowSlider.min = "0";
        contrastWindowSlider.max = String(Math.ceil(Math.max(rangeSpan, initialContrast.window * 2)));
        contrastLevelSlider.min = String(Math.floor(dataRange[0]));
        contrastLevelSlider.max = String(Math.ceil(dataRange[1]));
        contrastWindowSlider.value = String(initialContrast.window);
        contrastLevelSlider.value = String(initialContrast.level);
    }
    updateContrastDisplay(); // Update display after initial load
}

// --- Slice Controls (Assuming definition exists somewhere like this) ---
const xSlider = document.getElementById('xSlider') as HTMLInputElement;
const ySlider = document.getElementById('ySlider') as HTMLInputElement;
const zSlider = document.getElementById('zSlider') as HTMLInputElement;

let maxSliceIndices = {
    xy: 0,
    yz: 0,
    xz: 0
};

function updateSliceControls(metadata: any) {
    if (!metadata?.dimensions) return; // Guard clause
    maxSliceIndices = {
        xy: metadata.dimensions[2] - 1, // z-axis
        yz: metadata.dimensions[0] - 1, // x-axis
        xz: metadata.dimensions[1] - 1  // y-axis
    };
    const centerPositions = {
        xy: Math.floor(metadata.dimensions[2] / 2),
        yz: Math.floor(metadata.dimensions[0] / 2),
        xz: Math.floor(metadata.dimensions[1] / 2)
    };
    if(xSlider) {
      xSlider.max = maxSliceIndices.yz.toString();
      xSlider.value = centerPositions.yz.toString();
    }
    if(ySlider) {
      ySlider.max = maxSliceIndices.xz.toString();
      ySlider.value = centerPositions.xz.toString();
    }
    if(zSlider) {
      zSlider.max = maxSliceIndices.xy.toString();
      zSlider.value = centerPositions.xy.toString();
    }
}

// --- Event Listeners ---

// File input handling
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
fileInput.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const { imageData, metadata } = await loadMRCFile(file);
            if (!metadata || !imageData || !metadata.dimensions || metadata.dimensions.length !== 3) {
                console.error('Invalid dimensions for volume viewing');
                alert('Invalid MRC file or dimensions.'); // User feedback
                return;
            }

            await viewer.loadVolume(imageData, metadata);

            // Update slice sliders
            updateSliceControls(metadata);

            // Update contrast sliders and their display (use existing references)
            const contrastSettings = viewer.getContrastSettings();
            if (contrastSettings && contrastWindowSlider && contrastLevelSlider) {
                 // Update slider range if necessary
                const dataRange = metadata.dataRange;
                const rangeSpan = dataRange[1] - dataRange[0];
                contrastWindowSlider.min = "0";
                contrastWindowSlider.max = String(Math.ceil(Math.max(rangeSpan, contrastSettings.window * 2)));
                contrastLevelSlider.min = String(Math.floor(dataRange[0]));
                contrastLevelSlider.max = String(Math.ceil(dataRange[1]));
                // Set value *after* min/max
                contrastWindowSlider.value = String(contrastSettings.window);
                contrastLevelSlider.value = String(contrastSettings.level);

            } else {
                 console.warn('Could not get initial contrast settings from viewer. Setting defaults.');
                 const dataRange = metadata.dataRange;
                 const fallbackWindow = dataRange[1] - dataRange[0];
                 const fallbackLevel = (dataRange[1] + dataRange[0]) / 2;
                 if (contrastWindowSlider) {
                    contrastWindowSlider.min = "0";
                    contrastWindowSlider.max = String(fallbackWindow);
                    contrastWindowSlider.value = String(fallbackWindow);
                 }
                 if (contrastLevelSlider) {
                    contrastLevelSlider.min = String(dataRange[0]);
                    contrastLevelSlider.max = String(dataRange[1]);
                    contrastLevelSlider.value = String(fallbackLevel);
                 }
            }
            updateContrastDisplay(); // Update the text display AFTER changes

        } catch (error) {
            console.error('Error loading MRC file:', error);
            alert('Error loading MRC file. Please try again.');
        }
    }
});

// Contrast slider listeners (ensure elements exist)
if (contrastWindowSlider) {
    contrastWindowSlider.addEventListener('input', () => {
        if (!contrastLevelSlider) return;
        viewer.setContrast(
            parseFloat(contrastWindowSlider.value),
            parseFloat(contrastLevelSlider.value)
        );
        updateContrastDisplay(); // Update display on change
    });
}

if (contrastLevelSlider) {
    contrastLevelSlider.addEventListener('input', () => {
        if (!contrastWindowSlider) return;
        viewer.setContrast(
            parseFloat(contrastWindowSlider.value),
            parseFloat(contrastLevelSlider.value)
        );
        updateContrastDisplay(); // Update display on change
    });
}

// --- Start the initialization ---
initializeViewer();

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

// Step right button
const stepRightButton = document.getElementById('stepRight') as HTMLButtonElement;
stepRightButton.addEventListener('click', () => {
    // TODO: Implement step right functionality
    console.log('Step right clicked');
});

// Camera reset
const resetCameraButton = document.getElementById('resetCamera') as HTMLButtonElement;
resetCameraButton?.addEventListener('click', () => {
    viewer.resize(); // Consider if you need a more specific reset
});

// Handle window resize
window.addEventListener('resize', () => {
    viewer.resize();
});

// Make sure they also use the correct slider references if needed
xSlider?.addEventListener('input', () => {
    viewer.setSliceIndex('yz', parseInt(xSlider.value));
});

ySlider?.addEventListener('input', () => {
    viewer.setSliceIndex('xz', parseInt(ySlider.value));
});

zSlider?.addEventListener('input', () => {
    viewer.setSliceIndex('xy', parseInt(zSlider.value));
}); 