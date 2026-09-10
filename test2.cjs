const content = `<input
  type="text"
  className="w-full text-xs"
/>`;
const tagRegex = /<(input|textarea)([\s\S]*?)>/g;
let m = tagRegex.exec(content);
console.log(m ? m[0] : 'no match');
