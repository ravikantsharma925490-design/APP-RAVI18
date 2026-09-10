const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk('./src');

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Find all className="..."
  const classRegex = /className=(?:\{`|["'])(.*?)(?:`\}|["'])/gs;
  
  content = content.replace(classRegex, (match, classList, offset) => {
    // Check what the nearest opening tag is before this className
    const textBefore = content.substring(0, offset);
    const lastOpenTagIdx = textBefore.lastIndexOf('<');
    const lastCloseTagIdx = textBefore.lastIndexOf('>');
    
    // If the last '<' is AFTER the last '>', we are inside a tag.
    // However, JSX can have arrow functions: e => ... which has '>'
    // So looking at the last '<' is safer. Let's get the text from the last '<' to here.
    if (lastOpenTagIdx > lastCloseTagIdx || textBefore.substring(lastOpenTagIdx).match(/<(input|textarea)/)) {
      // Actually, if we just extract the tag name from the last '<'
      const tagMatch = textBefore.substring(lastOpenTagIdx).match(/^<\s*(input|textarea)\b/i);
      if (tagMatch) {
         // We are inside an <input> or <textarea>
         if (classList.includes('text-sm') || classList.includes('text-xs')) {
           let newClassList = classList.replace(/\btext-sm\b/g, 'text-base').replace(/\btext-xs\b/g, 'text-base');
           if (classList !== newClassList) {
             changed = true;
             // We need to replace it in the original match wrapper
             return match.replace(classList, newClassList);
           }
         }
      }
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
