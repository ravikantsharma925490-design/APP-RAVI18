const fs = require('fs');
const content = fs.readFileSync('src/components/chat/Sidebar.tsx', 'utf8');
const tagRegex = /<(input|textarea)([\s\S]*?)>/g;
let changed = false;
const newContent = content.replace(tagRegex, (match, tag, attrs) => {
  console.log("Found tag:", tag);
  if (!attrs.includes('className=')) return match;
  let newAttrs = attrs.replace(/text-sm/g, 'text-base');
  newAttrs = newAttrs.replace(/text-xs/g, 'text-base');
  if (attrs !== newAttrs) {
    changed = true;
    return `<${tag}${newAttrs}>`;
  }
  return match;
});
console.log("Changed?", changed);
