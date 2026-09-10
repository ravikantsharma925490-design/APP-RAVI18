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

  // Replace text-sm and text-xs inside <input ... />
  // We can use a regex to match <input ... className="..." ... />
  // But a simpler robust approach for react:
  // Match `<input` or `<textarea` until the matching `>` and replace `text-sm` and `text-xs` with `text-base`
  
  const tagRegex = /<(input|textarea)([^>]+)>/g;
  
  content = content.replace(tagRegex, (match, tag, attrs) => {
    // Only replace if it has className
    if (!attrs.includes('className=')) return match;
    
    // Replace text-sm and text-xs
    const newAttrs = attrs
      .replace(/\btext-sm\b/g, 'text-base')
      .replace(/\btext-xs\b/g, 'text-base');
      
    if (attrs !== newAttrs) {
      changed = true;
      return `<${tag}${newAttrs}>`;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
