/**
 * 环境检测和适配器
 */

class EnvironmentDetector {
  static getEnvironment() {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      return 'browser';
    } else if (typeof global !== 'undefined' && typeof process !== 'undefined') {
      return 'node';
    } else if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
      return 'worker';
    }
    return 'unknown';
  }

  static isNode() {
    return this.getEnvironment() === 'node';
  }

  static isBrowser() {
    return this.getEnvironment() === 'browser';
  }

  static isWorker() {
    return this.getEnvironment() === 'worker';
  }
}

module.exports = EnvironmentDetector;