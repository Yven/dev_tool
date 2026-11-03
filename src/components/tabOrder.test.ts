import { describe, expect, it, vi } from 'vitest';
import { TAB_ORDER_KEY, dropTabId, loadTabOrder, mergeTabOrder, sameIds, saveTabOrder } from './tabOrder';

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  } as Storage;
}

describe('mergeTabOrder', () => {
  it('按已存顺序保留仍存在的 id', () => {
    expect(mergeTabOrder(['b', 'a', 'c'], ['a', 'b', 'c', 'd'])).toEqual(['b', 'a', 'c', 'd']);
  });

  it('丢弃已消失的 id，新 id 追加到末尾', () => {
    expect(mergeTabOrder(['gone', 'a'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('重复 id 去重', () => {
    expect(mergeTabOrder(['a', 'a', 'b'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('空 saved 用当前顺序', () => {
    expect(mergeTabOrder([], ['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('sameIds', () => {
  it('内容与顺序都相同才为真', () => {
    expect(sameIds(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameIds(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('loadTabOrder / saveTabOrder', () => {
  it('往返保存与读取', () => {
    const storage = makeStorage();
    saveTabOrder(['b', 'a'], storage);
    expect(loadTabOrder(storage)).toEqual(['b', 'a']);
    expect(storage.getItem(TAB_ORDER_KEY)).toBe('["b","a"]');
  });

  it('无值/坏 JSON/非数组返回空数组，非字符串元素被过滤', () => {
    const storage = makeStorage();
    expect(loadTabOrder(storage)).toEqual([]);
    storage.setItem(TAB_ORDER_KEY, '{oops');
    expect(loadTabOrder(storage)).toEqual([]);
    storage.setItem(TAB_ORDER_KEY, '{"a":1}');
    expect(loadTabOrder(storage)).toEqual([]);
    storage.setItem(TAB_ORDER_KEY, '["a",1,null,"b"]');
    expect(loadTabOrder(storage)).toEqual(['a', 'b']);
  });

  it('写入抛错时不向外抛', () => {
    const storage = makeStorage();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveTabOrder(['a'], storage)).not.toThrow();
  });
});

describe('插件顺序', () => {
  it('卸载时丢掉 id，再加载追加到末尾', () => {
    expect(dropTabId(['p', 'a', 'p'], 'p')).toEqual(['a']);
    expect(mergeTabOrder(dropTabId(['p', 'a'], 'p'), ['a', 'p'])).toEqual(['a', 'p']);
  });
});

describe('storage 不可用', () => {
  it('window.localStorage 访问抛错时不向外抛', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(loadTabOrder()).toEqual([]);
      expect(() => saveTabOrder(['a'])).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});
