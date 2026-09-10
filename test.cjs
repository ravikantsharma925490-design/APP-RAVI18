const content = `<input
  className="text-sm"
/>`;
const tagRegex = /<(input|textarea)([^>]+)>/g;
console.log(content.match(tagRegex));
console.log(content.replace(tagRegex, (m, tag, attrs) => attrs.replace('text-sm', 'text-base')));
