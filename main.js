// 继承ws 创建实例对象
class EnhanceWebSocket {
    queue = []; // 暂存消息队列
    connectionAttempts = 0; // 重连尝试次数
    connection = null; // 当前的websocket对象
    constructor(path, whetherToReconnect = false) {
        this.path = path;
        this.whetherToReconnect = whetherToReconnect; // 是否重连
        this.openConnection();
    }
    // 创建websocket 对象
    openConnection() {
        try {
            this.connection = new WebSocket(this.path);
        } catch (error) {
            this.connection = null;
            throw new Error("openConnection () :", error);
        } finally {
            this.connectionAttempts += 1;
        }
        this.connection.onopen = val => this.onopen(val);
        this.connection.onmessage = val => this.onmessage(val);
        this.connection.onclose = val => this.onclose(val);
        this.connection.onerror = val => this.onerror(val);
    }
    // WebSocketServer连接成功后触发
    onopen() {
        console.log(`Successfully connected to  server.`);
        this.emptyTheQueue(this.queue);
        this.queue = [];
    }
    // 接收到WebSocketServer发送过来的数据触发
    onmessage(event) {}
    // 连接失败，发送、接收数据失败或者处理数据出现错误
    onerror(errVal) {
        console.warn(`Websocket connection error: ${JSON.stringify(errVal)}`);
        // 出现连接错误的时候，后面一定会执行关闭事件
    }
    onclose({ code, reason, wasclean }) {
        //  close方法的event事件包含 wasclean code reason
        //  wasclean 表示是否明确的关闭了ws
        //  code表示后端返回的状态码
        //  reason 代表后端返回的文本 可以看看有什么
        console.log(code, "code");
        console.log(reason, "reason");
        console.log(wasclean, "wasclean");
        console.warn(`Closed connection to websocket`);
        if (this.whetherToReconnect) {
            this.setTimeout(() => this.openConnection(), this.timeout);
        }
    }
    // 发送消息
    send(data) {
        if (typeof data !== "string") {
            data = this.stringifyData(data);
        }
        // this.connection.send(data);
        if (this.status.status === 0) this.queue.push(data);
    }
    //字符串化数据
    stringifyData(data) {
        try {
            return JSON.stringify(data);
        } catch (error) {
            throw new Error("stringifyData():" + error);
        }
    }
    parseData(data) {
        try {
            return JSON.parse(data);
        } catch (error) {
            throw new Error("parseData():" + error);
        }
    }
    emptyTheQueue(queue) {
        const handle = index => {
            if (index === queue.length) return;
            this.connection.send(queue[index]);
            requestAnimationFrame(() => handle(index + 1));
        };
        handle(0);
    }
    // 返回当前的状态
    get status() {
        switch (this.connection.readyState) {
            case 0:
                return {
                    status: 0,
                    value: "正在建立链接",
                };
            case 1:
                return {
                    status: 1,
                    value: "已经建立链接",
                };
            case 2:
                return {
                    status: 2,
                    value: "正在关闭链接",
                };
            case 3:
                return {
                    status: 3,
                    value: "已经关闭链接",
                };
            default:
                return "this connection is empty !";
        }
    }
    // 重连时间
    get timeout() {
        return (Math.pow(2, Math.min(this.connectionAttempts, 5)) - 1) * 1000;
    }
    setTimeout(func, time) {
        this._setTimeout = window.setTimeout(func, time);
    }
    // 彻底关闭websocket
    requestCloseConnection() {
        if (
            this.connection instanceof WebSocket &&
            (this.status.status !== 2 || this.status.status !== 3)
        ) {
            this.connection.onclose = () => {};
            this.connection.onerror = () => {};
            console.log(this.connection);
            this.connection.close();
        }
        this.clear();
    }
    // 清除各种引用
    clear() {
        if (this._setTimeout) {
            clearTimeout(this._setTimeout);
            this._setTimeout = null;
        }
        this.connection = null;
        this.connectionAttempts = 0;
    }
    chunk(array, func) {
        function handle() {
            func(array.shift());
            if (array.length) setTimeout(handle, 1000);
        }
        setTimeout(handle, 1000);
    }
}
