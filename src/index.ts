import '@kitware/vtk.js/Rendering/Profiles/Volume';
import { VolumeViewer } from './components/VolumeViewer';
import { loadMRCFile } from './utils/mrcUtils';
import { createTestVolume } from './utils/testData';

// --- Function Definitions (Safe outside DOMContentLoaded) ---

// Function to update the text display for contrast sliders
function updateContrastDisplay(
    contrastWindowSlider: HTMLInputElement | null,
    contrastLevelSlider: HTMLInputElement | null,
    contrastWindowValueSpan: HTMLSpanElement | null,
    contrastWindowRangeSpan: HTMLSpanElement | null,
    contrastLevelValueSpan: HTMLSpanElement | null,
    contrastLevelRangeSpan: HTMLSpanElement | null
) {
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

let maxSliceIndices = {
    xy: 0,
    yz: 0,
    xz: 0
};

function updateSliceControls(
    metadata: any,
    xSlider: HTMLInputElement | null,
    ySlider: HTMLInputElement | null,
    zSlider: HTMLInputElement | null
) {
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


// --- Main Application Logic (Run after DOM is ready) ---
document.addEventListener('DOMContentLoaded', () => {

    // --- Get DOM Elements ---
    const container = document.querySelector('#container');
    if (!container) {
        console.error('Container element #container not found');
        return; // Stop execution if the main container is missing
    }

    const contrastWindowSlider = document.getElementById('contrastWindow') as HTMLInputElement | null;
    const contrastLevelSlider = document.getElementById('contrastLevel') as HTMLInputElement | null;
    const contrastWindowValueSpan = document.getElementById('contrastWindowValue') as HTMLSpanElement | null;
    const contrastWindowRangeSpan = document.getElementById('contrastWindowRange') as HTMLSpanElement | null;
    const contrastLevelValueSpan = document.getElementById('contrastLevelValue') as HTMLSpanElement | null;
    const contrastLevelRangeSpan = document.getElementById('contrastLevelRange') as HTMLSpanElement | null;
    const xSlider = document.getElementById('xSlider') as HTMLInputElement | null;
    const ySlider = document.getElementById('ySlider') as HTMLInputElement | null;
    const zSlider = document.getElementById('zSlider') as HTMLInputElement | null;
    const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
    const view3DButton = document.getElementById('view3D') as HTMLButtonElement | null;
    const zoomLevelInput = document.getElementById('zoomLevel') as HTMLInputElement | null;
    const patternToggle = document.getElementById('togglePattern') as HTMLButtonElement | null;
    const zProjectionCheckbox = document.getElementById('zProjection') as HTMLInputElement | null;
    const sumValueInput = document.getElementById('sumValue') as HTMLInputElement | null;
    const stepRightButton = document.getElementById('stepRight') as HTMLButtonElement | null;
    const resetCameraButton = document.getElementById('resetCamera') as HTMLButtonElement | null;
    const centerSliceButton = document.getElementById('centerSlice') as HTMLButtonElement | null;

    // Initialize the volume viewer
    const viewer = new VolumeViewer(container as HTMLElement);

    // --- Initial Load Function ---
    async function initializeViewer() {
        // Load test volume by default
        const { imageData, metadata } = createTestVolume();
        await viewer.loadVolume(imageData, metadata); // Wait for load to complete

        // Update slice controls
        updateSliceControls(metadata, xSlider, ySlider, zSlider);

        // Update contrast display based on initial auto-contrast
        const initialContrast = viewer.getContrastSettings();
        if (initialContrast && contrastWindowSlider && contrastLevelSlider && metadata.dataRange) {
            const dataRange = metadata.dataRange;
            const rangeSpan = dataRange[1] - dataRange[0];
            contrastWindowSlider.min = "0";
            // Ensure max is at least the initial window or the full range span
            contrastWindowSlider.max = String(Math.ceil(Math.max(rangeSpan, initialContrast.window)));
            contrastLevelSlider.min = String(Math.floor(dataRange[0]));
            contrastLevelSlider.max = String(Math.ceil(dataRange[1]));

            // Clamp initial values within the calculated range
            contrastWindowSlider.value = String(Math.max(parseFloat(contrastWindowSlider.min), Math.min(parseFloat(contrastWindowSlider.max), initialContrast.window)));
            contrastLevelSlider.value = String(Math.max(parseFloat(contrastLevelSlider.min), Math.min(parseFloat(contrastLevelSlider.max), initialContrast.level)));

        } else if (metadata.dataRange) {
            console.warn('Could not get initial contrast settings. Setting defaults based on data range.');
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
        updateContrastDisplay(
            contrastWindowSlider, contrastLevelSlider,
            contrastWindowValueSpan, contrastWindowRangeSpan,
            contrastLevelValueSpan, contrastLevelRangeSpan
        ); // Update display after initial load
    }


    // --- Event Listeners ---

    // File input handling
    fileInput?.addEventListener('change', async (event) => {
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
                updateSliceControls(metadata, xSlider, ySlider, zSlider);

                // Update contrast sliders and their display (use existing references)
                 const contrastSettings = viewer.getContrastSettings();
                 if (contrastSettings && contrastWindowSlider && contrastLevelSlider && metadata.dataRange) {
                      // Update slider range if necessary
                     const dataRange = metadata.dataRange;
                     const rangeSpan = dataRange[1] - dataRange[0];
                     contrastWindowSlider.min = "0";
                     contrastWindowSlider.max = String(Math.ceil(Math.max(rangeSpan, contrastSettings.window))); // Use Math.max
                     contrastLevelSlider.min = String(Math.floor(dataRange[0]));
                     contrastLevelSlider.max = String(Math.ceil(dataRange[1]));
                     // Set value *after* min/max
                     contrastWindowSlider.value = String(Math.max(parseFloat(contrastWindowSlider.min), Math.min(parseFloat(contrastWindowSlider.max), contrastSettings.window)));
                     contrastLevelSlider.value = String(Math.max(parseFloat(contrastLevelSlider.min), Math.min(parseFloat(contrastLevelSlider.max), contrastSettings.level)));

                 } else if (metadata.dataRange) {
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
                 updateContrastDisplay(
                     contrastWindowSlider, contrastLevelSlider,
                     contrastWindowValueSpan, contrastWindowRangeSpan,
                     contrastLevelValueSpan, contrastLevelRangeSpan
                 ); // Update the text display AFTER changes

            } catch (error) {
                console.error('Error loading MRC file:', error);
                alert('Error loading MRC file. Please try again.');
            }
        }
    });

    // Contrast slider listeners
    contrastWindowSlider?.addEventListener('input', () => {
        if (!contrastLevelSlider) return;
        viewer.setContrast(
            parseFloat(contrastWindowSlider.value),
            parseFloat(contrastLevelSlider.value)
        );
        updateContrastDisplay(
            contrastWindowSlider, contrastLevelSlider,
            contrastWindowValueSpan, contrastWindowRangeSpan,
            contrastLevelValueSpan, contrastLevelRangeSpan
        );
    });

    contrastLevelSlider?.addEventListener('input', () => {
        if (!contrastWindowSlider) return;
        viewer.setContrast(
            parseFloat(contrastWindowSlider.value),
            parseFloat(contrastLevelSlider.value)
        );
        updateContrastDisplay(
            contrastWindowSlider, contrastLevelSlider,
            contrastWindowValueSpan, contrastWindowRangeSpan,
            contrastLevelValueSpan, contrastLevelRangeSpan
        );
    });

    // 3D View button
    view3DButton?.addEventListener('click', () => {
        // TODO: Implement 3D view
        console.log('3D view clicked');
    });

    // Zoom control
    zoomLevelInput?.addEventListener('change', () => {
        viewer.setZoomLevel(parseFloat(zoomLevelInput.value));
    });

    // Pattern toggle
    patternToggle?.addEventListener('click', () => {
        viewer.togglePattern();
        patternToggle.classList.toggle('active');
    });

    // Z-Projection controls
    zProjectionCheckbox?.addEventListener('change', () => {
        viewer.setZProjection(zProjectionCheckbox.checked);
    });

    sumValueInput?.addEventListener('change', () => {
        // Ensure sumValueInput exists and is not null before parsing
        if (sumValueInput) {
            viewer.setSumValue(parseInt(sumValueInput.value));
        }
    });


    // Step right button
    stepRightButton?.addEventListener('click', () => {
        // TODO: Implement step right functionality
        console.log('Step right clicked');
    });

    // Camera reset
    resetCameraButton?.addEventListener('click', () => {
        viewer.resize(); // Consider if you need a more specific reset
    });

    // Center Slice button
    centerSliceButton?.addEventListener('click', () => {
        if(xSlider && ySlider && zSlider && maxSliceIndices) {
            const centerPositions = {
                yz: Math.floor(maxSliceIndices.yz / 2),
                xz: Math.floor(maxSliceIndices.xz / 2),
                xy: Math.floor(maxSliceIndices.xy / 2)
            };
            xSlider.value = centerPositions.yz.toString();
            ySlider.value = centerPositions.xz.toString();
            zSlider.value = centerPositions.xy.toString();
            // Trigger slice update
            viewer.setSliceIndex('yz', centerPositions.yz);
            viewer.setSliceIndex('xz', centerPositions.xz);
            viewer.setSliceIndex('xy', centerPositions.xy);
        }
    });


    // Handle window resize
    window.addEventListener('resize', () => {
        viewer.resize();
    });

    // Slice Sliders
    xSlider?.addEventListener('input', () => {
        console.log(`xSlider input: ${xSlider.value}`);
        viewer.setSliceIndex('yz', parseInt(xSlider.value));
    });

    ySlider?.addEventListener('input', () => {
        console.log(`ySlider input: ${ySlider.value}`);
        viewer.setSliceIndex('xz', parseInt(ySlider.value));
    });

    zSlider?.addEventListener('input', () => {
        console.log(`zSlider input: ${zSlider.value}`);
        viewer.setSliceIndex('xy', parseInt(zSlider.value));
    });

    // --- Start the initialization ---
    initializeViewer();

}); // End of DOMContentLoaded listener 