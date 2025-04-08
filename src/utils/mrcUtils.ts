import * as vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import * as vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';

export interface VolumeMetadata {
    dimensions: [number, number, number];
    spacing: [number, number, number];
    origin: [number, number, number];
    dataRange: [number, number];
}

interface MRCHeader {
    nx: number;
    ny: number;
    nz: number;
    mode: number;
    xlen: number;
    ylen: number;
    zlen: number;
    alpha: number;
    beta: number;
    gamma: number;
    mapc: number;
    mapr: number;
    maps: number;
    amin: number;
    amax: number;
    amean: number;
    ispg: number;
    nsymbt: number;
    extra: Uint8Array;
}

function readMRCHeader(buffer: ArrayBuffer): MRCHeader {
    const header = new DataView(buffer);
    return {
        nx: header.getInt32(0, true),
        ny: header.getInt32(4, true),
        nz: header.getInt32(8, true),
        mode: header.getInt32(12, true),
        xlen: header.getFloat32(40, true),
        ylen: header.getFloat32(44, true),
        zlen: header.getFloat32(48, true),
        alpha: header.getFloat32(52, true),
        beta: header.getFloat32(56, true),
        gamma: header.getFloat32(60, true),
        mapc: header.getInt32(64, true),
        mapr: header.getInt32(68, true),
        maps: header.getInt32(72, true),
        amin: header.getFloat32(76, true),
        amax: header.getFloat32(80, true),
        amean: header.getFloat32(84, true),
        ispg: header.getInt32(88, true),
        nsymbt: header.getInt32(92, true),
        extra: new Uint8Array(buffer, 96, 400)
    };
}

export async function loadMRCFile(file: File): Promise<{ imageData: any; metadata: VolumeMetadata }> {
    try {
        console.log('Starting MRC file load:', file.name);
        console.log('File size:', file.size, 'bytes');
        
        const arrayBuffer = await file.arrayBuffer();
        console.log('ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');
        
        if (arrayBuffer.byteLength < 1024) {
            throw new Error(`File too small to be a valid MRC file. Size: ${arrayBuffer.byteLength} bytes`);
        }

        const header = readMRCHeader(arrayBuffer);
        console.log('MRC Header:', {
            nx: header.nx,
            ny: header.ny,
            nz: header.nz,
            mode: header.mode,
            xlen: header.xlen,
            ylen: header.ylen,
            zlen: header.zlen,
            nsymbt: header.nsymbt
        });
        
        // Validate header values
        if (header.nx <= 0 || header.ny <= 0 || header.nz <= 0) {
            throw new Error(`Invalid dimensions in MRC header: nx=${header.nx}, ny=${header.ny}, nz=${header.nz}`);
        }

        // Calculate dimensions and spacing
        const dimensions: [number, number, number] = [header.nx, header.ny, header.nz];
        const spacing: [number, number, number] = [
            header.xlen / header.nx,
            header.ylen / header.ny,
            header.zlen / header.nz
        ];
        const origin: [number, number, number] = [0, 0, 0];

        console.log('Calculated dimensions:', dimensions);
        console.log('Calculated spacing:', spacing);

        // Calculate expected data size
        const expectedDataSize = header.nx * header.ny * header.nz;
        const dataOffset = 1024 + header.nsymbt;
        const bytesPerVoxel = header.mode === 2 ? 4 : (header.mode === 1 ? 2 : 1);
        const availableDataSize = (arrayBuffer.byteLength - dataOffset) / bytesPerVoxel;

        console.log('Data calculations:', {
            expectedDataSize,
            dataOffset,
            bytesPerVoxel,
            availableDataSize,
            totalBytesNeeded: expectedDataSize * bytesPerVoxel,
            bytesAvailable: arrayBuffer.byteLength - dataOffset
        });

        if (expectedDataSize > availableDataSize) {
            throw new Error(`File size mismatch. Expected ${expectedDataSize} voxels but only ${availableDataSize} available`);
        }

        // Read the data based on the mode
        let data: Float32Array | Uint8Array;
        console.log('Reading data with mode:', header.mode);

        try {
            switch (header.mode) {
                case 0: { // 8-bit signed integer
                    const int8Data = new Int8Array(arrayBuffer, dataOffset, expectedDataSize);
                    data = new Float32Array(expectedDataSize);
                    for (let i = 0; i < expectedDataSize; i++) {
                        data[i] = int8Data[i];
                    }
                    break;
                }
                case 1: { // 16-bit signed integer
                    const int16Data = new Int16Array(arrayBuffer, dataOffset, expectedDataSize);
                    data = new Float32Array(expectedDataSize);
                    for (let i = 0; i < expectedDataSize; i++) {
                        data[i] = int16Data[i];
                    }
                    break;
                }
                case 2: // 32-bit float
                    data = new Float32Array(arrayBuffer, dataOffset, expectedDataSize);
                    break;
                case 3: { // 16-bit complex (2 shorts)
                    const complexData = new Int16Array(arrayBuffer, dataOffset, expectedDataSize * 2);
                    data = new Float32Array(expectedDataSize);
                    for (let i = 0; i < expectedDataSize; i++) {
                        // Take magnitude of complex number
                        const real = complexData[i * 2];
                        const imag = complexData[i * 2 + 1];
                        data[i] = Math.sqrt(real * real + imag * imag);
                    }
                    break;
                }
                case 4: { // 32-bit complex (2 floats) 
                    const complexData = new Float32Array(arrayBuffer, dataOffset, expectedDataSize * 2);
                    data = new Float32Array(expectedDataSize);
                    for (let i = 0; i < expectedDataSize; i++) {
                        // Take magnitude of complex number
                        const real = complexData[i * 2];
                        const imag = complexData[i * 2 + 1];
                        data[i] = Math.sqrt(real * real + imag * imag);
                    }
                    break;
                }
                case 6: { // 16-bit unsigned integer
                    const uint16Data = new Uint16Array(arrayBuffer, dataOffset, expectedDataSize);
                    data = new Float32Array(expectedDataSize);
                    for (let i = 0; i < expectedDataSize; i++) {
                        data[i] = uint16Data[i];
                    }
                    break;
                }
                default:
                    throw new Error(`Unsupported MRC mode: ${header.mode}`);
            }
            console.log('Data array created successfully. Length:', data.length);
        } catch (dataError: any) {
            console.error('Error creating data array:', dataError);
            throw new Error(`Failed to create data array: ${dataError.message}`);
        }

        const dataArray = vtkDataArray.newInstance({
            numberOfComponents: 1,
            values: data,
            dataType: data instanceof Float32Array ? 'Float32Array' : 'Uint8Array',
        });

        const vtkImage = vtkImageData.newInstance();
        vtkImage.setDimensions(dimensions);
        vtkImage.setSpacing(spacing);
        vtkImage.setOrigin(origin);
        vtkImage.getPointData().setScalars(dataArray);

        // Calculate data range for contrast adjustment
        const dataRange = dataArray.getRange() as [number, number];
        console.log('Data range:', dataRange);

        return {
            imageData: vtkImage,
            metadata: {
                dimensions,
                spacing,
                origin,
                dataRange,
            },
        };
    } catch (error: any) {
        console.error('Error loading MRC file:', error);
        console.error('Error stack:', error.stack);
        throw new Error(`Failed to load MRC file: ${error.message}`);
    }
}

export function calculateHistogram(data: Float32Array | Uint8Array, bins: number = 256): number[] {
    const histogram = new Array(bins).fill(0);
    const dataArray = Array.from(data);
    const range = [Math.min.apply(null, dataArray), Math.max.apply(null, dataArray)];
    const binSize = (range[1] - range[0]) / bins;

    for (let i = 0; i < data.length; i++) {
        const value = data[i];
        const binIndex = Math.min(Math.floor((value - range[0]) / binSize), bins - 1);
        histogram[binIndex]++;
    }

    return histogram;
}

export function calculateAutoContrast(data: Float32Array | Uint8Array): { window: number; level: number } {
    const range = [Math.min(...data), Math.max(...data)];
    const window = range[1] - range[0];
    const level = (range[0] + range[1]) / 2;
    return { window, level };
}

export function downsampleVolume(
    imageData: any,
    factor: number
): { downsampledData: any; metadata: VolumeMetadata } {
    const dimensions = imageData.getDimensions() as [number, number, number];
    const spacing = imageData.getSpacing() as [number, number, number];
    const origin = imageData.getOrigin() as [number, number, number];
    const dataArray = imageData.getPointData().getScalars();

    const newDimensions = dimensions.map((d: number) => Math.ceil(d / factor)) as [number, number, number];
    const newSpacing = spacing.map((s: number) => s * factor) as [number, number, number];
    const newData = new (dataArray.getDataType())(newDimensions[0] * newDimensions[1] * newDimensions[2]);

    // Simple box downsampling
    for (let z = 0; z < newDimensions[2]; z++) {
        for (let y = 0; y < newDimensions[1]; y++) {
            for (let x = 0; x < newDimensions[0]; x++) {
                let sum = 0;
                let count = 0;
                for (let dz = 0; dz < factor; dz++) {
                    for (let dy = 0; dy < factor; dy++) {
                        for (let dx = 0; dx < factor; dx++) {
                            const oldX = x * factor + dx;
                            const oldY = y * factor + dy;
                            const oldZ = z * factor + dz;
                            if (oldX < dimensions[0] && oldY < dimensions[1] && oldZ < dimensions[2]) {
                                const index = oldZ * dimensions[0] * dimensions[1] + oldY * dimensions[0] + oldX;
                                sum += dataArray.getData()[index];
                                count++;
                            }
                        }
                    }
                }
                const newIndex = z * newDimensions[0] * newDimensions[1] + y * newDimensions[0] + x;
                newData[newIndex] = sum / count;
            }
        }
    }

    const newDataArray = vtkDataArray.newInstance({
        numberOfComponents: 1,
        values: newData,
        dataType: dataArray.getDataType(),
    });

    const downsampledImage = vtkImageData.newInstance();
    downsampledImage.setDimensions(newDimensions);
    downsampledImage.setSpacing(newSpacing);
    downsampledImage.setOrigin(origin);
    downsampledImage.getPointData().setScalars(newDataArray);

    return {
        downsampledData: downsampledImage,
        metadata: {
            dimensions: newDimensions,
            spacing: newSpacing,
            origin,
            dataRange: newDataArray.getRange() as [number, number],
        },
    };
} 