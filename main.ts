type Listener<T> = (val: T) => void;

export class Dispatcher<T> {
  private listeners: Array<Listener<T>> = [];

  public subscribe(func: Listener<T>) {
    this.listeners.push(func);
    return () => {
      const index = this.listeners.indexOf(func);
      // 重复取消订阅时 indexOf 返回 -1，splice(-1, 1) 会误删最后一个监听器
      if (index !== -1) this.listeners.splice(index, 1);
    };
  }

  public dispatch(event: T) {
    // 遍历副本，避免监听器在回调中取消订阅导致跳过后续监听器
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }
}

const MAX_BACKOFF_EXPONENT = 5; // 最大重连间隔 (2^5 - 1) 秒 ≈ 31 秒

export class EnhanceWebSocket {
  path: string;
  private queue: Array<string> = []; // 连接未就绪时待发送的消息
  private connection: WebSocket | null = null; // 当前ws的引用
  private connectionAttempts = 0; // 当前重连次数
  private reconnect: boolean; // 是否开启重连机制
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null; // 当前重连定时器

  private readonly dispatchers = {
    open: new Dispatcher<Event>(),
    error: new Dispatcher<Event>(),
    close: new Dispatcher<CloseEvent>(),
    message: new Dispatcher<MessageEvent>(),
  };

  constructor(path: string, reconnectionDelay = true) {
    this.path = path;
    this.reconnect = reconnectionDelay;
    this.dispatchers.open.subscribe(() => {
      this.connectionAttempts = 0; // 连接成功后重置退避时间
      this.flushQueue();
    });
    this.dispatchers.close.subscribe(() => this.scheduleReconnection());
  }

  public openConnection() {
    if (
      this.readyState === WebSocket.OPEN ||
      this.readyState === WebSocket.CONNECTING
    ) {
      return;
    }
    this.clearReconnectTimer();
    this.connectionAttempts++;

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.path);
    } catch (error) {
      this.connection = null;
      console.warn("openConnection is error", error);
      this.scheduleReconnection();
      return;
    }

    this.connection = socket;
    // 只转发当前连接的事件，忽略已被替换的旧连接
    const forward =
      <T>(dispatcher: Dispatcher<T>) =>
      (event: T) => {
        if (this.connection === socket) dispatcher.dispatch(event);
      };
    socket.onopen = forward(this.dispatchers.open);
    socket.onmessage = forward(this.dispatchers.message);
    socket.onerror = forward(this.dispatchers.error);
    socket.onclose = forward(this.dispatchers.close);
  }

  public closeConnection() {
    const socket = this.connection;
    this.connection = null;
    if (
      socket &&
      socket.readyState !== WebSocket.CLOSING &&
      socket.readyState !== WebSocket.CLOSED
    ) {
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }
    this.clearReconnectTimer();
    this.connectionAttempts = 0;
  }

  public onmessage(func: Listener<MessageEvent>) {
    return this.dispatchers.message.subscribe(func);
  }

  public onopen(func: Listener<Event>) {
    return this.dispatchers.open.subscribe(func);
  }

  public onerror(func: Listener<Event>) {
    return this.dispatchers.error.subscribe(func);
  }

  public onclose(func: Listener<CloseEvent>) {
    return this.dispatchers.close.subscribe(func);
  }

  public send(msg: string) {
    if (this.connection && this.readyState === WebSocket.OPEN) {
      this.connection.send(msg);
    } else {
      this.queue.push(msg);
    }
  }

  // websocket状态码
  public get readyState(): number {
    return this.connection ? this.connection.readyState : WebSocket.CLOSED;
  }

  // 重连时间：随重连次数指数增长
  private get timeout(): number {
    return (
      (Math.pow(2, Math.min(this.connectionAttempts, MAX_BACKOFF_EXPONENT)) -
        1) *
      1000
    );
  }

  private flushQueue() {
    const pending = this.queue.splice(0);
    pending.forEach((msg) => this.send(msg));
  }

  private scheduleReconnection() {
    if (!this.reconnect) return;
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection();
    }, this.timeout);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  static stringify(target: unknown): string {
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
