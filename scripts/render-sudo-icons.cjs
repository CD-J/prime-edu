// Raster fallbacks are derived from the purpose-drawn SVG, not mascot frames.
const path=require('node:path');
const sharp=require(process.env.PRIME_SHARP_PATH || 'sharp');
const input=path.join(__dirname,'../assets/sudo-app-icon.svg');
Promise.all([[32,'sudo-icon-32.png'],[180,'sudo-touch-icon.png']].map(([size,name])=>
  sharp(input).resize(size,size).png().toFile(path.join(__dirname,'../assets',name))
)).then(()=>console.log('Sudo favicon 32px and touch icon 180px rendered.')).catch(error=>{console.error(error.message);process.exitCode=1;});
