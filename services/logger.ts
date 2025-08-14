import type { Config, LogEntry, LogLevel } from '../types';

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private subscribers: ((logs: LogEntry[]) => void)[] = [];
  private logToFile: boolean = false;
  private electronAPI = window.electronAPI;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setConfig(config: Pick<Config, 'logToFile'>) {
    this.logToFile = !!config.logToFile;
    this.info(`Configuration updated. Logging to file is ${this.logToFile ? 'enabled' : 'disabled'}.`);
  }

  public log(level: LogLevel, message: string) {
    // Avoid recursion if logger is logging about logging
    if (message.startsWith('Configuration updated. Logging to file is')) {
        const existingLog = this.logs.find(l => l.message === message);
        if (existingLog) return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
    };
    
    // To prevent unbounded memory usage, cap logs at 500 entries
    this.logs = [...this.logs.slice(-499), entry];
    this.publish();

    if (this.logToFile && this.electronAPI?.writeLog) {
      this.electronAPI.writeLog(entry).catch(e => {
        // This log won't be written to file, but will appear in the panel
        this.error(`Failed to write log to file: ${e instanceof Error ? e.message : String(e)}`);
        this.logToFile = false;
        this.error('Disabling "Log to file" due to write error. Please check permissions.');
      });
    }
  }

  public debug = (message: string) => this.log('DEBUG', message);
  public info = (message: string) => this.log('INFO', message);
  public warn = (message: string) => this.log('WARNING', message);
  public error = (message: string | Error) => {
    const msg = message instanceof Error ? (message.stack || message.message) : message;
    this.log('ERROR', msg);
  }

  public getLogs = (): LogEntry[] => {
    return this.logs;
  }
  
  public clearLogs = () => {
    this.logs = [];
    this.publish();
    this.info('Log panel cleared.');
  }

  public subscribe = (callback: (logs: LogEntry[]) => void) => {
    this.subscribers.push(callback);
    callback(this.logs); // Immediately publish to new subscriber
  }

  public unsubscribe = (callback: (logs: LogEntry[]) => void) => {
    this.subscribers = this.subscribers.filter(cb => cb !== callback);
  }

  private publish = () => {
    for (const cb of this.subscribers) {
      try {
        cb(this.logs);
      } catch (e) {
        console.error('Error in logger subscriber:', e);
      }
    }
  }
}

export const logger = Logger.getInstance();
