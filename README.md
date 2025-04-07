# MRC Volume Viewer

A high-performance web-based 3D cryo-ET volume renderer that supports slicing, rotation, autoplay, and contrast adjustment.

## Features

- Load and visualize .mrc volume files
- Interactive 3D volume rendering
- Multi-planar slicing (X, Y, Z axes)
- Slice autoplay functionality
- Dynamic contrast adjustment
- Modern, responsive UI
- Client-side processing using WebGL and WebAssembly

## Requirements

- Modern web browser with WebGL2 support (Chrome, Firefox, Safari 15+)
- Node.js 14+ for development

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/MRCWebRenderer.git
cd MRCWebRenderer
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Build for production:
```bash
npm run build
```

## Usage

1. Open the application in your web browser (default: http://localhost:9000)
2. Click "Choose File" to select a .mrc volume file
3. Use the controls to:
   - Switch between volume and slice views
   - Change slice orientation (X, Y, Z)
   - Navigate through slices
   - Adjust contrast
   - Enable autoplay

## Technical Details

The application uses:
- VTK.js for volume rendering and slicing
- ITK.js for reading .mrc files
- WebGL2 for hardware-accelerated rendering
- WebAssembly for efficient file processing

## License

ISC 