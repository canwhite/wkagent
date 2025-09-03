/**
 * 浏览器环境适配器
 */

class BrowserFileSystem {
  constructor() {
    this.storage = {
      files: new Map(),
      metadata: new Map()
    };
  }

  async readFile(path, encoding = 'utf-8') {
    // 浏览器环境使用IndexedDB或内存存储
    if (this.storage.files.has(path)) {
      return this.storage.files.get(path);
    }
    
    // 尝试从localStorage读取
    try {
      const content = localStorage.getItem(`wkagent_file_${path}`);
      if (content) return content;
    } catch (e) {
      // 忽略localStorage错误
    }
    
    throw new Error(`File not found: ${path}`);
  }

  async writeFile(path, content, encoding = 'utf-8') {
    this.storage.files.set(path, content);
    this.storage.metadata.set(path, {
      size: Buffer.from(content).length,
      modified: Date.now()
    });
    
    // 同步到localStorage
    try {
      localStorage.setItem(`wkagent_file_${path}`, content);
    } catch (e) {
      // 忽略localStorage错误
    }
    
    return { success: true, path };
  }

  async stat(path) {
    if (this.storage.metadata.has(path)) {
      return this.storage.metadata.get(path);
    }
    throw new Error(`File not found: ${path}`);
  }

  async readdir(path) {
    // 返回所有存储的文件路径
    return Array.from(this.storage.files.keys());
  }

  async mkdir(path, options) {
    // 浏览器环境不需要实际创建目录
    return { success: true };
  }

  async access(path, mode) {
    if (this.storage.files.has(path)) {
      return;
    }
    throw new Error(`File not found: ${path}`);
  }
}

class BrowserProcess {
  constructor() {
    this.workers = new Map();
  }

  spawn(command, args = [], options = {}) {
    // 浏览器环境使用Web Workers模拟
    const workerId = `worker_${Date.now()}`;
    
    // 创建模拟的worker
    const mockWorker = {
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      on: (event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 100);
        }
      },
      kill: () => {}
    };
    
    this.workers.set(workerId, mockWorker);
    return mockWorker;
  }

  exec(command, callback) {
    // 浏览器环境不支持真实命令执行
    setTimeout(() => {
      callback(null, { stdout: '', stderr: '' });
    }, 100);
  }
}

class BrowserPath {
  static resolve(...paths) {
    return paths.join('/').replace(/\/+/g, '/');
  }

  static normalize(path) {
    return path.replace(/\/+/g, '/');
  }

  static join(...paths) {
    return paths.join('/').replace(/\/+/g, '/');
  }

  static dirname(path) {
    const parts = path.split('/');
    return parts.slice(0, -1).join('/') || '/';
  }

  static basename(path, ext) {
    const name = path.split('/').pop();
    return ext ? name.replace(ext, '') : name;
  }

  static extname(path) {
    const name = path.split('/').pop();
    const dotIndex = name.lastIndexOf('.');
    return dotIndex > 0 ? name.substring(dotIndex) : '';
  }

  static relative(from, to) {
    return to.replace(from, '').replace(/^\/+/, '');
  }

  static isAbsolute(path) {
    return path.startsWith('/');
  }
}

class BrowserFetch {
  static async fetch(url, options = {}) {
    return fetch(url, options);
  }
}

class BrowserStorage {
  constructor() {
    this.localStorage = window.localStorage;
    this.sessionStorage = window.sessionStorage;
  }

  async setItem(key, value) {
    this.localStorage.setItem(key, value);
  }

  async getItem(key) {
    return this.localStorage.getItem(key);
  }

  async removeItem(key) {
    this.localStorage.removeItem(key);
  }

  async clear() {
    this.localStorage.clear();
  }
}

module.exports = {
  BrowserFileSystem,
  BrowserProcess,
  BrowserPath,
  BrowserFetch,
  BrowserStorage
};