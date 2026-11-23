import { vi } from 'vitest';

export interface RenderedNode {
  type: string;
  props: Record<string, unknown>;
  children: Array<RenderedNode | string>;
}

interface EffectEntry {
  deps?: ReadonlyArray<unknown>;
  cleanup?: (() => void) | void;
  pendingCallback?: () => (() => void) | void;
}

interface SyncStoreEntry {
  unsubscribe?: () => void;
  subscribeFn?: (listener: () => void) => () => void;
}

interface ComponentInstance {
  type: Function;
  hooks: unknown[];
  effects: Map<number, EffectEntry>;
  syncStores: Map<number, SyncStoreEntry>;
}

type ReactElementLike = {
  type: string | Function;
  props?: Record<string, unknown>;
  key?: string | number | null;
};

function isReactElementLike(value: unknown): value is ReactElementLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (typeof (value as ReactElementLike).type === 'string' ||
      typeof (value as ReactElementLike).type === 'function')
  );
}

function depsChanged(prev?: ReadonlyArray<unknown>, next?: ReadonlyArray<unknown>): boolean {
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true;
  }
  return false;
}

/**
 * Runtime minimalista de hooks React + árbol virtual para pruebas unitarias de pantallas RN en Vitest (Node),
 * sin dependencias adicionales de navegador/DOM.
 */
export function createReactTestRuntime() {
  const instances = new Map<string, ComponentInstance>();
  let currentInstance: ComponentInstance | null = null;
  let hookIndex = 0;
  let activePaths = new Set<string>();
  let rootComponent: ((props: Record<string, unknown>) => unknown) | null = null;
  let rootProps: Record<string, unknown> = {};
  let latestTree: RenderedNode | null = null;
  let isRendering = false;
  let needsRerender = false;
  let mounted = false;

  const cleanupInstance = (inst: ComponentInstance) => {
    for (const effect of inst.effects.values()) {
      if (typeof effect.cleanup === 'function') {
        effect.cleanup();
      }
      effect.cleanup = undefined;
    }
    inst.effects.clear();
    for (const store of inst.syncStores.values()) {
      if (typeof store.unsubscribe === 'function') {
        store.unsubscribe();
      }
      store.unsubscribe = undefined;
    }
    inst.syncStores.clear();
  };

  const triggerRerender = () => {
    if (!mounted || !rootComponent) return;
    if (isRendering) {
      needsRerender = true;
      return;
    }
    rerender();
  };

  const useState = <T,>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] => {
    const inst = currentInstance!;
    const idx = hookIndex++;
    if (!(idx in inst.hooks)) {
      inst.hooks[idx] = typeof initial === 'function' ? (initial as () => T)() : initial;
    }
    const setState = (next: T | ((prev: T) => T)) => {
      const prev = inst.hooks[idx] as T;
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      if (!Object.is(prev, resolved)) {
        inst.hooks[idx] = resolved;
        triggerRerender();
      }
    };
    return [inst.hooks[idx] as T, setState];
  };

  const useRef = <T,>(initial: T): { current: T } => {
    const inst = currentInstance!;
    const idx = hookIndex++;
    if (!(idx in inst.hooks)) {
      inst.hooks[idx] = { current: initial };
    }
    return inst.hooks[idx] as { current: T };
  };

  const useMemo = <T,>(factory: () => T, deps?: ReadonlyArray<unknown>): T => {
    const inst = currentInstance!;
    const idx = hookIndex++;
    const prev = inst.hooks[idx] as { value: T; deps?: ReadonlyArray<unknown> } | undefined;
    if (!prev || depsChanged(prev.deps, deps)) {
      const value = factory();
      inst.hooks[idx] = { value, deps };
      return value;
    }
    return prev.value;
  };

  const useCallback = <T extends Function>(callback: T, deps?: ReadonlyArray<unknown>): T => {
    return useMemo(() => callback, deps);
  };

  const useEffect = (callback: () => (() => void) | void, deps?: ReadonlyArray<unknown>): void => {
    const inst = currentInstance!;
    const idx = hookIndex++;
    const prev = inst.effects.get(idx);
    if (!prev || depsChanged(prev.deps, deps)) {
      inst.effects.set(idx, {
        deps,
        cleanup: prev?.cleanup,
        pendingCallback: callback,
      });
    }
  };

  const useSyncExternalStore = <T,>(
    subscribe: (listener: () => void) => () => void,
    getSnapshot: () => T,
  ): T => {
    const inst = currentInstance!;
    const idx = hookIndex++;
    const existing = inst.syncStores.get(idx);
    if (!existing || existing.subscribeFn !== subscribe) {
      if (existing?.unsubscribe) {
        existing.unsubscribe();
      }
      const unsubscribe = subscribe(() => {
        triggerRerender();
      });
      inst.syncStores.set(idx, { subscribeFn: subscribe, unsubscribe });
    }
    return getSnapshot();
  };

  const renderElement = (node: unknown, path: string): RenderedNode | string | null => {
    if (node === null || node === undefined || typeof node === 'boolean') {
      return null;
    }
    if (typeof node === 'string' || typeof node === 'number') {
      return String(node);
    }
    if (Array.isArray(node)) {
      const children: Array<RenderedNode | string> = [];
      node.forEach((child, i) => {
        const rendered = renderElement(child, `${path}[${i}]`);
        if (rendered !== null) {
          children.push(rendered);
        }
      });
      return { type: 'Fragment', props: {}, children };
    }
    if (!isReactElementLike(node)) {
      return null;
    }

    const props = node.props ?? {};
    const nodePath = node.key !== null && node.key !== undefined ? `${path}#${String(node.key)}` : path;

    if (typeof node.type === 'function') {
      activePaths.add(nodePath);
      let inst = instances.get(nodePath);
      if (!inst || inst.type !== node.type) {
        if (inst) {
          cleanupInstance(inst);
        }
        inst = {
          type: node.type,
          hooks: [],
          effects: new Map(),
          syncStores: new Map(),
        };
        instances.set(nodePath, inst);
      }

      const prevInstance = currentInstance;
      const prevHookIndex = hookIndex;
      currentInstance = inst;
      hookIndex = 0;

      let output: unknown;
      try {
        output = node.type(props);
      } finally {
        currentInstance = prevInstance;
        hookIndex = prevHookIndex;
      }

      return renderElement(output, `${nodePath}.0`);
    }

    const rawChildren = props.children;
    const childList = Array.isArray(rawChildren)
      ? rawChildren
      : rawChildren !== undefined
        ? [rawChildren]
        : [];
    const renderedChildren: Array<RenderedNode | string> = [];
    childList.forEach((child, index) => {
      const rendered = renderElement(child, `${nodePath}.${index}`);
      if (rendered !== null) {
        renderedChildren.push(rendered);
      }
    });

    const cleanProps = { ...props };
    delete cleanProps.children;

    return {
      type: node.type,
      props: cleanProps,
      children: renderedChildren,
    };
  };

  const flushEffects = () => {
    for (const [path, inst] of Array.from(instances.entries())) {
      if (!activePaths.has(path)) {
        cleanupInstance(inst);
        instances.delete(path);
      }
    }

    for (const inst of instances.values()) {
      for (const effect of inst.effects.values()) {
        if (effect.pendingCallback) {
          const cb = effect.pendingCallback;
          effect.pendingCallback = undefined;
          if (typeof effect.cleanup === 'function') {
            effect.cleanup();
          }
          effect.cleanup = cb();
        }
      }
    }
  };

  const rerender = () => {
    if (!rootComponent) return;
    isRendering = true;
    needsRerender = false;
    activePaths = new Set<string>();
    try {
      const result = renderElement({ type: rootComponent, props: rootProps }, 'root');
      latestTree = typeof result === 'string' ? null : result;
    } finally {
      isRendering = false;
    }
    flushEffects();
    if (needsRerender) {
      rerender();
    }
  };

  const render = <P extends Record<string, unknown>>(
    Component: (props: P) => unknown,
    props: P = {} as P,
  ) => {
    unmount();
    mounted = true;
    rootComponent = Component as (p: Record<string, unknown>) => unknown;
    rootProps = props;
    rerender();
  };

  const unmount = () => {
    mounted = false;
    for (const inst of instances.values()) {
      cleanupInstance(inst);
    }
    instances.clear();
    latestTree = null;
    rootComponent = null;
  };

  const getTree = () => latestTree;

  const findAll = (predicate: (node: RenderedNode) => boolean): RenderedNode[] => {
    const matches: RenderedNode[] = [];
    const visit = (node: RenderedNode | string | null) => {
      if (!node || typeof node === 'string') return;
      if (predicate(node)) {
        matches.push(node);
      }
      for (const child of node.children) {
        visit(child);
      }
    };
    visit(latestTree);
    return matches;
  };

  const queryByTestId = (testID: string): RenderedNode | null => {
    return findAll((n) => n.props.testID === testID)[0] ?? null;
  };

  const getByTestId = (testID: string): RenderedNode => {
    const found = queryByTestId(testID);
    if (!found) {
      throw new Error(`No se encontró ningún elemento con testID="${testID}"`);
    }
    return found;
  };

  const getTextContent = (node: RenderedNode | string | null = latestTree): string => {
    if (!node) return '';
    if (typeof node === 'string') return node;
    return node.children.map((c) => getTextContent(c)).join('');
  };

  const createElement = (
    type: string | Function,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => ({
    type,
    key: props?.key ?? null,
    props: {
      ...(props ?? {}),
      children: children.length === 1 ? children[0] : children,
    },
  });

  const reactMock = {
    default: {
      createElement,
      Fragment: ({ children }: { children?: unknown }) => children ?? null,
      useState,
      useRef,
      useMemo,
      useCallback,
      useEffect,
      useLayoutEffect: useEffect,
      useSyncExternalStore,
      useDebugValue: () => undefined,
    },
    createElement,
    Fragment: ({ children }: { children?: unknown }) => children ?? null,
    useState,
    useRef,
    useMemo,
    useCallback,
    useEffect,
    useLayoutEffect: useEffect,
    useSyncExternalStore,
    useDebugValue: () => undefined,
  };

  const createZustandMock = () => ({
    create: <T,>(
      initializer: (
        set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void,
        get: () => T,
      ) => T,
    ) => {
      let state: T;
      const listeners = new Set<() => void>();

      const getState = () => state;
      const setState = (partial: Partial<T> | ((s: T) => Partial<T>)) => {
        const nextPartial = typeof partial === 'function' ? partial(state) : partial;
        state = { ...state, ...nextPartial };
        for (const listener of Array.from(listeners)) {
          listener();
        }
      };
      const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      };

      state = initializer(setState, getState);

      const useStore = <U = T,>(selector?: (s: T) => U): U => {
        const select = selector ?? ((s: T) => s as unknown as U);
        return useSyncExternalStore(subscribe, () => select(state));
      };

      return Object.assign(useStore, {
        getState,
        setState,
        subscribe,
      });
    },
  });

  return {
    reactMock,
    createZustandMock,
    render,
    unmount,
    getTree,
    findAll,
    queryByTestId,
    getByTestId,
    getTextContent,
  };
}

export interface AlertButtonLike {
  text?: string;
  style?: string;
  onPress?: () => void | Promise<void>;
}

export function createReactNativeMock() {
  const alertMock = vi.fn<
    (title: string, message?: string, buttons?: AlertButtonLike[]) => void
  >();
  const backHandlers = new Set<() => boolean>();

  const makeHost =
    (name: string) =>
    (props: Record<string, unknown>) => ({
      type: name,
      props,
    });

  const FlatList = (props: {
    data?: unknown[];
    renderItem: (info: { item: unknown; index: number }) => unknown;
    ListEmptyComponent?: unknown;
  }) => {
    const data = props.data ?? [];
    if (data.length === 0) {
      return {
        type: 'FlatList',
        props: { children: props.ListEmptyComponent ?? null },
      };
    }
    return {
      type: 'FlatList',
      props: {
        children: data.map((item, index) => props.renderItem({ item, index })),
      },
    };
  };

  const rnMock = {
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T): T => styles,
    },
    Platform: { OS: 'android' },
    Alert: {
      alert: alertMock,
    },
    BackHandler: {
      addEventListener: vi.fn((event: string, handler: () => boolean) => {
        if (event === 'hardwareBackPress') {
          backHandlers.add(handler);
        }
        return {
          remove: () => {
            backHandlers.delete(handler);
          },
        };
      }),
    },
    View: makeHost('View'),
    Text: makeHost('Text'),
    ScrollView: makeHost('ScrollView'),
    TouchableOpacity: makeHost('TouchableOpacity'),
    TextInput: makeHost('TextInput'),
    ActivityIndicator: makeHost('ActivityIndicator'),
    KeyboardAvoidingView: makeHost('KeyboardAvoidingView'),
    FlatList,
  };

  const triggerHardwareBack = () => {
    for (const handler of Array.from(backHandlers)) {
      handler();
    }
  };

  const reset = () => {
    alertMock.mockReset();
    backHandlers.clear();
  };

  return {
    rnMock,
    alertMock,
    triggerHardwareBack,
    reset,
  };
}

export async function flushMicrotasks(cycles = 6): Promise<void> {
  for (let i = 0; i < cycles; i++) {
    await Promise.resolve();
  }
}
