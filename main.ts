interface EnhanceWebSocketClass {
  queue: string[];
  connection: WebSocket | null;
  path: string;
  openConnection(): void; // 打开websocket
  closeConnection(): void; // 关闭websocket
  onopen(event: Event): void;
  onmessage(event: MessageEvent): void;
  onclose(event: CloseEvent): void;
  onerror(event: Event): void;
  send(msg: string): void;
}

export class EnhanceWebSocket implements EnhanceWebSocketClass {
  queue: Array<string> = [];
  connection: WebSocket | null = null; //当前ws的引用
  path: string;
  private connectionAttempts: number;
  private reconnectionDelay: boolean; // 是否开启重连机制
  private setTimeoutId!: number | null; // 当前重连定时器id
  private listener: (event: MessageEvent) => void = () => {};
  constructor(path: string, reconnectionDelay = true) {
    this.path = path;
    this.reconnectionDelay = reconnectionDelay; // 是否开启重连机制
    this.connectionAttempts = 0; // 当前重连次数

    this.openConnection(); // 尝试打开ws
  }
  openConnection() {
    try {
      this.connection = new WebSocket(this.path);
      this.connection.onopen = (val) => this.onopen(val);
      this.connection.onmessage = (val) => this.onmessage(val);
      this.connection.onerror = (val) => this.onerror(val);
      this.connection.onclose = (val) => this.onclose(val);
    } catch (error) {
      this.connection = null;
      console.log("openConnection is error");
    } finally {
      this.connectionAttempts++;
    }
  }
  /**
   * 彻底关闭websocket
   */
  closeConnection() {
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
  onopen(event: Event) {
    console.log(event, "websocket connection opened");
    // 清空队列
    this.queue.forEach((msg) => this.send(msg));
    // 清除引用
    this.queue = [];
  }
  onmessage(event: MessageEvent) {
    // 返回消息 建议使用回调的方式 this.callback(event)
    console.log(event.data, "message");
    this.listener(event);
  }
  onerror(event: Event) {
    // 出现连接错误的时候，后面一定会执行关闭事件
    console.warn(`websocket connection error: ${JSON.stringify(event)}`);
  }
  onclose({ code, reason, wasClean }: CloseEvent): void {
    //  close方法的event事件包含 wasClean code reason
    //  wasClean 表示是否明确的关闭了ws
    //  code表示后端返回的状态码
    //  reason 代表后端返回的文本 可以看看有什么
    console.log(code, "code");
    console.log(reason, "reason");
    console.log(wasClean, "wasClean");
    console.warn(`Closed connection to websocket`);
    if (this.reconnectionDelay) {
      this.setTimeoutId = setTimeout(() => this.openConnection(), this.timeout);
    }
  }
  listen(func: (event: MessageEvent) => void) {
    this.listener = func;
  }
  send(msg: string) {
    if (typeof msg !== "string") throw new Error("msg must be a string");
    if (this.readyState === WebSocket.OPEN)
      return (this.connection as WebSocket).send(msg);
    this.queue.push(msg);
  }
  // websocket状态码
  get readyState(): number {
    if (this.connection === null) return WebSocket.CLOSED;
    return this.connection.readyState;
  }
  // 重连时间
  get timeout(): number {
    // 依次增加重连时间 最大值为16秒
    return (Math.pow(2, Math.min(this.connectionAttempts, 5)) - 1) * 1000;
  }
  static stringify(target: any): string {
    return JSON.stringify(target);
  }
  static parse(string: string) {
    try {
      return JSON.parse(string);
    } catch (error) {
      console.log(error);
    }
  }
}
