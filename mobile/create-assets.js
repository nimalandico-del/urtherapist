const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

async function createAssets() {
  try {
    // Create a white square image
    const whiteImage = sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png();

    // Create icon (1024x1024)
    await whiteImage.toFile(path.join(assetsDir, 'icon.png'));
    
    // Create splash (2048x2048)
    const splashImage = sharp({
      create: {
        width: 2048,
        height: 2048,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png();
    await splashImage.toFile(path.join(assetsDir, 'splash.png'));
    
    // Create adaptive icon (1024x1024)
    await whiteImage.toFile(path.join(assetsDir, 'adaptive-icon.png'));
    
    console.log('Created placeholder images in assets/');
  } catch (error) {
    console.error('Error creating assets:', error);
    process.exit(1);
  }
}

createAssets();

