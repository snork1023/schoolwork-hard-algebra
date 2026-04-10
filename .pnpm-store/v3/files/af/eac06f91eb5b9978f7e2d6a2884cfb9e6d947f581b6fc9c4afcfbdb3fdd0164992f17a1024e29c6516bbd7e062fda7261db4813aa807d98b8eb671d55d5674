# epoxy-client
Fetch and WebSocket implementation for the browser written in Rust that uses the Wisp protocol.

## Building
> [!IMPORTANT]
> Rust nightly with the `wasm32-unknown-unknown` target and `rust-std` component is required.

The build script needs some dependencies:
- `wasm-bindgen`: installable through cargo
- `wasm-opt`: get from [WebAssembly/binaryen](https://github.com/webassembly/binaryen)
- `jq`: install from your distro's repos
- `git`: install from your distro's repos

```bash
bash build.sh
```
The WASM binary and JS bindings will be placed in `pkg`.

## Usage
Examples are available in [`demo.js`](demo.js).

```js
import init, { EpoxyClient, EpoxyClientOptions, EpoxyHandlers } from "@mercuryworkshop/epoxy-tls/epoxy";

// you can also pass in the wasm after fetching it. see the typescript types for all options
await init({ module_or_path: "path/to/epoxy.wasm" });

// or you can import "@mercuryworkshop/epoxy-tls" or "@mercuryworkshop/epoxy-tls/epoxy-bundled"
// those versions have the wasm bundled into the JS as base64 so you don't need to pass anything to init()
//
// there is also a minimal version with only HTTP/1 fetch and TLS/TCP/UDP streams if you want a smaller
// bundle size. those can be imported via "@mercuryworkshop/epoxy-tls/minimal" and "minimal-bundled"

const options = new EpoxyClientOptions();
options.user_agent = navigator.userAgent;
options.wisp_v2 = true;
options.udp_extension_required = true;

// use your own selfhosted wisp server, this is the demo one with throttling
const client = new EpoxyClient("wss://wisp.mercurywork.shop", options);

const res = await client.fetch("https://example.com");
console.log(res.headers, res.rawHeaders);
console.log(await res.text());

// not available in the minimal version 
let handlers = new EpoxyHandlers(
    () => console.log("opened"),
    () => console.log("closed"),
    err => console.error(err),
    msg => console.log(`got "${msg}"`)
);
let ws = await client.connect_websocket(
    handlers,
    "wss://echo.websocket.events",
    ["protocol1"],
    { "x-header": "abc" },
);

await ws.send("data");
```
