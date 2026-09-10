const fs = require('fs');
const content = fs.readFileSync('src/components/chat/Sidebar.tsx', 'utf8');
const tagRegex = /<(input|textarea)([\s\S]*?)>/g;
content.replace(tagRegex, (match, tag, attrs) => {
  console.log("Attrs:", JSON.stringify(attrs));
});
