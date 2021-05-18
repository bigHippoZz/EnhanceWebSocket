export class Dispatcher<T> {
  private listeners: Array<(val: T) => void> = [];
  public subscribe(func: (val: T) => void) {
    this.listeners.push(func);
    return () => {
      const index = this.listeners.indexOf(func);
      this.listeners.splice(index, 1);
    };
  }
  public dispatch(event: T) {
    for (let i = 0; i < this.listeners.length; i++) {
      const listener = this.listeners[i];
      listener(event);
    }
  }
}

export class EnhanceWebSocket {
  path: string;
  private queue: Array<string> = [];
  private connection: WebSocket | null = null; // 当前ws的引用
  private connectionAttempts: number; // 当前重连次数
  private reconnectionDelay: boolean; // 是否开启重连机制
  private setTimeoutId!: ReturnType<typeof setTimeout> | null; // 当前重连定时器id

  private onopenDispatcher: Dispatcher<Event>;
  private onerrorDispatcher: Dispatcher<Event>;
  private oncloseDispatcher: Dispatcher<CloseEvent>;
  private onmessageDispatcher: Dispatcher<MessageEvent>;
  constructor(path: string, reconnectionDelay = true) {
    this.path = path;
    this.reconnectionDelay = reconnectionDelay; // 是否开启重连机制
    this.connectionAttempts = 0;
    this.onopenDispatcher = new Dispatcher();
    this.oncloseDispatcher = new Dispatcher();
    this.onmessageDispatcher = new Dispatcher();
    this.onerrorDispatcher = new Dispatcher();
    this.initialization();
  }

  public openConnection() {
    if (
      this.readyState === WebSocket.OPEN ||
      this.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    try {
      this.connection = new WebSocket(this.path);
      this.connection.onopen = (value) => this.onopenDispatcher.dispatch(value);
      this.connection.onmessage = (value) =>
        this.onmessageDispatcher.dispatch(value);
      this.connection.onerror = (value) =>
        this.onerrorDispatcher.dispatch(value);
      this.connection.onclose = (value) =>
        this.oncloseDispatcher.dispatch(value);
    } catch (error) {
      this.connection = null;
      console.warn("openConnection is error");
    } finally {
      this.connectionAttempts++;
    }
  }

  public closeConnection() {
    if (
      this.connection instanceof WebSocket &&
      this.readyState !== WebSocket.CLOSING &&
      this.readyState !== WebSocket.CLOSED
    ) {
      this.connection.onclose = null;
      this.connection.onerror = null;
      this.connection.close();
    }
    this.connection = null;
    if (this.setTimeoutId) {
      clearTimeout(this.setTimeoutId);
      this.setTimeoutId = null;
    }
    this.connectionAttempts = 0;
  }

  public onmessage(func: (event: MessageEvent) => void) {
    return this.onmessageDispatcher.subscribe(func);
  }
  public onopen(func: (event: Event) => void) {
    return this.onopenDispatcher.subscribe(func);
  }

  public onerror(func: (event: Event) => void) {
    return this.onerrorDispatcher.subscribe(func);
  }

  public onclose(func: (event: CloseEvent) => void) {
    return this.oncloseDispatcher.subscribe(func);
  }

  public send(msg: string) {
    if (this.readyState === WebSocket.OPEN)
      return (this.connection as WebSocket).send(msg);
    this.queue.push(msg);
  }

  // websocket状态码
  public get readyState(): number {
    if (this.connection === null) return WebSocket.CLOSED;
    return this.connection.readyState;
  }

  // 重连时间
  private get timeout(): number {
    // 依次增加重连时间 最大值为16秒
    return (Math.pow(2, Math.min(this.connectionAttempts, 5)) - 1) * 1000;
  }
  private initialization() {
    const processWaitingMessage = () => {
      this.queue.forEach((msg) => this.send(msg));
      this.queue.length = 0;
    };
    const processReconnection = () => {
      if (!this.reconnectionDelay) return;
      this.setTimeoutId = setTimeout(() => this.openConnection(), this.timeout);
    };
    this.onopenDispatcher.subscribe(processWaitingMessage);
    this.oncloseDispatcher.subscribe(processReconnection);
  }
  static stringify(target: any): string {
    return JSON.stringify(target);
  }

  static parse(string: string) {
    try {
      return JSON.parse(string);
    } catch (error) {
      return false;
    }
  }
}
