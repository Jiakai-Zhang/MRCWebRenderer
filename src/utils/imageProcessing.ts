import { vtkImageData } from '@kitware/vtk.js/Common/DataModel/ImageData';

/**
 * Calculates the median of a sorted array of numbers.
 * Assumes the input array is already sorted numerically.
 */
function calculateMedianSorted(arr: number[]): number {
    if (!arr || arr.length === 0) {
        return NaN; // Or throw an error, depending on desired behavior
    }
    const midIndex = Math.floor(arr.length / 2);
    if (arr.length % 2 !== 0) {
        // Odd number of elements
        return arr[midIndex];
    } else {
        // Even number of elements
        return (arr[midIndex - 1] + arr[midIndex]) / 2;
    }
}

/**
 * Calculates the specified percentile value from a sorted array of numbers.
 * Assumes the input array is already sorted numerically.
 * @param arr Sorted array of numbers.
 * @param percentile The percentile to calculate (0-100).
 */
function calculatePercentileSorted(arr: number[], percentile: number): number {
    if (!arr || arr.length === 0 || percentile < 0 || percentile > 100) {
        return NaN; // Or handle error appropriately
    }
    if (percentile === 0) return arr[0];
    if (percentile === 100) return arr[arr.length - 1];

    const index = (percentile / 100) * (arr.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);

    if (lowerIndex === upperIndex) {
        return arr[lowerIndex];
    }

    // Linear interpolation
    const weight = index - lowerIndex;
    return arr[lowerIndex] * (1 - weight) + arr[upperIndex] * weight;
}

interface ContrastNormalizationResult {
    vmin: number;
    vmax: number;
}

/**
 * Computes contrast normalization values (vmin, vmax) based on tile statistics
 * for the middle Z-slice of a vtkImageData volume.
 *
 * @param imageData The input volume data.
 * @param tileSize The size of the square tiles to analyze.
 * @param extend The factor to extend the calculated range.
 * @returns An object containing { vmin, vmax }.
 */
export function calculateContrastNormalization(
    imageData: vtkImageData,
    tileSize: number = 128,
    extend: number = 1.5
): ContrastNormalizationResult {

    const dims = imageData.getDimensions();
    const scalars = imageData.getPointData().getScalars();
    const scalarsData = scalars?.getData();

    if (!scalars || !scalarsData || dims.length < 3) {
        console.error('Invalid image data for contrast normalization.');
        // Return default or sensible fallback values using the correct access path
        const range = scalars?.getRange() ?? [0, 255]; // Use nullish coalescing for fallback
        return { vmin: range[0], vmax: range[1] };
    }

    const [nx, ny, nz] = dims;
    const middleZ = Math.floor(nz / 2);

    const tileStartX = Array.from({ length: Math.ceil(nx / tileSize) }, (_, i) => i * tileSize);
    const tileStartY = Array.from({ length: Math.ceil(ny / tileSize) }, (_, i) => i * tileSize);
    const numTileX = tileStartX.length;
    const numTileY = tileStartY.length;

    const tileP98Values: number[] = [];
    const tileP02Values: number[] = [];

    for (let yIdx = 0; yIdx < numTileY; yIdx++) {
        const startY = tileStartY[yIdx];
        const endY = Math.min(startY + tileSize, ny);
        for (let xIdx = 0; xIdx < numTileX; xIdx++) {
            const startX = tileStartX[xIdx];
            const endX = Math.min(startX + tileSize, nx);

            const tileData: number[] = [];
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const index = x + y * nx + middleZ * nx * ny;
                    if (index < scalarsData.length) {
                       tileData.push(scalarsData[index]);
                    }
                }
            }

            if (tileData.length > 0) {
                // Sort numerically before calculating percentiles
                tileData.sort((a, b) => a - b);
                const p98 = calculatePercentileSorted(tileData, 98);
                const p02 = calculatePercentileSorted(tileData, 2);

                if (isFinite(p98)) tileP98Values.push(p98);
                if (isFinite(p02)) tileP02Values.push(p02);
            }
        }
    }

    if (tileP02Values.length === 0 || tileP98Values.length === 0) {
         console.warn('Not enough valid tile data for contrast normalization. Using full range.');
         const range = scalars?.getRange() ?? [0, 255];
         return { vmin: range[0], vmax: range[1] };
    }

    // Sort percentile arrays before calculating median
    tileP98Values.sort((a, b) => a - b);
    tileP02Values.sort((a, b) => a - b);

    const medianP98 = calculateMedianSorted(tileP98Values);
    const medianP02 = calculateMedianSorted(tileP02Values);

    if (!isFinite(medianP02) || !isFinite(medianP98)) {
        console.warn('Could not calculate valid median percentiles. Using full range.');
        const range = scalars?.getRange() ?? [0, 255];
        return { vmin: range[0], vmax: range[1] };
    }

    const vmid = 0.5 * (medianP02 + medianP98);
    const vrange = Math.abs(medianP02 - medianP98);

    const vmin = vmid - extend * 0.5 * vrange;
    const vmax = vmid + extend * 0.5 * vrange;

    console.log(`Calculated contrast: vmin=${vmin.toFixed(2)}, vmax=${vmax.toFixed(2)}`);

    // Ensure calculated range is not inverted or zero
    if (vmax <= vmin) {
        console.warn('Calculated contrast range is invalid. Using full data range.');
        const range = scalars?.getRange() ?? [0, 255];
        return { vmin: range[0], vmax: range[1] };
    }

    return { vmin, vmax };
} 