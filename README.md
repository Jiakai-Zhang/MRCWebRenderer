# MRC Volume Viewer

A high-performance web-based 3D cryo-ET volume renderer that supports slicing, rotation, autoplay, and contrast adjustment, with advanced annotation and visualization capabilities.

## Features

- Load and visualize .mrc volume files
- Interactive 3D volume rendering
- Multi-planar slicing (X, Y, Z axes)
- Slice autoplay functionality
- Dynamic contrast adjustment
- Modern, responsive UI with T-shaped layout
- Client-side processing using WebGL and WebAssembly
- Advanced annotation tools (contours, markers)
- Synchronized crosshair navigation
- Z-projection and pattern overlay support

## UI Layout

The application features a sophisticated multi-panel viewer with the following components:

### Top Toolbar
- 3D Viewer Button: Launches 3D visualization
- Zoom Control: Numeric input for zoom level adjustment
- Pattern Toggle: Grid-pattern overlay control
- Z-Projection Toggle: Enables summed Z-slice view with sum value input
- Axis Sliders: Interactive controls for X, Y, Z slice navigation
- Navigation Controls: Right arrow for slice step increment

### Main Display Area
The display consists of three orthogonal viewports:

1. **X-Y Plane (Top-Left)**
   - Horizontal orientation
   - Red border
   - Top-down view at fixed Z-level
   - Supports annotations and contours

2. **X-Z Plane (Center)**
   - Vertical orientation
   - Green border
   - Vertical slice at fixed Y-coordinate
   - Features color-coded annotations:
     - Cyan circles (regions of interest)
     - Green circles (labeled features)
     - Magenta circles (comparative features)
     - Yellow line contours (segmentation)
     - Center crosshair

3. **Y-Z Plane (Right)**
   - Vertical orientation
   - Blue border
   - Vertical slice at fixed X-coordinate
   - Crosshair and data annotation support

### Interactive Features
- Synchronized crosshair navigation across all views
- Dynamic panel resizing
- Mouse-based interaction for:
  - Selection
  - Contour drawing
  - View panning/zooming
- Color-coded annotation system

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
   - Navigate through slices using axis sliders
   - Adjust zoom level
   - Toggle pattern overlays
   - Enable Z-projection
   - Create and edit annotations
   - Use synchronized crosshair for precise navigation

## Technical Details

The application uses:
- VTK.js for volume rendering and slicing
- ITK.js for reading .mrc files
- WebGL2 for hardware-accelerated rendering
- WebAssembly for efficient file processing

## License

ISC 