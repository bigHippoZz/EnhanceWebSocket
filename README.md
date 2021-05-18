
## 基于 WebSocket 封装，添加断线重连功能

## Examples

```typescript
const socket = new EnhanceWebSocket("ws://121.40.165.18:8800");
socket.send("hello world")
socket.onmessage((event)=>{console.log(event)})
```
