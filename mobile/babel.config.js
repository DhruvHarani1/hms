// Rewrites `import.meta` → `({})` so `import.meta.env?.MODE` (used by zustand's
// dev warnings) evaluates to undefined instead of crashing the classic web
// bundle with "Cannot use 'import.meta' outside a module".
function importMetaToEmpty() {
  return {
    name: 'import-meta-to-empty',
    visitor: {
      MetaProperty(path) {
        if (
          path.node.meta &&
          path.node.meta.name === 'import' &&
          path.node.property &&
          path.node.property.name === 'meta'
        ) {
          path.replaceWithSourceString('({})');
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [importMetaToEmpty],
  };
};
