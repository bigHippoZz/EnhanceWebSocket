### WebSocket 添加断线重连机制

## Examples

```typescript
const ws = new EnhanceWebSocket("ws://121.40.165.18:8800");
ws.listen((event) => {
  console.log(event);
});
ws.send("hello world");
```
