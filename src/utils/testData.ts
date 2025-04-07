import * as vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import * as vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import { VolumeMetadata } from './mrcUtils';

export function createTestVolume(): { imageData: any; metadata: VolumeMetadata } {
    // Create a 64x64x64 volume with a sphere in the center
    const size = 64;
    const center = size / 2;
    const radius = size / 4;

    // Create the data array
    const data = new Float32Array(size * size * size);
    
    // Fill the volume with a sphere
    for (let z = 0; z < size; z++) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - center;
                const dy = y - center;
                const dz = z - center;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // Create a sphere with smooth edges
                const value = distance < radius ? 
                    (1 - distance / radius) * 255 : 0;
                data[z * size * size + y * size + x] = value;
            }
        }
    }

    // Create VTK data array
    const dataArray = vtkDataArray.newInstance({
        numberOfComponents: 1,
        values: data,
        dataType: 'Float32Array',
    });

    // Create VTK image data
    const imageData = vtkImageData.newInstance();
    imageData.setDimensions([size, size, size]);
    imageData.setSpacing([1, 1, 1]);
    imageData.setOrigin([0, 0, 0]);
    imageData.getPointData().setScalars(dataArray);

    // Create metadata
    const metadata: VolumeMetadata = {
        dimensions: [size, size, size],
        spacing: [1, 1, 1],
        origin: [0, 0, 0],
        dataRange: [0, 255],
    };

    return { imageData, metadata };
} 