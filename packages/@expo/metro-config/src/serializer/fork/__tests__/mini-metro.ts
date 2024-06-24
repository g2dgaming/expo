import { Dependency, MixedOutput, Module, ReadOnlyGraph, SerializerOptions } from 'metro';
import CountingSet from 'metro/src/lib/CountingSet';
import * as path from 'path';
import * as expoMetroTransformWorker from '../../../transform-worker/transform-worker';
import { type TransformInputOptions } from 'metro/src/DeltaBundler/types';

export const projectRoot = '/app';

const METRO_CONFIG_DEFAULTS =
  require('metro-config/src/defaults/index').getDefaultValues() as import('metro-config').ConfigT;

function toDependencyMap(...deps: Dependency[]): Map<string, Dependency> {
  const map = new Map();

  for (const dep of deps) {
    map.set(dep.data.data.key ?? dep.absolutePath, dep);
  }

  return map;
}

export async function microBundle({
  fs,
  entry,
  resolve = (from, id) => {
    const fullFs = {
      ...preModulesFs,
      ...fs,
    };
    for (const index of ['index', '']) {
      for (const ext of ['', '.js', '.ts', '.tsx']) {
        let next = path.join(path.dirname(from), id);
        if (index) {
          next = path.join(next, index);
        }
        next += ext;
        if (fullFs[next] != null) {
          return next;
        }
      }
    }
    if (id === 'expo-mock/async-require' && !fullFs['expo-mock/async-require']) {
      fullFs['expo-mock/async-require'] = `
                module.exports = () => 'MOCK'
            `;
      return 'expo-mock/async-require';
    }
    if (id === 'react-server-dom-webpack/server' && !fullFs['react-server-dom-webpack/server']) {
      fullFs['react-server-dom-webpack/server'] = `
                module.exports = () => 'MOCK'
            `;
      return 'react-server-dom-webpack/server';
    }

    throw new Error(
      `Cannot resolve ${id} from ${from}. Available files: ${Object.keys(fullFs).join(', ')}`
    );
  },
  options = {},
  preModulesFs = {},
}: {
  fs: Record<string, string>;
  entry?: string;
  resolve?: (from: string, id: string) => string;
  options?: {
    dev?: boolean;
    platform?: string;
    baseUrl?: string;
    output?: 'static';
    hermes?: boolean;
    sourceMaps?: boolean;
    sourceUrl?: string;
    isServer?: boolean;
    isReactServer?: boolean;
    inlineSourceMaps?: boolean;
    hot?: boolean;
    splitChunks?: boolean;
    treeshake?: boolean;
  };
  preModulesFs?: Record<string, string>;
}): Promise<
  [
    string,
    readonly Module<MixedOutput>[],
    ReadOnlyGraph<MixedOutput>,
    SerializerOptions<MixedOutput>,
  ]
> {
  const fullFs = {
    'react-server-dom-webpack/server': ``,
    'expo-mock/async-require': `
    module.exports = () => 'MOCK'
`,
    ...preModulesFs,
    ...fs,
  };
  if (!entry) {
    entry = Object.keys(fullFs).find((key) => key.match(/(\.\/)?index\.[tj]sx?/));
    if (!entry) {
      throw new Error(
        'No entrypoint found and cannot infer one from the mock fs: ' +
          Object.keys(fullFs).join(', ')
      );
    }
  }

  const absEntry = path.join(projectRoot, entry);
  const dev = options.dev ?? true;
  const transformOptions: TransformInputOptions = {
    hot: options.hot ?? false,
    minify: false,
    dev,
    type: 'module',
    unstable_transformProfile: options.hermes ? 'hermes-stable' : 'default',
    platform: options.platform ?? 'web',
    customTransformOptions: {
      __proto__: null,
      bytecode: options.hermes,
      baseUrl: options.baseUrl,
      engine: options.hermes ? 'hermes' : undefined,
      environment: options.isReactServer ? 'react-server' : options.isServer ? 'node' : undefined,
      treeshake: options.treeshake,
    },

    // NOTE: This is non-standard but it provides a cleaner output
    experimentalImportSupport: true,
  };

  const modules = new Map<string, Module>();
  const visited = new Set<string>();

  const parsedPreModules = await Promise.all(
    Object.entries(preModulesFs).map(
      async ([id, code]) => await parseModule(id, code, transformOptions)
    )
  );

  async function recurseWith(queue: string[], parent?: Module) {
    while (queue.length) {
      const id = queue.shift()!;
      const absPath = path.join(projectRoot, id);
      if (visited.has(absPath)) {
        modules.get(absPath)?.inverseDependencies.add(
          // @ts-expect-error
          parent?.path
        );
        continue;
      }
      visited.add(absPath);
      const code = fullFs[id];
      if (code == null) {
        throw new Error(`File not found: ${id}`);
      }
      const module = await parseModule(id, code, transformOptions);
      modules.set(absPath, module);

      if (parent?.path) {
        module.inverseDependencies.add(parent.path);
      }

      // @ts-ignore
      for (const dep of module.dependencies.values()) {
        if (dep.data.data.contextParams) {
          throw new Error(`mini-metro runner doesn't support require context (yet)`);
        }

        const resolved = resolve(id, dep.data.name);
        await recurseWith([resolved], module);
      }
    }
  }
  await recurseWith([entry]);

  function moduleExists(id: string) {
    if (fullFs[id] != null) {
      return id;
    }
    const p = id.replace(/^\/+/, '');
    if (fullFs[p] != null) {
      return p;
    }
    return null;
  }

  const findUpPackageJsonPath = (projectRoot: string, dir: string): string | null => {
    if (dir === path.sep || dir.length < projectRoot.length) {
      return null;
    }
    const packageJsonPath = path.relative(projectRoot, path.join(dir, 'package.json'));
    const exists = moduleExists(packageJsonPath);
    if (exists != null) {
      return exists;
    }
    return findUpPackageJsonPath(projectRoot, path.dirname(dir));
  };

  return [
    // entryPoint: string,
    absEntry,
    // preModules: readonly Module<MixedOutput>[],
    parsedPreModules,
    // graph: ReadOnlyGraph<MixedOutput>,
    {
      dependencies: modules,
      entryPoints: new Set([absEntry]),
      transformOptions,
    },
    // options: SerializerOptions<MixedOutput>
    {
      // @ts-ignore
      serializerOptions:
        options.output || options.hermes || options.sourceMaps || options.splitChunks
          ? {
              output: options.output,
              includeSourceMaps: options.sourceMaps,
              splitChunks: options.splitChunks,
            }
          : undefined,

      inlineSourceMap: options.inlineSourceMaps,
      sourceMapUrl: options.sourceMaps
        ? 'https://localhost:8081/indedx.bundle?dev=false'
        : undefined,
      asyncRequireModulePath: 'expo-mock/async-require',

      sourceUrl: options.sourceUrl,
      createModuleId(filePath) {
        return filePath as unknown as number;
      },
      dev,
      getRunModuleStatement(moduleId) {
        return `TEST_RUN_MODULE(${JSON.stringify(moduleId)});`;
      },
      includeAsyncPaths: dev,
      shouldAddToIgnoreList(module) {
        return false;
      },
      modulesOnly: false,
      processModuleFilter(module) {
        return true;
      },
      projectRoot,
      runBeforeMainModule: [],
      runModule: true,
      serverRoot: projectRoot,

      // For testing only since we do extra FS work in the serializer
      _test_getPackageJson(dir: string) {
        const packageJsonPath = findUpPackageJsonPath(projectRoot, dir);
        console.log('packageJsonPath', projectRoot, dir, packageJsonPath);
        if (packageJsonPath) {
          return [JSON.parse(fullFs[packageJsonPath]), packageJsonPath];
        }
        return [null, null];
      },
    },
  ];
}

// A small version of the Metro transformer to easily create dependency mocks from a string of code.
export async function parseModule(
  relativeFilePath: string,
  code: string,
  transformOptions: TransformInputOptions
): Promise<Module<{ type: string; data: { lineCount: number; code: string } }>> {
  const absoluteFilePath = path.join(projectRoot, relativeFilePath);
  const codeBuffer = Buffer.from(code);

  const { output, dependencies } = await expoMetroTransformWorker.transform(
    // TODO: Maybe just pull from expo/metro-config to ensure correctness over time.
    {
      ...METRO_CONFIG_DEFAULTS.transformer,
      asyncRequireModulePath: 'expo-mock/async-require',
      unstable_allowRequireContext: true,
      allowOptionalDependencies: true,
      assetPlugins: [],
      babelTransformerPath: '@expo/metro-config/build/babel-transformer',
    },
    projectRoot,
    absoluteFilePath,
    codeBuffer,
    {
      ...transformOptions,
      inlinePlatform: true,
      inlineRequires: false,
    }
  );

  return {
    getSource() {
      return codeBuffer;
    },
    path: absoluteFilePath,
    dependencies: toDependencyMap(
      ...dependencies.map((dep) => ({
        absolutePath: mockAbsolutePath(dep.name),
        data: dep,
      }))
    ),
    inverseDependencies: new CountingSet(),

    // @ts-expect-error
    output,
  };
}

function mockAbsolutePath(name: string) {
  if (name.match(/^(\.|\/)/)) {
    return path.join(projectRoot, name.replace(/\.[tj]sx?/, '')) + '.js';
  }
  return path.join(projectRoot, 'node_modules', name, 'index.js');
}
