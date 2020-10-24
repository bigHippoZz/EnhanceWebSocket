## 基于 WebSocket 封装，添加断线重连功能

## Examples

```typescript
const ws = new EnhanceWebSocket("ws://121.40.165.18:8800");
ws.listen((event) => {
  console.log(event);
});
ws.send("hello world");
```
